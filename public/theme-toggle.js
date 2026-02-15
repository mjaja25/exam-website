// Theme Toggle System - Light/Dark Mode
(function() {
    'use strict';
    
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
        
        const slider = document.createElement('div');
        slider.className = 'theme-toggle-slider';
        
        const icon = document.createElement('span');
        icon.className = 'theme-toggle-icon';
        icon.textContent = getSavedTheme() === 'dark' ? '🌙' : '☀️';
        
        slider.appendChild(icon);
        toggle.appendChild(slider);
        
        toggle.addEventListener('click', toggleTheme);
        
        return toggle;
    };
    
    // Add toggle button to header
    const addToggleToHeader = () => {
        const nav = document.querySelector('.dashboard-nav, .test-header nav, .admin-header nav');
        if (nav) {
            const toggle = createToggleButton();
            // Insert before logout button or at the end
            const logoutBtn = nav.querySelector('#logout-btn');
            if (logoutBtn) {
                nav.insertBefore(toggle, logoutBtn);
            } else {
                nav.appendChild(toggle);
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
    
    /* Prevent flash of unstyled content */
    html:not([data-theme]) {
        visibility: hidden;
    }
    
    html[data-theme] {
        visibility: visible;
    }
`;
document.head.appendChild(style);
