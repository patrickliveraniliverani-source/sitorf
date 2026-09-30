/* ========================================
   R.F. RESINA FORLIVESE — MAIN JS
   GSAP + ScrollTrigger + Custom Smooth Scroll
   ======================================== */

// Mark that JS is running so CSS can safely hide elements before reveal.
// Without JS the .js-scoped hidden styles never apply → content stays visible.
document.documentElement.classList.add('js');

// Register ScrollTrigger immediately so it's ready before any scroll fires
if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
}

// ========== INITIALIZATION ==========
// Ogni init gira isolato: se uno solleva un'eccezione (una CDN che non risponde,
// un browser senza una API) gli altri devono partire lo stesso. Prima erano in
// fila nello stesso handler e il primo errore zittiva tutto quello che seguiva.
function avvia(nome, fn) {
    try {
        fn();
    } catch (err) {
        console.error(`[main.js] ${nome} non è partita:`, err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    avvia('initSmoothScroll', initSmoothScroll);
    avvia('initScrollProgress', initScrollProgress);
    avvia('initCustomCursor', initCustomCursor);
    avvia('initHeader', initHeader);
    avvia('initMobileMenu', initMobileMenu);
    avvia('initSagomeTracciate', initSagomeTracciate);
    avvia('initPageTransitions', initPageTransitions);
    avvia('initMarquee', initMarquee);
    avvia('initSectorReveal', initSectorReveal);
    avvia('initRevealAnimations', initRevealAnimations);

    // Wait for fonts & layout before calculating trigger positions
    setTimeout(() => {
        avvia('initGSAP', initGSAP);
        avvia('initCounters', initCounters);
        avvia('initMagneticButtons', initMagneticButtons);
        avvia('initRevealLines', initRevealLines);
    }, 100);
});

// ========== REVEAL ANIMATIONS (IntersectionObserver) ==========
// All scroll-reveal effects use IO instead of GSAP ScrollTrigger so they fire
// reliably with any scroll mechanism and handle the "already in viewport on
// load" case correctly.
function initRevealAnimations() {
    if (!('IntersectionObserver' in window)) {
        document.querySelectorAll('.reveal, .reveal-scale').forEach(el => el.classList.add('revealed'));
        document.querySelectorAll('.stagger-cards').forEach(c => {
            Array.from(c.children).forEach(ch => ch.classList.add('revealed'));
        });
        return;
    }

    const opts = { threshold: 0.1, rootMargin: '0px 0px -6% 0px' };

    // .reveal — fade up
    const ioReveal = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); ioReveal.unobserve(e.target); } });
    }, opts);
    document.querySelectorAll('.reveal').forEach(el => ioReveal.observe(el));

    // .reveal-scale — scale in
    const ioScale = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); ioScale.unobserve(e.target); } });
    }, opts);
    document.querySelectorAll('.reveal-scale').forEach(el => ioScale.observe(el));

    // .stagger-cards — children stagger in sequence
    const ioStagger = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                Array.from(e.target.children).forEach((child, i) => {
                    setTimeout(() => child.classList.add('revealed'), i * 120);
                });
                ioStagger.unobserve(e.target);
            }
        });
    }, opts);
    document.querySelectorAll('.stagger-cards').forEach(c => ioStagger.observe(c));

    // Rete di sicurezza.
    // Da quando la regola `.js .reveal { opacity: 0 }` è tornata a funzionare
    // (prima un commento CSS malformato la faceva scartare dal parser, quindi
    // il contenuto restava visibile per conto suo) questi elementi dipendono
    // davvero dall'observer. Se per qualsiasi ragione non scatta — pagina
    // aperta in una tab di sfondo, rendering sospeso, un bug del browser —
    // il testo resterebbe invisibile per sempre. Qui, dopo tre secondi,
    // controlliamo se almeno un elemento in campo si è rivelato: se no,
    // l'observer non sta lavorando e si mostra tutto senza animazione.
    setTimeout(() => {
        const candidati = document.querySelectorAll('.reveal, .reveal-scale');
        if (!candidati.length) return;

        const inCampo = Array.from(candidati).filter(el => {
            const r = el.getBoundingClientRect();
            return r.top < window.innerHeight && r.bottom > 0;
        });
        // Nessun elemento è ancora arrivato in campo: non c'è niente da
        // diagnosticare, l'observer avrà il suo momento più giù nella pagina.
        if (!inCampo.length) return;
        if (inCampo.some(el => el.classList.contains('revealed'))) return;

        console.warn('[main.js] IntersectionObserver silenzioso: contenuto mostrato senza animazione.');
        candidati.forEach(el => el.classList.add('revealed'));
        document.querySelectorAll('.stagger-cards').forEach(c => {
            Array.from(c.children).forEach(ch => ch.classList.add('revealed'));
        });
    }, 3000);
}

