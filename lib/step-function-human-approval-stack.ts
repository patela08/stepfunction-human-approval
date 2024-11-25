import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sns from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as uuid from 'uuid';
import path = require('path');
import { Rule, RuleTargetInput } from 'aws-cdk-lib/aws-events';
import { SnsTopic as SNSTarget } from 'aws-cdk-lib/aws-events-targets';

export class StepFunctionHumanApprovalStack extends cdk.Stack {
  public readonly apiUrl: string;
  public readonly stateMachineArn: string;
  public readonly approvalTopic: sns.ITopic;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Step 1: Create SNS Topic for sending approval notifications
    const approvalTopic = new sns.Topic(this, 'ApprovalTopic', {
      displayName: 'Approval Request Topic',
    });

    approvalTopic.addSubscription(new EmailSubscription('axrptl81292@gmail.com'))
    this.approvalTopic = approvalTopic;

    // Step 2: Create API Gateway to handle approval/rejection from the user
    const api = new apigateway.RestApi(this, 'ApprovalApi', {
      restApiName: 'Approval API',
      description: 'API for handling approval/rejection requests',
    });

    const approveResource = api.root.addResource('approve');

    const approvalLambda = new lambda.Function(this, 'ApprovalLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('lib/lambda'),  // Lambda code in the 'lambda' folder
    });

    approveResource.addMethod('GET', new apigateway.LambdaIntegration(approvalLambda));

    const snsLambda = new lambda.Function(this, 'SnsPublisherLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,  // Node.js runtime
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')), // Directory for Lambda code
      environment: {
        SNS_TOPIC_ARN: approvalTopic.topicArn, // Pass the SNS Topic ARN to the Lambda
      },
    });
    
    approvalTopic.grantPublish(snsLambda);

    // Output the API URL to be used in SNS messages
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'The URL of the approval API Gateway',
      exportName: 'ApprovalApiUrl', // Export the URL for use in other stacks if needed
    });
    this.apiUrl = api.url;

    const approvalTask = new tasks.LambdaInvoke(this, 'Invoke SNS Lambda', {
      lambdaFunction: snsLambda,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      payload: sfn.TaskInput.fromObject({
        "ExecutionContext.$": "$$",
        "APIGatewayEndpoint": this.apiUrl,
        taskToken: sfn.JsonPath.taskToken,
      }),
      taskTimeout: sfn.Timeout.duration(cdk.Duration.seconds(30)),
      resultPath: '$.lambdaResult',  // Capture the result of the Lambda invocation
    });

    const isTokenValid = new sfn.Choice(this, 'IsTokenValid')
      .when(sfn.Condition.stringEquals('$.lambdaResult.Status', 'Approved! Task approved by'), new sfn.Succeed(this, 'ApprovalReceived'))
      .otherwise(new sfn.Fail(this, 'TokenInvalid', {
        error: 'InvalidToken',
        cause: 'The provided token is invalid.',
      }));




    const definition = approvalTask
      .next(isTokenValid);

    // Create the Step Functions state machine
    const stateMachine = new sfn.StateMachine(this, 'ApprovalStateMachine', {
      definition,
      stateMachineName: 'ApprovalStateMachine',
    });

    this.stateMachineArn = stateMachine.stateMachineArn;

    const rule = new Rule(this, 'StepFunctionStateChangeRule', {
      eventPattern: {
        source: ['aws.states'],
        detailType: ['Step Functions Execution Status Change'],
        detail: {
          stateMachineArn: [this.stateMachineArn],
          status: ['SUCCEEDED', 'FAILED'], // Match success or failure
        },
      },
    });

    rule.addTarget(new SNSTarget(approvalTopic))
    // Add permission for Step Functions to publish to the SNS topic
    approvalTopic.grantPublish(stateMachine.role);
  }
}
