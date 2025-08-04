const signupForm = document.getElementById('signup-form');

signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.status === 201) {
            alert(data.message);
            window.location.href = '/login.html'; // Redirect to login page on success
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Signup error:', error);
        alert('An error occurred during signup.');
    }
});