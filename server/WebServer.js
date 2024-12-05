const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws'); 

const PORT = 3001;

let esp32Client=null;
const webClients= new Set();

// Tạo HTTP Server
const server = http.createServer((req, res) => {
    if (req.method === 'GET') {
        if (req.url === '/') {
            // index.html
            fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal Server Error');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data);
                }
            });
        } else if (req.url === '/app.js') {
            // app.js
            fs.readFile(path.join(__dirname, 'app.js'), (err, data) => {
                if (err) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('File not found');
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/javascript' });
                    res.end(data);
                }
            });
        } 
        else if (req.url === '/style.css') {
            // style.css
            fs.readFile(path.join(__dirname, 'style.css'), (err, data) => {
                if (err) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('File not found');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/css' });
                    res.end(data);
                }
            });
        }else {
            // handle error
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    }
});

// Tạo WebSocket Server
const wss = new WebSocket.Server({ server });
//khi client kết nối

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    ws.on('message', (message) => {
       
        if (!esp32Client && message.toString() === 'ESP32') {
            // Xác định client này là ESP32
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
            // Nếu nhận dữ liệu từ Web client
            console.log('Message from Web client:', message.toString());

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


// run server HTTP và WebSocket
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`WebSocket server running on ws://localhost:${PORT}`);
});
