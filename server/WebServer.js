
const express =require('express');
const path = require('path');
const bodyParser=require('body-parser');
const WebSocket = require('ws'); 
const app=express();

const {MongoClient} = require('mongodb');
const uri="mongodb+srv://vuvannamb1:hxruOlLP2VlAsXK0@cluster0.2kdmx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);


const SENSOR_PORT = 3001;
const CAMERA_PORT = 3002;
const webClients= new Set();

app.use(express.static(__dirname + '/../client/login'));
app.use(express.static(__dirname + '/../client/public'));
app.use(bodyParser.json());//xử lý json từ các cient;


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..','client','login', 'login.html'));
});

app.get('/app', (req, res) => { 
    res.sendFile(path.join(__dirname, '..','client', 'public', 'app.html'));
});

app.post('/login', async(req, res) => {
    const { email, password } = req.body;
    try{
        const user = await db.collection('users').findOne({ email :email});
        if(user){
            if(user.password===password){
                res.json({message: 'Đăng nhập thành công',user_id:user.id});
                }
            else{
                res.status(401).json({message: 'Mật khẩu không đúng'});
            }
        }
        else{
            res.status(401).json({message: 'Email không đúng'});
        }
    }
    catch(error){
        console.error('Lỗi khi đăng nhập:', error);
        res.status(500).json({message: 'Lỗi server'});
    }
});

//http server
const sensorServer = app.listen(SENSOR_PORT, () => {
    console.log(`Sensor server running at http://localhost:${SENSOR_PORT}`);
});

const cameraServer = app.listen(CAMERA_PORT, () => {
    console.log(`Camera server running at http://localhost:${CAMERA_PORT}`);
});

//mongodb server
let db;
async function connectToDatabase() {
    try {
        await client.connect();
        console.log("Đã kết nối đến MongoDB Atlas");

        // Lấy database
        db = client.db('prj3_data'); 
    } catch (error) {
        console.error("Không thể kết nối MongoDB:", error);
    }
}
// Kết nối đến database khi khởi động server
connectToDatabase();

const sensorWss = new WebSocket.Server({ server: sensorServer });
const cameraWss = new WebSocket.Server({ server: cameraServer });

let esp32SensorClient = null;
let esp32CameraClient = null;

sensorWss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    ws.on('message', (message) => {   
        if (!esp32SensorClient && message.toString() === 'ESP32_SENSOR') {
            esp32Client = ws;
            console.log('ESP32 sensor client connected');
            return;
        }

        if (ws === esp32SensorClient) //nếu là esp32
        {
            try {
                const data = JSON.parse(message.toString());
                sensorWss.clients.forEach((client) => {
                    if (client !== esp32SensorClient && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
                console.log('Sensor data: ', sensorData);
            } catch (error) {
                console.error('Invalid sensor data:', message.toString());
            }
        } 

    });

    ws.on('close', () => {
        if (ws === esp32SensorClient) {
            console.log('ESP32 sensor client disconnected');
            esp32Client = null;
        } 
    });
});

cameraWss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    ws.on('message', (message) => {
        if (!esp32CameraClient && message.toString() === 'ESP32_CAMERA') {
            esp32CameraClient = ws;
            console.log('ESP32 camera client connected');
            return;
        }

        if (ws === esp32CameraClient) 
        {
            if (message instanceof Buffer) {
                console.log('Received image data: ', message.length, 'bytes');

                // Process image via Python script
                const pythonProcess = spawn('python3', ['./fire_detect/fire_detect.py']);
                let jsonResponse = '';
                let annotatedImageBuffer = Buffer.alloc(0);

                pythonProcess.stdin.write(message); // Send buffer image to stdin
                pythonProcess.stdin.end();

                // Capture Python stdout (JSON metadata and annotated image)
                pythonProcess.stdout.on('data', (data) => {
                    if (!jsonResponse) {
                        const delimiter = Buffer.from('\n\n');
                        const splitIndex = data.indexOf(delimiter);

                        if (splitIndex !== -1) {
                            jsonResponse = data.slice(0, splitIndex).toString();
                            annotatedImageBuffer = data.slice(splitIndex + delimiter.length);
                        } else {
                            jsonResponse += data.toString();
                        }
                    } else {
                        annotatedImageBuffer = Buffer.concat([annotatedImageBuffer, data]);
                    }
                });

                pythonProcess.on('close', (code) => {
                    if (code !== 0) {
                        console.error('Python process exited with code:', code);
                        return;
                    }

                    try {
                        const jsonMetadata = JSON.parse(jsonResponse);
                        console.log('Detection result:', jsonMetadata);

                        // Send JSON and annotated image to clients
                        cameraWss.clients.forEach((client) => {
                            if (client !== esp32CameraClient && client.readyState === WebSocket.OPEN) {
                                client.send(JSON.stringify(jsonMetadata)); // Send metadata
                                client.send(annotatedImageBuffer, { binary: true }); // Send annotated image
                            }
                        });
                    } catch (err) {
                        console.error('Error parsing JSON response:', err);
                    }
                });

                pythonProcess.stderr.on('data', (data) => {
                    console.error('Python error:', data.toString());
                });
            } else {
                if (esp32CameraClient && esp32CameraClient.readyState === WebSocket.OPEN) {
                    esp32CameraClient.send(message);
                }
            }
        }
    });

    ws.on('close', () => {
        if (ws === esp32CameraClient) {
            console.log('ESP32 camera client disconnected');
            esp32CameraClient = null;
        }
    });
});