// FlowLayer Desktop - Additional Functionality
// =============================================

// Initialize desktop-specific features
document.addEventListener('DOMContentLoaded', () => {
    console.log('FlowLayer Desktop initializing...');

    // Only run on desktop page
    if (!document.body.classList.contains('desktop-body')) return;

    initDesktopNavigation();
    initDesktopScreens();

    console.log('FlowLayer Desktop ready!');
});

// Desktop Sidebar Navigation
function initDesktopNavigation() {
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const screen = item.dataset.screen;
            if (screen) {
                switchDesktopScreen(screen);
                updateSidebarActive(screen);
            }
        });
    });
}

// Update sidebar active state
function updateSidebarActive(screen) {
    document.querySelectorAll('.sidebar-nav-item').forEach(n => n.classList.remove('active'));
    const activeItem = document.querySelector(`.sidebar-nav-item[data-screen="${screen}"]`);
    if (activeItem) activeItem.classList.add('active');
}

// Switch desktop screens
function switchDesktopScreen(screenId) {
    const currentEl = document.querySelector('.desktop-screen.active');
    const nextEl = document.getElementById(`${screenId}Screen`);

    if (!nextEl || currentEl === nextEl) return;

    if (currentEl) {
        currentEl.classList.remove('active');
    }

    nextEl.classList.add('active');

    // Update app state
    if (typeof state !== 'undefined') {
        state.currentScreen = screenId;
    }

    // Initialize map canvases when needed
    if (screenId === 'map') {
        setTimeout(() => {
            initDesktopMap();
        }, 100);
    } else if (screenId === 'nav') {
        setTimeout(() => {
            initDesktopNavMap();
        }, 100);
    }
}

// Initialize desktop screens and their specific handlers
function initDesktopScreens() {
    // Quick action clicks
    document.querySelectorAll('.desktop-quick-actions .quick-action').forEach(action => {
        action.addEventListener('click', () => {
            const target = action.dataset.action;
            if (target === 'route') {
                switchDesktopScreen('destination');
                updateSidebarActive('destination');
            } else if (target === 'map') {
                switchDesktopScreen('map');
                updateSidebarActive('map');
            } else if (target === 'preferences') {
                switchDesktopScreen('preferences');
                updateSidebarActive('preferences');
            }
        });
    });

    // Destination items
    document.querySelectorAll('#destinationScreen .destination-item').forEach(item => {
        item.addEventListener('click', () => {
            const dest = item.dataset.destination;
            if (dest && typeof state !== 'undefined') {
                state.selectedDestination = dest;
                updateDestinationDisplay();
                switchDesktopScreen('routeBuilder');
            }
        });
    });

    // Route builder continue button
    const continueBtn = document.getElementById('routeBuilderContinue');
    if (continueBtn) {
        continueBtn.addEventListener('click', () => {
            switchDesktopScreen('vibe');
            updateSidebarActive('vibe');
        });
    }

    // Route builder skip button
    const skipBtn = document.getElementById('routeBuilderSkip');
    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            if (typeof state !== 'undefined') {
                state.selectedInterests = [];
            }
            switchDesktopScreen('vibe');
            updateSidebarActive('vibe');
        });
    }

    // Vibe card clicks - override to use desktop screen switching
    document.querySelectorAll('#vibeScreen .vibe-card-phone').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't override if clicking on customization chips
            if (e.target.closest('.customize-chip') || e.target.closest('.toggle-switch')) return;

            document.querySelectorAll('#vibeScreen .vibe-card-phone').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');

            if (typeof state !== 'undefined') {
                state.selectedVibe = card.dataset.vibe;
                updateVibeDisplay();
                updateCustomizationsDisplay();
                updateExplorerModeUI();
            }

            setTimeout(() => {
                switchDesktopScreen('map');
                updateSidebarActive('map');
            }, 300);
        });
    });

    // Start button on map
    const startBtn = document.querySelector('#mapScreen .start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            switchDesktopScreen('nav');
        });
    }

    // End navigation button
    const endNavBtn = document.getElementById('endNavBtn');
    if (endNavBtn) {
        endNavBtn.addEventListener('click', () => {
            switchDesktopScreen('home');
            updateSidebarActive('home');
        });
    }

    // Trip items (recent drives)
    document.querySelectorAll('#homeScreen .trip-item').forEach(trip => {
        trip.addEventListener('click', () => {
            const tripVibe = trip.dataset.vibe;
            if (tripVibe && typeof state !== 'undefined') {
                state.selectedVibe = tripVibe;
                updateVibeDisplay();
            }
            switchDesktopScreen('map');
            updateSidebarActive('map');
        });
    });

    // Save preferences button
    const savePrefsBtn = document.getElementById('savePreferencesBtn');
    if (savePrefsBtn) {
        savePrefsBtn.addEventListener('click', () => {
            console.log('Preferences saved');
            switchDesktopScreen('home');
            updateSidebarActive('home');
        });
    }
}

// Desktop Map initialization
function initDesktopMap() {
    const canvas = document.querySelector('#mapScreen canvas');
    if (!canvas) return;

    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = container.offsetWidth * dpr;
    canvas.height = container.offsetHeight * dpr;
    canvas.style.width = container.offsetWidth + 'px';
    canvas.style.height = container.offsetHeight + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Use the existing drawPhoneMap function
    if (typeof drawPhoneMap === 'function') {
        drawPhoneMap(ctx, container.offsetWidth, container.offsetHeight);
    }
}

// Desktop Nav Map initialization
function initDesktopNavMap() {
    const canvas = document.querySelector('#navScreen canvas');
    if (!canvas) return;

    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = container.offsetWidth * dpr;
    canvas.height = container.offsetHeight * dpr;
    canvas.style.width = container.offsetWidth + 'px';
    canvas.style.height = container.offsetHeight + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Use the existing drawNavMap function if available
    if (typeof drawNavMap === 'function') {
        drawNavMap(ctx, container.offsetWidth, container.offsetHeight);
    } else if (typeof drawPhoneMap === 'function') {
        drawPhoneMap(ctx, container.offsetWidth, container.offsetHeight);
    }
}

// Handle window resize
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const activeScreen = document.querySelector('.desktop-screen.active');
        if (activeScreen) {
            if (activeScreen.id === 'mapScreen') {
                initDesktopMap();
            } else if (activeScreen.id === 'navScreen') {
                initDesktopNavMap();
            }
        }
    }, 250);
});
