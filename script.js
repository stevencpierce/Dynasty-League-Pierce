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
const counters = document.querySelectorAll('.stat__num, .experience__num span');
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

/* Rotating word — "Specialists who speak your ___" */
(function () {
  const el = document.getElementById('rotator');
  if (!el) return;
  const words = [
    ['science.',    '#2f6fe0'],  // medical blue
    ['brand.',      '#d24d86'],  // fashion pink
    ['technology.', '#6b4fd0'],  // violet
    ['goals.',      '#2c7a5b'],  // corporate green
    ['audience.',   '#9c3b46'],  // oxblood
  ];
  el.textContent = words[0][0];
  el.style.color = words[0][1];
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let i = 0;
  setInterval(() => {
    el.classList.add('rotator--out');
    setTimeout(() => {
      i = (i + 1) % words.length;
      el.textContent = words[i][0];
      el.style.color = words[i][1];
      el.classList.remove('rotator--out');
      el.classList.add('rotator--in');
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('rotator--in')));
    }, 330);
  }, 2600);
})();

/* Diagonal montage strips — slide horizontally as the section scrolls past */
(function () {
  const section = document.querySelector('.strips');
  const rows = document.querySelectorAll('.strip[data-strip]');
  if (!section || !rows.length) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const TRAVEL = 260; // px each row drifts across the scroll
  let ticking = false;
  const update = () => {
    const r = section.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    // 0 when section enters bottom of viewport, 1 when it leaves the top
    const p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
    const shift = (p - 0.5) * 2; // -1 .. 1, centered
    rows.forEach((row) => {
      const dir = row.dataset.strip === 'right' ? 1 : -1;
      row.style.transform = 'translate3d(' + (dir * TRAVEL * shift) + 'px,0,0)';
    });
    ticking = false;
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
})();

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
