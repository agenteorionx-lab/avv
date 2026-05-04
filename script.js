// FAQ Accordion Logic
document.addEventListener('DOMContentLoaded', () => {
    const faqQuestions = document.querySelectorAll('.faq-question');

    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const currentItem = question.parentElement;
            
            // Toggle active class on the clicked item
            currentItem.classList.toggle('active');
            
            // Close other items
            faqQuestions.forEach(otherQuestion => {
                const otherItem = otherQuestion.parentElement;
                if (otherItem !== currentItem && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                }
            });
        });
    });

    // Number Counter Animation
    const counters = document.querySelectorAll('.stat-item-horizontal h3[data-target]');
    const speed = 100; // The lower the slower

    const animateCounters = () => {
        counters.forEach(counter => {
            const updateCount = () => {
                const target = +counter.getAttribute('data-target');
                const count = +counter.innerText;

                const inc = target / speed;

                if (count < target) {
                    counter.innerText = Math.ceil(count + inc);
                    setTimeout(updateCount, 20);
                } else {
                    counter.innerText = target;
                }
            };
            updateCount();
        });
    }

    const statsSection = document.querySelector('.stats');
    let animated = false;

    window.addEventListener('scroll', () => {
        if (!animated && statsSection) {
            const sectionPos = statsSection.getBoundingClientRect().top;
            const screenPos = window.innerHeight;

            if (sectionPos < screenPos) {
                animateCounters();
                animated = true;
            }
        }
    });

    // Infinite Carousel Duplication for seamless scrolling
    const track = document.getElementById('sponsor-track');
    if (track) {
        const cards = Array.from(track.children);
        // Duplicate cards to make the infinite scroll smooth
        cards.forEach(card => {
            const clone = card.cloneNode(true);
            track.appendChild(clone);
        });
    }
    // Swiper Initialization
    const swiper = new Swiper('.main-carousel', {
        loop: true,
        autoplay: {
            delay: 3000,
            disableOnInteraction: false,
        },
        speed: 1000,
        effect: 'slide',
    });
});
