    const loginForm = document.getElementById('login-form');

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // On successful login, save the token
            localStorage.setItem('token', data.token);
            alert('Login successful!');
            // Redirect to the first test page
            window.location.href = '/dashboard.html';
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('An error occurred during login.');
    }
});