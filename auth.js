// This script will run on every protected page.

// 1. Get the token from localStorage
const token = localStorage.getItem('token');

// 2. Check if the token exists
if (!token) {
    // If no token is found, the user is not logged in.
    alert('You must be logged in to view this page.');
    // 3. Redirect them to the login page.
    window.location.href = '/login.html';
}