// ========== SECTOR CARDS REVEAL ==========
// IntersectionObserver-based reveal — independent of scroll mechanism and of
// ScrollTrigger's refresh timing, so cards always appear (even if already in
// view on load). CSS handles the diagonal-converge transition.
function initSectorReveal() {
    const cards = document.querySelectorAll('.sector-anim');
    if (!cards.length) return;

    if (!('IntersectionObserver' in window)) {
        cards.forEach(c => c.classList.add('revealed'));
        return;
    }

    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    cards.forEach(c => io.observe(c));
}

// ========== SAGOME TRACCIATE ==========
// Il contorno si completa quando la sezione entra in campo, come se qualcuno
// seguisse il bordo della dima col pennarello prima del taglio.
// Nessuna dipendenza da GSAP: qui finisce solo la lunghezza del tracciato in una
// custom property, il resto lo fa la transition CSS. Senza JS `--len` non viene
// mai scritta, `stroke-dasharray` decade e il contorno resta pieno — non esiste
// uno stato in cui il disegno rimane invisibile.
function initSagomeTracciate() {
    const sagome = document.querySelectorAll('.sagoma-tracciata');
    if (!sagome.length) return;

    sagome.forEach(s => {
        s.querySelectorAll('path').forEach(p => {
            p.style.setProperty('--len', p.getTotalLength());
        });
    });

    if (!('IntersectionObserver' in window)) {
        sagome.forEach(s => s.classList.add('tracciata'));
        return;
    }

    const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('tracciata');
                io.unobserve(e.target);
            }
        });
    }, { threshold: 0.25, rootMargin: '0px 0px -8% 0px' });

    sagome.forEach(s => io.observe(s));
}

// ========== SMOOTH SCROLL ==========
let smoothScroll = null;
function initSmoothScroll() {
    // Touch/trackpad devices use native momentum scroll — don't override
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let targetY = window.scrollY;
    let currentY = window.scrollY;
    let loopAttivo = false;

    const getMax = () => document.documentElement.scrollHeight - window.innerHeight;

    // Se il puntatore è sopra un contenitore che può ancora scorrere nella
    // direzione richiesta (il testo di un modale, per esempio), la rotellina
    // deve restare al browser. Senza questo controllo il preventDefault qui
    // sotto blocca lo scroll dentro le schede prodotto e le schede lavorazione.
    function scorrevoleSotto(el, delta) {
        while (el && el.nodeType === 1 && el !== document.body) {
            const oy = getComputedStyle(el).overflowY;
            if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) {
                if (delta < 0 && el.scrollTop > 0) return true;
                if (delta > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
            }
            el = el.parentElement;
        }
        return false;
    }

    window.addEventListener('wheel', (e) => {
        // ctrl/cmd + rotellina è lo zoom del browser, ed è anche quello che il
        // trackpad manda quando si fa pinch. Rubarglielo significa togliere a
        // chi ci vede poco l'unico modo di ingrandire la pagina.
        if (e.ctrlKey || e.metaKey) return;
        // shift + rotellina è scroll orizzontale: non ci riguarda.
        if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        if (scorrevoleSotto(e.target, e.deltaY)) return;
        e.preventDefault();
        // Con un modale aperto la pagina sotto resta ferma: prima la rotellina
        // sullo sfondo scuro, o in fondo al testo del modale, la faceva scorrere.
        if (document.querySelector('.modal-overlay.active')) return;
        targetY = Math.max(0, Math.min(targetY + e.deltaY, getMax()));
        avviaLoop();
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
        // le frecce appartengono a chi ha il focus: campi, select, modali aperti
        // e.target non è sempre un elemento: su un evento diretto a document
        // vale document, che .matches() non ce l'ha e faceva saltare tutto.
        const t = e.target;
        if (t instanceof Element &&
            (t.matches('input, textarea, select, [contenteditable]') ||
                t.closest('.modal-overlay.active'))) return;

        const max = getMax();
        const prima = targetY;
        switch (e.key) {
            case 'ArrowDown': targetY = Math.min(targetY + 80, max); break;
            case 'ArrowUp':   targetY = Math.max(0, targetY - 80); break;
            case 'PageDown':  targetY = Math.min(targetY + window.innerHeight * 0.9, max); break;
            case 'PageUp':    targetY = Math.max(0, targetY - window.innerHeight * 0.9); break;
            case 'Home':      targetY = 0; break;
            case 'End':       targetY = max; break;
        }
        if (targetY !== prima) avviaLoop();
    });

    // Qualsiasi scorrimento che non sia nato qui — la scrollbar trascinata col
    // mouse, un salto a un'ancora, il "trova nella pagina", il focus che porta
    // in vista un campo — deve diventare la nuova posizione di riferimento.
    // Senza questo il loop qui sotto riportava la pagina indietro al frame dopo.
    window.addEventListener('scroll', () => {
        if (loopAttivo) return;          // il movimento è nostro: niente da risincronizzare
        targetY = currentY = window.scrollY;
    }, { passive: true });

    window.addEventListener('resize', () => {
        targetY = Math.min(targetY, getMax());
    }, { passive: true });

    const hasST = typeof ScrollTrigger !== 'undefined';

    // Il loop gira solo mentre c'è distanza da colmare. Prima restava acceso a
    // 60fps per tutta la visita, chiamando scrollTo() e ScrollTrigger.update()
    // anche con la pagina ferma.
    function tick() {
        currentY += (targetY - currentY) * 0.09;
        if (Math.abs(targetY - currentY) < 0.1) currentY = targetY;
        window.scrollTo(0, currentY);
        // Keep ScrollTrigger in sync — programmatic scrollTo() does not reliably
        // dispatch scroll events that ScrollTrigger catches, so push updates
        // every frame (same role Lenis's scroll handler used to play).
        if (hasST) ScrollTrigger.update();

        if (currentY === targetY) {
            loopAttivo = false;          // arrivati: la prossima spinta lo riaccende
            return;
        }
        requestAnimationFrame(tick);
    }

    function avviaLoop() {
        if (loopAttivo) return;
        loopAttivo = true;
        requestAnimationFrame(tick);
    }

    smoothScroll = {
        scrollTo: (y) => {
            targetY = Math.max(0, Math.min(y, getMax()));
            avviaLoop();
        }
    };
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
            if (smoothScroll) { smoothScroll.scrollTo(0); }
            else { window.scrollTo({ top: 0, behavior: 'smooth' }); }
        });
    }
}

