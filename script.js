/* =========================================================
   Prelude — interactions (vanilla JS, no dependencies)
   ========================================================= */

/* Sticky nav background on scroll */
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

/* Mobile menu toggle (simple anchor scroll list) */
const toggle = document.getElementById('navToggle');
if (toggle) {
  toggle.addEventListener('click', () => {
    document.querySelector('.nav__links')?.classList.toggle('open');
  });
}

/* Scroll reveal */
const reveals = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.16, rootMargin: '0px 0px -40px 0px' });
reveals.forEach((el, i) => {
  el.style.transitionDelay = `${Math.min(i % 4, 3) * 80}ms`;
  io.observe(el);
});

/* Count-up stats */
const counters = document.querySelectorAll('.stat__num');
const countIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const target = parseInt(el.dataset.count, 10);
    const dur = 1200;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    countIO.unobserve(el);
  });
}, { threshold: 0.6 });
counters.forEach((c) => countIO.observe(c));

/* Footer year */
document.getElementById('year').textContent = new Date().getFullYear();

/* Contact form (mock handler) */
function handleSubmit(e) {
  e.preventDefault();
  const note = document.getElementById('formNote');
  note.textContent = 'Thanks — your brief is in. We’ll be in touch within one business day.';
  e.target.reset();
  return false;
}
