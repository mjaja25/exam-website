// Theme Toggle System - Light/Dark Mode
(function () {
    'use strict';

    // IMPORTANT: Hide page immediately to prevent flash
    document.documentElement.style.visibility = 'hidden';

    // Get saved theme or default to system preference
    const getSavedTheme = () => {
        const saved = localStorage.getItem('theme');
        if (saved) return saved;

        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    };

    // Apply theme
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        // Make page visible once theme is applied
        document.documentElement.style.visibility = 'visible';

        // Update toggle button if it exists
        const toggle = document.querySelector('.theme-toggle');
        if (toggle) {
            const icon = toggle.querySelector('.theme-toggle-icon');
            if (icon) {
                icon.textContent = theme === 'dark' ? '🌙' : '☀️';
            }
        }

        // Dispatch event for other scripts
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    };

    // Toggle theme
    const toggleTheme = () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'light' ? 'dark' : 'light';
        applyTheme(next);

        // Add animation class
        document.body.classList.add('theme-transitioning');
        setTimeout(() => {
            document.body.classList.remove('theme-transitioning');
        }, 300);
    };

    // Initialize theme on page load
    const initTheme = () => {
        const theme = getSavedTheme();
        applyTheme(theme);
    };

    // Create theme toggle button
    const createToggleButton = () => {
        const toggle = document.createElement('button');
        toggle.className = 'theme-toggle';
        toggle.setAttribute('aria-label', 'Toggle theme');
        toggle.setAttribute('title', 'Toggle light/dark mode');
        toggle.innerHTML = `
            <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
        `;
        toggle.addEventListener('click', toggleTheme);

        return toggle;
    };

    // Add toggle button to dashboard header only
    const addToggleToHeader = () => {
        // Only add toggle to dashboard page (not admin or other pages)
        const container = document.querySelector('.dashboard-page .dashboard-nav');

        if (container) {
            // Check if one already exists
            if (container.querySelector('.theme-toggle')) return;

            const toggle = createToggleButton();

            // specific placement logic
            const logoutBtn = container.querySelector('#logout-btn');
            const userProfile = container.querySelector('.user-profile-widget');

            if (logoutBtn) {
                container.insertBefore(toggle, logoutBtn);
            } else if (userProfile) {
                container.insertBefore(toggle, userProfile);
            } else {
                container.appendChild(toggle);
            }
        }
    };

    // Listen for system theme changes
    const watchSystemTheme = () => {
        if (window.matchMedia) {
            const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
            darkModeQuery.addEventListener('change', (e) => {
                // Only auto-switch if user hasn't manually set a preference
                if (!localStorage.getItem('theme')) {
                    applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    };

    // Keyboard shortcut (Ctrl/Cmd + Shift + D)
    const addKeyboardShortcut = () => {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                toggleTheme();

                // Show toast notification
                if (typeof showToast === 'function') {
                    const theme = document.documentElement.getAttribute('data-theme');
                    showToast(`Switched to ${theme} mode`, 'success');
                }
            }
        });
    };

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initTheme();
            addToggleToHeader();
            watchSystemTheme();
            addKeyboardShortcut();
        });
    } else {
        initTheme();
        addToggleToHeader();
        watchSystemTheme();
        addKeyboardShortcut();
    }

    // Expose functions globally
    window.toggleTheme = toggleTheme;
    window.setTheme = applyTheme;
    window.getTheme = () => document.documentElement.getAttribute('data-theme') || 'light';

})();

// Add smooth transition class
const style = document.createElement('style');
style.textContent = `
    body.theme-transitioning * {
        transition-duration: 0.3s !important;
    }
`;
document.head.appendChild(style);
