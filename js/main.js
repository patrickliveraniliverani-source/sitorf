/* ========================================
   R.F. RESINA FORLIVESE — MAIN JS
   GSAP + ScrollTrigger + Lenis + All Animations
   ======================================== */

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
    initLenis();
    initScrollProgress();
    initCustomCursor();
    initHeader();
    initMobileMenu();
    initPageTransitions();
    initMarquee();

    // Wait for fonts & layout
    setTimeout(() => {
        initGSAP();
        initCounters();
        initMagneticButtons();
        initRevealLines();
    }, 100);
});

// ========== LENIS SMOOTH SCROLL ==========
let lenis;
function initLenis() {
    if (typeof Lenis === 'undefined') return;
    lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        smoothWheel: true,
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Connect Lenis to GSAP ScrollTrigger
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => { lenis.raf(time * 1000); });
        gsap.ticker.lagSmoothing(0);
    }
}

// ========== SCROLL PROGRESS BAR ==========
function initScrollProgress() {
    const bar = document.querySelector('.scroll-progress');
    if (!bar) return;

    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        bar.style.width = progress + '%';
    });
}

// ========== CUSTOM CURSOR ==========
function initCustomCursor() {
    const cursor = document.querySelector('.custom-cursor');
    if (!cursor || window.matchMedia('(pointer: coarse)').matches) return;

    let mouseX = 0, mouseY = 0;
    let cursorX = 0, cursorY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        // Detect dark backgrounds under cursor
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el) {
            const isDark = el.closest('.cta-section, .page-hero, [style*="dark-navy"], .site-footer, .footer-bottom');
            if (isDark) {
                cursor.classList.add('cursor-light');
            } else {
                cursor.classList.remove('cursor-light');
            }
        }
    });

    function animateCursor() {
        cursorX += (mouseX - cursorX) * 0.25;
        cursorY += (mouseY - cursorY) * 0.25;
        cursor.style.left = cursorX + 'px';
        cursor.style.top = cursorY + 'px';
        requestAnimationFrame(animateCursor);
    }
    animateCursor();

    // Hover effects
    const interactives = document.querySelectorAll('a, button, input, textarea, select, .card, .service-card, .value-card, .value-pillar');
    interactives.forEach(el => {
        el.addEventListener('mouseenter', () => cursor.classList.add('active'));
        el.addEventListener('mouseleave', () => cursor.classList.remove('active'));
    });
}

// ========== HEADER / SCROLL ==========
function initHeader() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    const scrollTopBtn = document.querySelector('.scroll-top-btn');

    function onScroll() {
        const scrollY = window.scrollY;
        if (scrollY > 60) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        if (scrollTopBtn) {
            if (scrollY > 500) {
                scrollTopBtn.classList.add('visible');
            } else {
                scrollTopBtn.classList.remove('visible');
            }
        }
    }

    window.addEventListener('scroll', onScroll);
    onScroll(); // initial check

    // Scroll to top
    if (scrollTopBtn) {
        scrollTopBtn.addEventListener('click', () => {
            if (lenis) { lenis.scrollTo(0); }
            else { window.scrollTo({ top: 0, behavior: 'smooth' }); }
        });
    }
}

// ========== MOBILE MENU ==========
function initMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    const mobileNav = document.querySelector('.mobile-nav');
    if (!hamburger || !mobileNav) return;

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        mobileNav.classList.toggle('open');
        document.body.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : '';

        // Stagger mobile nav links
        if (mobileNav.classList.contains('open')) {
            const links = mobileNav.querySelectorAll('a');
            links.forEach((link, i) => {
                link.style.transitionDelay = (i * 0.08) + 's';
            });
        }
    });

    // Close on link click
    mobileNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('open');
            mobileNav.classList.remove('open');
            document.body.style.overflow = '';
        });
    });
}

