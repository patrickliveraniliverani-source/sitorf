/**
 * Hero Slideshow - Ken Burns Effect
 * R.F. Resina Forlivese
 */

document.addEventListener('DOMContentLoaded', () => {
    const slideshowContainer = document.getElementById('hero-slideshow');

    if (slideshowContainer) {
        // Configuration
        const slides = [
            { image: 'url("https://images.unsplash.com/photo-1550966871-3ed3c47e2ce2?q=80&w=2070&auto=format&fit=crop")', text: '' }, // Industrial/Abstract
            { image: 'url("https://images.unsplash.com/photo-1563986851212-04e38ce7130a?q=80&w=2070&auto=format&fit=crop")', text: '' }, // Foam/Texture
            { image: 'url("https://images.unsplash.com/photo-1531297461136-82lw8e0c9684?q=80&w=2669&auto=format&fit=crop")', text: '' }  // Modern/Clean
        ];

        const duration = 8; // Seconds per slide
        const fadeDuration = 1.5;

        // Create Slide Elements
        slides.forEach((slide, index) => {
            const slideEl = document.createElement('div');
            slideEl.classList.add('hero-slide');
            slideEl.style.backgroundImage = slide.image;
            slideshowContainer.appendChild(slideEl);

            // Initial State for GSAP
            if (index === 0) {
                gsap.set(slideEl, { opacity: 1, scale: 1.1 });
            } else {
                gsap.set(slideEl, { opacity: 0, scale: 1.1, zIndex: 0 });
            }
        });

        const slideElements = document.querySelectorAll('.hero-slide');
        let currentIndex = 0;

        function nextSlide() {
            const nextIndex = (currentIndex + 1) % slides.length;
            const currentSlide = slideElements[currentIndex];
            const nextSlideEl = slideElements[nextIndex];

            // Bring next slide to top (but below current for crossfade) or just handle opacity
            gsap.set(nextSlideEl, { zIndex: 1, scale: 1.2 }); // Start slightly zoomed in
            gsap.set(currentSlide, { zIndex: 2 });

            // Animate In Next Slide
            const tl = gsap.timeline({
                onComplete: () => {
                    gsap.set(currentSlide, { opacity: 0, zIndex: 0 });
                    currentIndex = nextIndex;
                    // Schedule next
                    gsap.delayedCall(duration - fadeDuration, nextSlide);
                }
            });

            // Crossfade
            tl.to(currentSlide, { opacity: 0, duration: fadeDuration }, 0);
            tl.to(nextSlideEl, { opacity: 1, duration: fadeDuration }, 0);

            // Continuous Pan/Zoom for the "Active" slide (simulate video)
            // Actually, we need a continuous generic animation on the active slide
            gsap.fromTo(nextSlideEl,
                { scale: 1.2 },
                { scale: 1.0, duration: duration, ease: "none" }
            );
        }

        // Start the loop
        // Initial zoom for first slide
        gsap.to(slideElements[0], { scale: 1.0, duration: duration, ease: "none" });
        gsap.delayedCall(duration - fadeDuration, nextSlide);
    }
});
