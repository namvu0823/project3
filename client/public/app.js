
const ws = new WebSocket(`ws://${window.location.hostname}:3001`); // địa chỉ IP của laptop
const streamImage = document.getElementById('cameraStream');
const toggleButton = document.getElementById('toggleButton');
const sensorStatus = document.getElementById('sensorStatus');
const time=document.getElementById('time');
const defaultImage ='default_image.jpg';

let isStreaming = false;
let previousBlobUrl = null;

//xử lý khi click camera
toggleButton.addEventListener('click', () => {
    if (ws.readyState === WebSocket.OPEN) {
        isStreaming = !isStreaming;
        toggleButton.textContent = isStreaming 
            ? 'Tắt camera' 
            : 'Bật camera';
        
        ws.send(isStreaming ? 'camera_enable' : 'camera_disable');

        if (!isStreaming) {
            
            if (previousBlobUrl) {
                URL.revokeObjectURL(previousBlobUrl); // Giải phóng URL cũ
                previousBlobUrl = null;
            }
            streamImage.src = defaultImage;
        }
    } else {
        alert('WebSocket not connected. Please wait or reload the page.');
    }
});

ws.onmessage = (event) => {
    //xử lý streaming
    if (event.data instanceof Blob)//nếu là data dạng nhị phân
    {
        if (previousBlobUrl) {
            URL.revokeObjectURL(previousBlobUrl); // Giải phóng URL cũ
        }
        // Tạo URL từ Blob và gắn vào thẻ img
        previousBlobUrl = URL.createObjectURL(event.data);
        streamImage.src = previousBlobUrl;
    } 

    else {
        const sensorData = JSON.parse(event.data);
        if (sensorData.hasOwnProperty('gas') && sensorData.hasOwnProperty('flame')) {
            updateSensorStatus(sensorData); // Cập nhật giao diện
        } 
    }
};

function updateSensorStatus(sensorData) {
    gasStatus.textContent = sensorData.gas ? 'Phát hiện khí ga' : 'Không phát hiện khí ga';
    flameStatus.textContent = sensorData.flame ? 'Phát hiện lửa' : 'Không phát hiện ngọn lửa';

    // Cập nhật màu sắc trạng thái
    gasStatus.style.color = sensorData.gas ? 'orange' : 'green';
    flameStatus.style.color = sensorData.flame ? 'orange' : 'green';

    // Cập nhật thông báo trạng thái chung
    let statusMessage ='Hệ thống an toàn';
    let statusColor = 'green';

    if (sensorData.gas && sensorData.flame) {
        statusMessage = 'Phát hiện có lửa, có khói!';
        statusColor = 'red';
        //alert('Phát hiện có lửa và khói, có nguy cơ cháy cao!');
    } else if (sensorData.gas) {
        statusMessage = 'Phát hiện có khói!';
        statusColor = 'orange';
        //alert('Phát hiện có khói, có nguy cơ xảy ra cháy!');
    } else if (sensorData.flame) {
        statusMessage = 'Phát hiện có lửa!';
        statusColor = 'orange';
        //alert('Phát hiện có lửa, có nguy cơ xảy ra cháy!');
    }
    

    // Cập nhật trạng thái vào giao diện
    sensorStatus.textContent = `Trạng thái: ${statusMessage}`;
    sensorStatus.style.color = statusColor;
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    time.textContent = ' Thời gian: '+timeString;

}
ws.onopen = () => {
    console.log('WebSocket connected');
};

ws.onclose = () => {
    console.log('WebSocket disconnected');
    alert('WebSocket connection lost. Please reload the page.');
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};
