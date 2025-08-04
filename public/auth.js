// This is the new, more secure auth.js

(async function verifyUser() {
    const token = localStorage.getItem('token');

    // If there's no token at all, redirect immediately.
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // If a token exists, ask the server to verify it.
    try {
        const response = await fetch('/api/auth/verify-token', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // If the response is not 'ok' (e.g., 401 Unauthorized), the token is invalid.
        if (!response.ok) {
            // Remove the invalid token and redirect to login
            localStorage.removeItem('token');
            window.location.href = '/login.html';
        }
        // If the response is 'ok', the token is valid and the script does nothing,
        // allowing the user to stay on the page.

    } catch (error) {
        // If there's a network error, it's safer to redirect to login.
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    }
})();