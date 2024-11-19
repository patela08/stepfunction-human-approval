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

    // Step 3: Create Step Functions State Machine with Manual Approval (waiting for user response)
    const approvalToken = uuid.v4();
    
    // const approvalTask = new tasks.SnsPublish(this, 'SendApprovalRequest', {
    //   topic: approvalTopic,
    //   integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
    //   message: sfn.TaskInput.fromObject({
    //     message: 'Please approve or reject the request by clicking the link below:',
    //     approvalLink: `${api.url}approve?token=${approvalToken}&taskToken=${sfn.JsonPath.stringAt('$.taskToken')}`,  // User clicks this to approve
    //     waitTime: 30,
    //     Timeout: 30,
    //     token: approvalToken
    //   }),
    //   resultPath: '$.snsResult',
    // });

    // const approvalTask2 = new tasks.CallAwsService(this, 'SnsPublish2', {
    //   service: 'sns',
    //   action: 'publish',
    //   parameters: {
    //     TopicArn: approvalTopic.topicArn,
    //     Message: {
    //       message: 'Please approve or reject the request by clicking the link below:',
    //       approvalLink: sfn.JsonPath.format(
    //         '{}/approve?token={}&taskToken={}', 
    //         this.apiUrl,  // URL of your API Gateway
    //         approvalToken,  // Path to your approval token
    //         sfn.JsonPath.taskToken  // Path to the task token
    //       ),
    //       region: cdk.Aws.REGION,  // Use CDK to inject the region dynamically
    //       waitTime: 30,
    //       Timeout: 30,
    //     },
    //     taskToken: sfn.JsonPath.taskToken,
    //     // 'Message.$': "States.Format('transaction {} was processed successfully!', $.transactionId)",
    //   },
    //   iamResources: ['*'],
    // });

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

    // const approvalWaitTask = new sfn.Wait(this, 'WaitForApproval', {
    //   time: sfn.WaitTime.duration(cdk.Duration.seconds(300)),
    // });

    const isTokenValid = new sfn.Choice(this, 'IsTokenValid')
      .when(sfn.Condition.stringEquals('$.lambdaResult.Status', 'Approved! Task approved by'), new sfn.Succeed(this, 'ApprovalReceived'))
      .otherwise(new sfn.Fail(this, 'TokenInvalid', {
        error: 'InvalidToken',
        cause: 'The provided token is invalid.',
      }));

    // const approvalSuccess = new sfn.Succeed(this, 'ApprovalReceived');



    const definition = approvalTask
      // .next(approvalWaitTask)
      .next(isTokenValid);

    // Create the Step Functions state machine
    const stateMachine = new sfn.StateMachine(this, 'ApprovalStateMachine', {
      definition,
      stateMachineName: 'ApprovalStateMachine',
    });

    this.stateMachineArn = stateMachine.stateMachineArn;

    // Add permission for Step Functions to publish to the SNS topic
    approvalTopic.grantPublish(stateMachine.role);
  }
}
