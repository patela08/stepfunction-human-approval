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
const { SNS, PublishCommand } = require("@aws-sdk/client-sns");
exports.handler = async (event, context, callback) => {
    console.log('Sending task token request for approval to delete old rds instance.');

    const executionContext = event.ExecutionContext;
    const taskToken = executionContext.Task.Token;

    const apigwEndpint = event.APIGatewayEndpoint;

    const approveEndpoint = `${apigwEndpint}approve?action=approve&taskToken=${encodeURIComponent(taskToken)}`;

    const rejectEndpoint = `${apigwEndpint}reject?action=reject&taskToken=${encodeURIComponent(taskToken)}`;
    const emailSnsTopic = process.env.SNS_TOPIC_ARN;
    console.log('emailSnsTopic= ' + emailSnsTopic);

    var emailMessage = 'Welcome! \n\n';
    emailMessage += `This is an email requiring an approval for a step functions execution. \n\n`
    emailMessage += `Click on "Approve" link if you want to delete old RDS cluster and instance. And "Reject" if you don't want to delete it. \n\n`
    emailMessage += `Approve::: ${approveEndpoint}\n\n`
    emailMessage += `Reject::: ${rejectEndpoint}\n\n`
    
    const sns = new SNS();
    var params = {
      Message: emailMessage,
      Subject: "[Instride PI | env] Require approval from AWS Step Functions to delete OLD RDS cluster and instance",
      TopicArn: emailSnsTopic
    };

    const pubCommand = new PublishCommand(params);
    const response = await sns.send(pubCommand);
   
    console.log('Message sent', response.MessageId);
    
}
