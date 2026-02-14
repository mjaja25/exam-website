// --- Toast Notification System ---
(function () {
    // Create container once
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:1.5rem;right:1.5rem;z-index:9999;display:flex;flex-direction:column;gap:0.75rem;pointer-events:none;';
    document.body.appendChild(container);

    /**
     * Show a toast notification.
     * @param {string} message - The message to display.
     * @param {'success'|'error'|'info'} type - Toast variant.
     * @param {number} duration - Auto-dismiss in ms (default 3000).
     */
    window.showToast = function (message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = { success: '✓', error: '✕', info: 'ℹ' };
        toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-msg">${message}</span>`;
        container.appendChild(toast);

        // Trigger enter animation
        requestAnimationFrame(() => toast.classList.add('toast-visible'));

        // Auto dismiss
        setTimeout(() => {
            toast.classList.remove('toast-visible');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, duration);
    };
})();
