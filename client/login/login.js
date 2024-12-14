document.getElementById('login').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password= document.getElementById('password').value;

    const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({email, password})
    });

    const data = await response.json();
    if (response.ok) {
        //alert('Đăng nhập thành công ' + data.user_id);
        window.location.href = '/app'; // Chuyển đến giao diện chính
    } else {
        alert('Error: ' + data.error);
    }
});
