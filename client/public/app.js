
const sensorWs = new WebSocket(`ws://${window.location.hostname}:3001`); // địa chỉ IP của laptop
const cameraWs = new WebSocket(`ws://${window.location.hostname}:3002`); // địa chỉ IP của laptop

const streamImage = document.getElementById('cameraStream');
const toggleButton = document.getElementById('toggleButton');
const sensorStatus = document.getElementById('sensorStatus');
const time=document.getElementById('time');
const defaultImage ='default_image.jpg';

let isStreaming = false;
let previousBlobUrl = null;

//xử lý khi click camera
toggleButton.addEventListener('click', () => {
    if (cameraWs.readyState === WebSocket.OPEN) {
        isStreaming = !isStreaming;
        toggleButton.textContent = isStreaming 
            ? 'Tắt camera' 
            : 'Bật camera';
        
        cameraWs.send(isStreaming ? 'camera_enable' : 'camera_disable');

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

sensorWs.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        if (sensorData.hasOwnProperty('gas') && sensorData.hasOwnProperty('flame')) {
            updateSensorStatus(data);
        }
        } catch (error) {
            console.error('Error parsing JSON:', error);
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

cameraWs.onopen = () => {
    console.log('WebSocket connected');
};

cameraWs.onclose = () => {
    console.log('WebSocket disconnected');
    if (isStreaming) {
        alert('WebSocket connection lost. Please reload the page.');
        streamImage.src = defaultImage;
        isStreaming = false;
        toggleButton.textContent = 'Bật camera';
    }
};

cameraWs.onerror = (error) => {
    console.error('WebSocket error:', error);
};

sensorWs.onopen = () => {
    console.log('Kết nối sensor WebSocket thành công');
};

sensorWs.onclose = () => {
    console.log('Mất kết nối sensor WebSocket');
    alert('Mất kết nối với cảm biến. Vui lòng tải lại trang.');
};

sensorWs.onerror = (error) => {
    console.error('Lỗi sensor WebSocket:', error);
};

// Hàm kiểm tra trạng thái kết nối
function checkConnections() {
    if (sensorWs.readyState !== WebSocket.OPEN || cameraWs.readyState !== WebSocket.OPEN) {
        sensorStatus.textContent = 'Trạng thái: Mất kết nối với thiết bị';
        sensorStatus.style.color = 'red';
    }
}

// Kiểm tra kết nối định kỳ
setInterval(checkConnections, 5000);