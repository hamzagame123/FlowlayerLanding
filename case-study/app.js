// FlowLayer Case Study - Interactive Elements
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    initCursorGlow();
    initSmoothScroll();
    initScrollAnimations();
    initNavHighlight();
    initParallaxEffects();
    initVibeCardHover();
    initCountUpAnimations();
});

// Cursor Glow Effect
function initCursorGlow() {
    const glow = document.getElementById('cursorGlow');
    if (!glow) return;
    
    let mouseX = 0;
    let mouseY = 0;
    let glowX = 0;
    let glowY = 0;
    
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    
    function animateGlow() {
        glowX += (mouseX - glowX) * 0.08;
        glowY += (mouseY - glowY) * 0.08;
        
        glow.style.left = glowX + 'px';
        glow.style.top = glowY + 'px';
        
        requestAnimationFrame(animateGlow);
    }
    
    animateGlow();
}

// Smooth Scroll for Navigation
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Scroll-triggered Animations
function initScrollAnimations() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };
    
    const animateOnScroll = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                
                // Stagger children animations
                const children = entry.target.querySelectorAll('.stagger-item');
                children.forEach((child, index) => {
                    child.style.animationDelay = `${index * 0.1}s`;
                    child.classList.add('animate-in');
                });
            }
        });
    }, observerOptions);
    
    // Add animation classes to elements
    const animatableElements = document.querySelectorAll(
        '.section-header, .overview-main, .overview-details, .pain-point, ' +
        '.insight-card, .vibe-card-large, .feature-block, .feature-card, ' +
        '.design-block, .process-step, .result-card, .testimonial, ' +
        '.learning-card, .next-item'
    );
    
    animatableElements.forEach(el => {
        el.classList.add('animate-element');
        observerOptions.threshold = 0.15;
        animateOnScroll.observe(el);
    });
    
    // Add CSS for animations
    const style = document.createElement('style');
    style.textContent = `
        .animate-element {
            opacity: 0;
            transform: translateY(30px);
            transition: opacity 0.8s cubic-bezier(0.23, 1, 0.32, 1), 
                        transform 0.8s cubic-bezier(0.23, 1, 0.32, 1);
        }
        
        .animate-element.animate-in {
            opacity: 1;
            transform: translateY(0);
        }
        
        .stagger-item {
            opacity: 0;
            transform: translateY(20px);
            animation: staggerFadeIn 0.6s forwards;
        }
        
        @keyframes staggerFadeIn {
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
}

// Active Navigation Highlight
function initNavHighlight() {
    const sections = document.querySelectorAll('.section[id]');
    const navLinks = document.querySelectorAll('.nav-links a');
    
    function highlightNav() {
        const scrollPos = window.scrollY + 150;
        
        sections.forEach(section => {
            const top = section.offsetTop;
            const bottom = top + section.offsetHeight;
            const id = section.getAttribute('id');
            
            if (scrollPos >= top && scrollPos < bottom) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }
    
    // Add active style
    const style = document.createElement('style');
    style.textContent = `
        .nav-links a.active {
            color: var(--cyan);
        }
        .nav-links a.active::after {
            width: 100%;
        }
    `;
    document.head.appendChild(style);
    
    window.addEventListener('scroll', highlightNav);
    highlightNav();
}

// Parallax Effects
function initParallaxEffects() {
    const floatingIcons = document.querySelectorAll('.float-icon');
    
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        
        floatingIcons.forEach((icon, index) => {
            const speed = 0.1 + (index * 0.05);
            icon.style.transform = `translateY(${scrolled * speed}px) rotate(${scrolled * 0.02}deg)`;
        });
    });
    
    // Parallax on mouse move for hero
    const hero = document.querySelector('.hero');
    if (hero) {
        hero.addEventListener('mousemove', (e) => {
            const { clientX, clientY } = e;
            const { width, height } = hero.getBoundingClientRect();
            
            const xPercent = (clientX / width - 0.5) * 2;
            const yPercent = (clientY / height - 0.5) * 2;
            
            floatingIcons.forEach((icon, index) => {
                const depth = 10 + (index * 5);
                icon.style.transform = `translate(${xPercent * depth}px, ${yPercent * depth}px)`;
            });
        });
    }
}

// Vibe Card Hover Effects
function initVibeCardHover() {
    const vibeCards = document.querySelectorAll('.vibe-card-large');
    
    vibeCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            const color = getComputedStyle(card).getPropertyValue('--vibe-color');
            card.style.boxShadow = `0 20px 50px ${color}22`;
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.boxShadow = '';
        });
    });
}

// Count-up Animations for Statistics
function initCountUpAnimations() {
    const statElements = document.querySelectorAll('.stat-value, .insight-stat, .result-value');
    
    const countObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
                entry.target.classList.add('counted');
                animateCount(entry.target);
            }
        });
    }, { threshold: 0.5 });
    
    statElements.forEach(el => countObserver.observe(el));
}

function animateCount(element) {
    const text = element.textContent;
    const hasPercent = text.includes('%');
    const hasX = text.includes('x');
    const hasSlash = text.includes('/');
    
    let endValue;
    let suffix = '';
    
    if (hasSlash) {
        // Handle "4.8/5" format
        const parts = text.split('/');
        endValue = parseFloat(parts[0]);
        suffix = '/' + parts[1];
    } else if (hasPercent) {
        endValue = parseInt(text);
        suffix = '%';
    } else if (hasX) {
        endValue = parseFloat(text);
        suffix = 'x';
    } else {
        endValue = parseInt(text);
    }
    
    if (isNaN(endValue)) return;
    
    let startValue = 0;
    const duration = 2000;
    const startTime = performance.now();
    
    function updateCount(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        
        const currentValue = startValue + (endValue - startValue) * eased;
        
        if (hasSlash || hasX) {
            element.textContent = currentValue.toFixed(1) + suffix;
        } else {
            element.textContent = Math.round(currentValue) + suffix;
        }
        
        if (progress < 1) {
            requestAnimationFrame(updateCount);
        }
    }
    
    requestAnimationFrame(updateCount);
}

// Navigation background on scroll
function initNavBackground() {
    const nav = document.querySelector('.main-nav');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.style.background = 'rgba(5, 5, 8, 0.95)';
        } else {
            nav.style.background = 'rgba(5, 5, 8, 0.8)';
        }
    });
}

initNavBackground();

// Add loading animation
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
});

// Demo iframe interactions
const demoFrame = document.getElementById('demoFrame');
if (demoFrame) {
    demoFrame.addEventListener('load', () => {
        console.log('FlowLayer demo loaded successfully');
    });
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    // Press 'D' to jump to demo
    if (e.key === 'd' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
        const demo = document.getElementById('demo');
        if (demo) {
            demo.scrollIntoView({ behavior: 'smooth' });
        }
    }
});

// Mobile menu toggle (if needed)
function initMobileMenu() {
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            menuToggle.classList.toggle('active');
        });
    }
}

// Performance optimization: Debounce scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function for performance
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Preload images for smoother experience
function preloadImages() {
    const images = [
        // Add any images that need preloading
    ];
    
    images.forEach(src => {
        const img = new Image();
        img.src = src;
    });
}

preloadImages();

// Console branding
console.log('%c FlowLayer Case Study ', 
    'background: linear-gradient(135deg, #00f5d4, #9b5de5); color: #050508; font-size: 20px; font-weight: bold; padding: 10px 20px; border-radius: 8px;');
console.log('%c Route by How You Feel 🌊', 
    'color: #00f5d4; font-size: 14px; padding: 5px;');

