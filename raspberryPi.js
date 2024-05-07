const mqtt = require('mqtt');
const readline = require('readline');
const { Gpio } = require('onoff');
const schedule = require('node-schedule');
const client = mqtt.connect('mqtt://localhost:1883'); // 브로커가 로컬에서 실행

const alertPin = new Gpio(23, 'out'); // GPIO 핀을 출력에 사용

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let bloodSugarReadings = []; // 입력받은 혈당 데이터를 저장할 배열

client.on('connect', async () => {
    console.log('Connected to MQTT broker');
    
    // Subscribe to walking data
    client.subscribe('walkingData');

    // Send local IP address to EC2 server
    try {
        const ipAddress = await publicIp.v4();
        console.log(`My IP Address is: ${ipAddress}`);
        await sendIpToEc2(ipAddress);
    } catch (error) {
        console.error('Failed to get IP or send to EC2:', error);
    }

    // 매일 06:00, 12:00, 18:00에 저장된 혈당 데이터 발행
    schedule.scheduleJob('0 6,12,18 * * *', () => {
        if (bloodSugarReadings.length > 0) {
            const dataToSend = JSON.stringify(bloodSugarReadings);
            client.publish('bloodSugar', dataToSend);
            console.log('Published blood sugar readings:', dataToSend);
            bloodSugarReadings = []; // 데이터 발행 후 배열 비우기
        }
    });
});

function sendIpToEc2(ipAddress) {
    return axios.post('https://3066-59-6-127-176.ngrok-free.app/receiveIp', { ip: ipAddress })
        .then(response => console.log('IP sent to EC2:', response.data))
        .catch(error => console.error('Failed to send IP to EC2:', error));
}

client.on('message', (topic, message) => {
    if (topic === 'walkingData') {
        const data = JSON.parse(message.toString());
        const { recommendedStep, currentStep } = data;

        // 목표 걸음수보다 현재 걸음수가 적을 경우 알림
        if (currentStep < recommendedStep) {
            alertPin.writeSync(1); // 알림 켜기
            setTimeout(() => alertPin.writeSync(0), 3000); // 3초 후 알림 끄기
            //console.log('success');
        }
    }
});

function promptForBloodSugar() {
    rl.question('Enter blood sugar reading: ', (input) => {
        if (!isNaN(input)) {
            bloodSugarReadings.push({ date: new Date().toISOString(), value: input });
            console.log('Blood sugar reading saved:', input);
        } else {
            console.log('Invalid input. Please enter a numeric blood sugar reading.');
        }
        promptForBloodSugar(); // 계속해서 다음 입력을 받기
    });
}

// 입력 프롬프트 시작
promptForBloodSugar();