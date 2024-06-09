const fs = require('fs');
const mqtt = require('mqtt');
const { Gpio } = require('onoff');
var GPIO = require('onoff').Gpio;
const schedule = require('node-schedule');
const readline = require('readline');

// Load certificates and keys
const caFile = fs.readFileSync('/home/admin/certs/AmazonRootCA1.pem');
const certFile = fs.readFileSync('/home/admin/certs/testconn/device.pem.crt');
const keyFile = fs.readFileSync('/home/admin/certs/testconn/private.pem.key');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

//sensor
var alertPin = new GPIO(535, 'out'); //23번 pin


// MQTT options including the SSL configuration
const options = {
  host: 'a3mwllq937a5i6-ats.iot.us-east-1.amazonaws.com',
  port: 8883,
  protocol: 'mqtts',
  ca: caFile,
  cert: certFile,
  key: keyFile
};

// Connect to the AWS IoT
const client = mqtt.connect(options);

client.on('connect', () => {
  console.log('Connected to AWS IoT');
  alertPin.writeSync(0);
  client.subscribe('walkingData', { qos: 0 });
  //publishData();
  // 키보드 입력 받기
  rl.setPrompt('Enter the blood sugar level (press Ctrl+C to exit): ');
  rl.prompt();
  rl.on('line', function (data) {
    // Enter를 누를 때마다 메시지 publish
    const message = JSON.stringify({ value: data });
    client.publish('bloodSugar', message, { qos: 1 }, (error) => {
      if (error) {
        console.error('Failed to send message:', error);
      }
    });

    console.log(`Blood sugar level '${data}' has been sent to the 'bloodSugar' topic`);
    rl.prompt(); // 다시 입력 받기
  });
});


client.on('message', (topic, message) => {
    if (topic === 'walkingData') {
      const data = JSON.parse(message.toString());
      if (data.needMoreStep === true) {
        alertPin.writeSync(1); // Turn on the GPIO pin
        setTimeout(() => {
          alertPin.writeSync(0); // Turn off the GPIO pin after 3 seconds
        }, 3000);
      }
    }
});

client.on('error', (error) => {
  console.log('Connection failed:', error);
});


//keep the Node.js process running even if the publishing function is idle
process.on('SIGINT', function() {
    console.log("Caught interrupt signal");
    rl.close();
    client.end(true, () => {
      process.exit();
    });
  });

/*
// Function to read input from the keypad (simulated by the command line)
function readKeypadInput() {
  rl.question('Enter data (Press # to finish): ', (input) => {
    if (input.endsWith('#')) {
      // Remove the last character '#' and prepare the message
      const message = input.slice(0, -1); // remove the last character
      client.publish('bloodSugar', JSON.stringify({ value: message }), { qos: 0, retain: false });
      console.log('Data published:', message);
      rl.close();
    } else {
      console.log('Data must end with # to finish input.');
      readKeypadInput(); // Ask for input again
    }
  });
}

// Trigger the input reading function
readKeypadInput();
*/
