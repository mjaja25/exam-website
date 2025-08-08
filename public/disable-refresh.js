// This function will run when the user tries to refresh or close the page
const handleBeforeUnload = (event) => {
    // Standard practice to prevent default behavior
    event.preventDefault();
    // Most browsers will show a generic confirmation message
    event.returnValue = '';
};

// Add the event listener when the page loads
window.addEventListener('beforeunload', handleBeforeUnload);