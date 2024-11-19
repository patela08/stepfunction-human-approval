// const AWS = require('aws-sdk');
// const sns = new AWS.SNS();

// exports.handler = async (event) => {
//   console.log(event, event.taskToken)
//   const message = event.message || 'Default message'; // Example message
//   const topicArn = process.env.SNS_TOPIC_ARN;
  
//   const params = {
//     Message: JSON.stringify(message),
//     TopicArn: topicArn,
//   };

//   try {
//     const result = await sns.publish(params).promise();
//     console.log('Message sent to SNS', result);
//     return {
//       statusCode: 200,
//       body: JSON.stringify({
//         message: 'Message sent to SNS!',
//         snsMessageId: result.MessageId,
//       }),
//     };
//   } catch (error) {
//     console.error('Error sending message to SNS', error);
//     return {
//       statusCode: 500,
//       body: JSON.stringify({ error: 'Failed to send message' }),
//     };
//   }
// };


console.log('Loading function');
const { SNS } = require("@aws-sdk/client-sns");
exports.handler = (event, context, callback) => {
    console.log('event= ' + JSON.stringify(event));
    console.log('context= ' + JSON.stringify(context));

    const executionContext = event.ExecutionContext;
    console.log('executionContext= ' + executionContext);

    const executionName = executionContext.Execution.Name;
    console.log('executionName= ' + executionName);

    const statemachineName = executionContext.StateMachine.Name;
    console.log('statemachineName= ' + statemachineName);

    const taskToken = executionContext.Task.Token;
    console.log('taskToken= ' + taskToken);

    const apigwEndpint = event.APIGatewayEndpoint;
    console.log('apigwEndpint = ' + apigwEndpint)

    const approveEndpoint = apigwEndpint + "approve?action=approve&ex=" + executionName + "&sm=" + statemachineName + "&taskToken=" + encodeURIComponent(taskToken);
    console.log('approveEndpoint= ' + approveEndpoint);

    const rejectEndpoint = apigwEndpint + "reject?action=reject&ex=" + executionName + "&sm=" + statemachineName + "&taskToken=" + encodeURIComponent(taskToken);
    console.log('rejectEndpoint= ' + rejectEndpoint);

    const emailSnsTopic = process.env.SNS_TOPIC_ARN;
    console.log('emailSnsTopic= ' + emailSnsTopic);

    var emailMessage = 'Welcome! \n\n';
    emailMessage += 'This is an email requiring an approval for a step functions execution. \n\n'
    emailMessage += 'Check the following information and click "Approve" link if you want to approve. \n\n'
    emailMessage += 'Execution Name -> ' + executionName + '\n\n'
    emailMessage += 'Approve ' + approveEndpoint + '\n\n'
    emailMessage += 'Reject ' + rejectEndpoint + '\n\n'
    emailMessage += 'Thanks for using Step functions!'
    
    const sns = new SNS();
    var params = {
      Message: emailMessage,
      Subject: "Required approval from AWS Step Functions",
      TopicArn: emailSnsTopic
    };

    sns.publish(params)
      .then(function(data) {
        console.log("MessageID is " + data.MessageId);
        callback(null);
      }).catch(
        function(err) {
        console.error(err, err.stack);
        callback(err);
      });
}
