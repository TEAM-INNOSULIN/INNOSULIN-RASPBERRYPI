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

const dataTemplate = {
  name: "홍길동",
  clientID: "23RXRT",
  phoneNumber: "010-1234-5678",
  familyNumber: [
    "010-9533-3333",
    "010-4352-1234"
  ],
  bloodSugar: []  // 여기에 입력받은 혈당 수치와 시간을 추가할 것입니다.
};

//sensor
var alertPin = new GPIO(535, 'out'); //23번 pin //1,2칸 사이
alertPin.writeSync(1);


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
  client.subscribe('walkingData', { qos: 0 });
  //publishData();
  // 키보드 입력 받기
  rl.setPrompt('Enter the blood sugar level (press Ctrl+C to exit): ');
  rl.prompt();
  rl.on('line', function (bloodSugarLevel) {
    // 현재 시간을 포함하여 혈당 데이터를 생성
    const bloodSugarEntry = {
      date: new Date().toISOString(),
      value: parseFloat(bloodSugarLevel)
    };

    // 예시 데이터에 새로운 혈당 데이터 추가
    const dataToSend = { ...dataTemplate };
    dataToSend.bloodSugar.push(bloodSugarEntry);

    // JSON 문자열로 변환
    const message = JSON.stringify(dataToSend);

    // 메시지 publish
    client.publish('bloodSugar', message, { qos: 1 }, (error) => {
      if (error) {
        console.error('Failed to send message:', error);
      } else {
        console.log(`Blood sugar level '${bloodSugarLevel}' has been sent to the 'bloodSugar' topic`);
      }
    });

    rl.prompt(); // 다시 입력 받기
  });
});


client.on('message', (topic, message) => {
    if (topic === 'walkingData') {
      const data = JSON.parse(message.toString());
      if (data.needMoreStep === true) {
        alertPin.writeSync(0); // Turn on the GPIO pin
        setTimeout(() => {
          alertPin.writeSync(1); // Turn off the GPIO pin after 3 seconds
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
*/