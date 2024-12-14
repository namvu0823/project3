
const express =require('express');
const path = require('path');
const bodyParser=require('body-parser');
const WebSocket = require('ws'); 
const app=express();

const {MongoClient} = require('mongodb');
const uri="mongodb+srv://vuvannamb1:hxruOlLP2VlAsXK0@cluster0.2kdmx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);


const PORT = 3001;
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
const server=app.listen(PORT,()=>{
    console.log(`Server running at http://localhost:${PORT}`);
});

let esp32Client=null;
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

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    

        console.log('New WebSocket connection');

        ws.on('message', (message) => {   
            if (!esp32Client && message.toString() === 'ESP32') {
                esp32Client = ws;
                console.log('ESP32 connected');
                return;
            }

            if (ws === esp32Client) //nếu là esp32
            {
                if (message instanceof Buffer) {
                    
                    if(message.length > 100){
                        console.log('Images data:', message.length, 'bytes')
                        // Broadcast tới tất cả client
                        wss.clients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(message, { binary: true });
                            }
                        });
                    } 
                    else {
                        try{
                            const sensorData=JSON.parse(message.toString());
                                wss.clients.forEach(client => {if (client.readyState === WebSocket.OPEN){
                                    client.send(JSON.stringify(sensorData));
                                }
                            });
                            console.log('Sensor data: ', sensorData);
                        }
                        catch(error){
                            console.error('Invalid data:', message.toString());
                        }
                    }
                }
            } 

            else {
    
                if (esp32Client && esp32Client.readyState === WebSocket.OPEN) {
                    // Gửi lệnh từ Web client tới ESP32
                    esp32Client.send(message.toString());
                }
            }

        });

    ws.on('close', () => {
        if (ws === esp32Client) {
            console.log('ESP32 disconnected');
            esp32Client = null;
        } else {
            console.log('Web client disconnected');
            webClients.delete(ws);
        }
    });

    if (ws !== esp32Client) {
        webClients.add(ws);
    }
    
});