// ========== MOBILE MENU ==========
function initMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    const mobileNav = document.querySelector('.mobile-nav');
    if (!hamburger || !mobileNav) return;

    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-controls', mobileNav.id || (mobileNav.id = 'mobile-nav'));

    function chiudi() {
        hamburger.classList.remove('open');
        mobileNav.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        const aperto = mobileNav.classList.toggle('open');
        hamburger.setAttribute('aria-expanded', String(aperto));
        document.body.style.overflow = aperto ? 'hidden' : '';

        // Stagger mobile nav links
        if (aperto) {
            const links = mobileNav.querySelectorAll('a');
            links.forEach((link, i) => {
                link.style.transitionDelay = (i * 0.08) + 's';
            });
        }
    });

    // Close on link click
    mobileNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', chiudi);
    });

    // Escape chiude il menu, come già fa nei modali.
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mobileNav.classList.contains('open')) {
            chiudi();
            hamburger.focus();
        }
    });
}

// ========== PAGE TRANSITIONS ==========
function initPageTransitions() {
    const overlay = document.querySelector('.page-transition');
    if (!overlay) return;

    // Senza GSAP la tendina non si ritirerebbe mai e resterebbe a coprire tutta
    // la pagina (z-index 100000): meglio non alzarla affatto. Il sito perde
    // l'effetto, non la sua unica via d'accesso.
    if (typeof gsap === 'undefined') {
        overlay.style.display = 'none';
        return;
    }

    // Fade in on page load
    overlay.style.transformOrigin = 'top';
    overlay.style.transform = 'scaleY(1)';

    // Rete di sicurezza: se per qualsiasi ragione la timeline non arriva in
    // fondo (tab aperta in secondo piano, ticker in pausa, animazione persa),
    // dopo un secondo la tendina se ne va comunque.
    const tolgoLaTendina = setTimeout(() => {
        overlay.style.transform = 'scaleY(0)';
    }, 1000);

    gsap.to(overlay, {
        scaleY: 0,
        duration: 0.5,
        ease: 'power2.inOut',
        delay: 0.1,
        onComplete: () => clearTimeout(tolgoLaTendina),
    });

    // Intercept navigation links
    document.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href');
        // Only intercept local .html links, not anchors or external
        if (href && (href.endsWith('.html') || href.includes('.html?')) && !href.startsWith('http') && !href.startsWith('#')) {
            link.addEventListener('click', (e) => {
                // cmd/ctrl/shift-click e tasto centrale aprono in un'altra tab:
                // quelli devono restare al browser, non diventare una tendina.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
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

    // NOTE: .reveal, .reveal-scale, .stagger-cards are handled by
    // initRevealAnimations() via IntersectionObserver — not ScrollTrigger.

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

    // NOTE: Sector cards use IntersectionObserver (initSectorReveal), not
    // ScrollTrigger. A GSAP .from() reveal would leave cards stuck at opacity:0
    // whenever its onEnter didn't fire (already past the start at refresh, or a
    // missed programmatic-scroll update). IntersectionObserver reveals reliably
    // for any element entering — or already in — the viewport.

    // Recalculate all trigger positions now that everything is initialised,
    // and again once late assets (fonts, CDN images) finish loading and shift
    // the layout — otherwise triggers use stale offsets and may never fire.
    ScrollTrigger.refresh();
    window.addEventListener('load', () => ScrollTrigger.refresh());
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