// ========== PAGE TRANSITIONS ==========
function initPageTransitions() {
    const overlay = document.querySelector('.page-transition');
    if (!overlay) return;

    // Fade in on page load
    overlay.style.transformOrigin = 'top';
    overlay.style.transform = 'scaleY(1)';

    gsap.to(overlay, {
        scaleY: 0,
        duration: 0.5,
        ease: 'power2.inOut',
        delay: 0.1,
    });

    // Intercept navigation links
    document.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href');
        // Only intercept local .html links, not anchors or external
        if (href && (href.endsWith('.html') || href.includes('.html?')) && !href.startsWith('http') && !href.startsWith('#')) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                overlay.style.transformOrigin = 'bottom';
                gsap.to(overlay, {
                    scaleY: 1,
                    duration: 0.3,
                    ease: 'power2.inOut',
                    onComplete: () => { window.location.href = href; }
                });
            });
        }
    });
}

// ========== GSAP SCROLL ANIMATIONS ==========
function initGSAP() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    // --- Page Load Cascade ---
    const loadTl = gsap.timeline();

    const logoEl = document.querySelector('.logo');
    if (logoEl) {
        loadTl.from(logoEl, { opacity: 0, y: -20, duration: 0.6, ease: 'power2.out' });
    }

    const navItems = document.querySelectorAll('.nav-links > a, .nav-links .nav-link-parent');
    if (navItems.length) {
        loadTl.from(navItems, { opacity: 0, y: -10, stagger: 0.05, duration: 0.4, ease: 'power2.out' }, '-=0.3');
    }

    const headerCta = document.querySelector('.header-cta');
    if (headerCta) {
        loadTl.from(headerCta, { opacity: 0, scale: 0.9, duration: 0.4, ease: 'back.out(1.7)' }, '-=0.2');
    }

    // --- Hero Content ---
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
        loadTl.from(heroContent.children, {
            opacity: 0, y: 40, stagger: 0.15, duration: 0.8, ease: 'power2.out'
        }, '-=0.3');
    }

    // Hero image clip-path reveal
    const heroImg = document.querySelector('.hero-img');
    if (heroImg) {
        loadTl.from(heroImg, {
            clipPath: 'circle(0% at 50% 50%)',
            duration: 1.2,
            ease: 'power3.inOut',
        }, '-=0.8');
        heroImg.style.clipPath = 'circle(100% at 50% 50%)';
    }

    // --- Page Hero for inner pages ---
    const pageHero = document.querySelector('.page-hero');
    if (pageHero) {
        loadTl.from(pageHero.querySelectorAll('h1, .subtitle, .breadcrumb'), {
            opacity: 0, y: 30, stagger: 0.1, duration: 0.6, ease: 'power2.out'
        }, '-=0.4');
    }

    // --- Split Text Animation ---
    document.querySelectorAll('.split-text').forEach(el => {
        const text = el.textContent;
        const words = text.split(' ');
        el.innerHTML = words.map(word =>
            `<span class="split-text-line"><span class="word">${word}</span></span>`
        ).join(' ');

        gsap.to(el.querySelectorAll('.word'), {
            y: 0,
            stagger: 0.05,
            duration: 0.8,
            ease: 'power2.out',
            scrollTrigger: {
                trigger: el,
                start: 'top 85%',
                toggleActions: 'play none none none',
            }
        });
    });

    // --- Scroll Reveal: fade-up ---
    gsap.utils.toArray('.reveal').forEach(el => {
        gsap.from(el, {
            opacity: 0, y: 40,
            duration: 0.8,
            ease: 'power2.out',
            scrollTrigger: {
                trigger: el,
                start: 'top 88%',
                toggleActions: 'play none none none',
            }
        });
    });

    // --- Scroll Reveal: scale in ---
    gsap.utils.toArray('.reveal-scale').forEach(el => {
        gsap.from(el, {
            opacity: 0, scale: 0.85,
            duration: 0.9,
            ease: 'power2.out',
            scrollTrigger: {
                trigger: el,
                start: 'top 85%',
                toggleActions: 'play none none none',
            }
        });
    });

    // --- Stagger Cards ---
    document.querySelectorAll('.stagger-cards').forEach(container => {
        const cards = container.children;
        gsap.from(cards, {
            opacity: 0, y: 50,
            stagger: 0.15,
            duration: 0.7,
            ease: 'power2.out',
            scrollTrigger: {
                trigger: container,
                start: 'top 85%',
                toggleActions: 'play none none none',
            }
        });
    });

    // --- Parallax images ---
    gsap.utils.toArray('.parallax').forEach(el => {
        gsap.to(el, {
            y: -60,
            ease: 'none',
            scrollTrigger: {
                trigger: el,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 1,
            }
        });
    });

    // --- Content Blocks ---
    gsap.utils.toArray('.content-block').forEach(block => {
        const text = block.querySelector('.content-block-text');
        const img = block.querySelector('.content-block-img');

        if (text) {
            gsap.from(text, {
                opacity: 0, x: -40,
                duration: 0.8,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: block,
                    start: 'top 80%',
                    toggleActions: 'play none none none',
                }
            });
        }
        if (img) {
            gsap.from(img, {
                opacity: 0, x: 40, scale: 0.9,
                duration: 0.8,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: block,
                    start: 'top 80%',
                    toggleActions: 'play none none none',
                }
            });
        }
    });

    // --- Sector Cards Animation (Diagonal Converge, Pair by Pair) ---
    // Cards are in a 2-column grid. Each pair (row) animates together.
    // Left card: enters from bottom-left (x: -120, y: 120)
    // Right card: enters from bottom-right (x: +120, y: 120)
    // They converge diagonally to their final position.
    // Each pair triggers independently as it enters the viewport.
    const sectorCards = gsap.utils.toArray('.sector-anim');
    if (sectorCards.length) {
        // Group into pairs (rows of 2)
        for (let i = 0; i < sectorCards.length; i += 2) {
            const leftCard = sectorCards[i];
            const rightCard = sectorCards[i + 1];
            if (!leftCard) continue;

            // Use the left card as the scroll trigger anchor for the pair
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: leftCard,
                    start: 'top 85%',
                    toggleActions: 'play none none none'
                }
            });

            // Left card: diagonal from bottom-left
            tl.from(leftCard, {
                opacity: 0,
                x: -60,
                y: 60,
                duration: 0.8,
                ease: 'power2.out',
            }, 0);

            // Right card: diagonal from bottom-right (same timeline = same trigger)
            if (rightCard) {
                tl.from(rightCard, {
                    opacity: 0,
                    x: 60,
                    y: 60,
                    duration: 0.8,
                    ease: 'power2.out',
                }, 0); // Start at same time as left card
            }
        }
    }
}

