// In public/admin-auth.js
(async function verifyAdmin() {
    const token = localStorage.getItem('token');
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

    // If there's no token, redirect to login immediately.
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    try {
        // We use the dashboard route because it already returns the user's role.
        const response = await fetch(`${API_BASE_URL}/api/user/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            // If the request fails for any reason, redirect to login.
            localStorage.removeItem('token');
            window.location.href = '/login.html';
            return;
        }

        const data = await response.json();

        // This is the key: if the user's role is NOT 'admin', redirect them.
        if (data.user.role !== 'admin') {
            alert('Access denied. You do not have permission to view this page.');
            window.location.href = '/dashboard.html';
        }
        
        // If the role is 'admin', the script does nothing, and the page loads normally.

    } catch (error) {
        window.location.href = '/login.html';
    }
})();