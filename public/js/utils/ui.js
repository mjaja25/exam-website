export const ui = {
    showToast(message, type = 'info') {
        // Reuse existing toast logic if present, or create a simple one
        // Checks if 'showToast' is globally available (from toast.js)
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            alert(`${type.toUpperCase()}: ${message}`);
        }
    },

    confirm(message) {
        return window.confirm(message);
    },

    // Helper to get element by ID with type check
    getElement(id) {
        const el = document.getElementById(id);
        if (!el) console.warn(`Element with ID '${id}' not found.`);
        return el;
    }
};