// ========== COUNTER ANIMATION ==========
function initCounters() {
    document.querySelectorAll('[data-count]').forEach(el => {
        const target = parseInt(el.dataset.count);
        const suffix = el.dataset.suffix || '';

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                animateCounter(el, 0, target, suffix, 2000);
                observer.disconnect();
            }
        }, { threshold: 0.5 });

        observer.observe(el);
    });
}

function animateCounter(el, start, end, suffix, duration) {
    let startTime;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        // easeOutExpo
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = Math.floor(eased * (end - start) + start);
        el.textContent = current + suffix;

        if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}

// ========== MAGNETIC BUTTONS ==========
function initMagneticButtons() {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    document.querySelectorAll('.btn, .header-cta').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0, 0)';
            btn.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        });

        btn.addEventListener('mouseenter', () => {
            btn.style.transition = 'none';
        });
    });
}

// ========== REVEAL LINES ==========
function initRevealLines() {
    document.querySelectorAll('.reveal-line').forEach(line => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                line.classList.add('active');
                observer.disconnect();
            }
        }, { threshold: 0.5 });
        observer.observe(line);
    });
}

// ========== MARQUEE (fallback if CSS isn't enough) ==========
function initMarquee() {
    // CSS animation handles the infinite scroll
    // This just ensures duplication for seamless loop
    document.querySelectorAll('.marquee-track').forEach(track => {
        if (track.children.length < 20) {
            const content = track.innerHTML;
            track.innerHTML = content + content;
        }
    });
}

// ========== 3D TILT ON CARDS ==========
document.addEventListener('mousemove', (e) => {
    document.querySelectorAll('.tilt-card').forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;

        if (x > -0.5 && x < 0.5 && y > -0.5 && y < 0.5) {
            card.style.transform = `perspective(800px) rotateX(${y * -8}deg) rotateY(${x * 8}deg) translateY(-4px)`;
        }
    });
});

document.addEventListener('mouseleave', () => {
    document.querySelectorAll('.tilt-card').forEach(card => {
        card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) translateY(0)';
    });
}, true);
