// const AWS = require('aws-sdk');
// const stepfunctions = new AWS.StepFunctions({region: 'us-east-1'});

// exports.handler = async (event) => {
//   console.log(event.queryStringParametersStringParameters)
//   const {  taskToken, approvalToken } = event.queryStringParametersStringParameters;
//   const expectedToken = 'EXPECTED_TOKEN';  // This should match the token generated in Step Functions

//   const stateMachineArn = 'arn:aws:states:us-east-1:510211938063:stateMachine:ApprovalStateMachine';  // The ARN of the Step Functions state machine

//     console.log(encodeURIComponent(taskToken))
//   // Token validation logic
//   if (true) {
//     // Send result back to Step Functions to continue
//     const params = {
//       // token: approvalToken,
//       taskToken: encodeURIComponent(taskToken),
//       output: JSON.stringify({ approval: 'approved' })  // The result of the approval (success)
//     };
//     await stepfunctions.sendTaskSuccess(params).promise();  // This continues the workflow

//     return {
//       statusCode: 200,
//       body: JSON.stringify({ approval: 'approved' }),
//     };
//     // const params = {
//     //   stateMachineArn,
//     //   input: JSON.stringify({ approval: 'approved' }),  // Send the approval status to Step Functions
//     // };
//     // await stepfunctions.startExecution(params).promise();

//     // return {
//     //   statusCode: 200,
//     //   body: JSON.stringify({ approval: 'approved' }),
//     // };
//   } else {
//     // Send result back to Step Functions to fail
//     const params = {
//       stateMachineArn,
//       input: JSON.stringify({ approval: 'rejected' }),  // Send the rejection status to Step Functions
//     };
//     await stepfunctions.startExecution(params).promise();

//     return {
//       statusCode: 400,
//       body: JSON.stringify({ approval: 'rejected' }),
//     };
//   }
// };
// const { SFN: StepFunctions } = require("@aws-sdk/client-sfn");

// exports.handler = (event, context, callback) => {
//   console.log('Event= ' + JSON.stringify(event));
//   const action = event.queryStringParameters.action;
//   const taskToken = event.queryStringParameters.taskToken;
//   const statemachineName = event.queryStringParameters.sm;
//   const executionName = event.queryStringParameters.ex;

//   const stepfunctions = new StepFunctions();

//   var message = "";

//   if (action === "approve") {
//     message = { "Status": "Approved! Task approved by" };
//   } 
//   // else if (action === "reject") {
//   //   message = { "Status": "Rejected! Task rejected by ${Email}" };
//   // } 
//   else {
//     console.error("Unrecognized action. Expected: approve, reject.");
//     callback({"Status": "Failed to process the request. Unrecognized Action."});
//   }

//   stepfunctions.sendTaskSuccess({
//     output: JSON.stringify(message),
//     taskToken: event.queryStringParameters.taskToken
//   })
//   .then(function(data) {
//     return {
//       statusCode: 200,
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ message: "Task successfully processed." }),
//     }; 
//   }).catch(function(err) {
//     console.error(err, err.stack);
//     callback(err);
//   });
// }


const { SFNClient, SendTaskSuccessCommand, SendTaskFailureCommand } = require("@aws-sdk/client-sfn");

const client = new SFNClient({ region: 'us-east-1' });

exports.handler = async (event) => {
  const action = event.queryStringParameters.action;
  const taskToken = event.queryStringParameters.taskToken;
  console.log("Received event:", JSON.stringify(event));

  // Parse the input
  // const { taskToken, action } = JSON.parse(event.body);

  if (!taskToken || !action) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing taskToken or action" }),
    };
  }

  try {
    if (action === "approve") {
      // Complete the task with success
      const command = new SendTaskSuccessCommand({
        taskToken,
        output: JSON.stringify({ Status: "Approved! Task approved by" }),
      });
      await client.send(command);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Task approved" }),
      };
    } else if (action === "reject") {
      // Fail the task
      const command = new SendTaskFailureCommand({
        taskToken,
        error: "TaskRejected",
        cause: "The task was rejected by a human.",
      });
      await client.send(command);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Task rejected" }),
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid action" }),
      };
    }
  } catch (error) {
    console.error("Error processing task token:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to process the task token" }),
    };
  }
};
