/* =========================================================
   Aperio — interactions + content hydration
   All editable copy/images live in content.json. This script
   loads it, fills the page, then wires up the interactions.
   If content.json can't load, the baked-in HTML stands as-is.
   ========================================================= */

/* Contact form (global — referenced by inline onsubmit) */
function handleSubmit(e) {
  e.preventDefault();
  const note = document.getElementById('formNote');
  note.textContent = 'Thanks — your brief is in. We’ll be in touch within one business day.';
  e.target.reset();
  return false;
}

(async function main() {
  /* ---------- load content ---------- */
  let C = null;
  try {
    const res = await fetch('content.json', { cache: 'no-cache' });
    if (res.ok) C = await res.json();
  } catch (e) { /* offline/file:// — keep baked-in content */ }

  if (C) hydrate(C);

  initNav();
  initReveals();
  initCounters();
  initRotator(C && C.team && C.team.words);
  initStrips();

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- hydration ---------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  /* \n -> <br>, *word* -> accent span */
  function rich(s) {
    return esc(s)
      .replace(/\*([^*]+)\*/g, '<span class="accent-word">$1</span>')
      .replace(/\n/g, '<br />');
  }
  function put(sel, val, mode) {
    const el = document.querySelector(sel);
    if (!el || val == null || val === '') return;
    if (mode === 'rich') el.innerHTML = rich(val);
    else el.textContent = val;
  }

  function hydrate(C) {
    /* site basics */
    if (C.site) {
      if (C.site.theme) document.documentElement.dataset.theme = C.site.theme;
      if (C.site.title) document.title = C.site.title;
      if (C.site.name) {
        document.querySelectorAll('.brand__name').forEach(el => el.textContent = C.site.name);
        document.querySelectorAll('.brand__mark').forEach(el => el.textContent = C.site.name[0]);
        const ver = document.querySelector('.footer__ver');
        if (ver) ver.textContent = C.site.name + (C.site.version ? ' v' + C.site.version : '');
      }
    }

    /* show/hide sections */
    const SECTIONS = {
      hero: '#top', statement: '#statement', sectors: '#sectors', approach: '#approach',
      capabilities: '#capabilities', montage: '#montage', services: '#services',
      blindspot: '#blindspot', team: '#team', innovation: '#innovation',
      experience: '#experience', work: '#work', clients: '#clients', contact: '#contact'
    };
    Object.keys(SECTIONS).forEach(key => {
      const el = document.querySelector(SECTIONS[key]);
      if (el && C[key] && C[key].show === false) el.style.display = 'none';
    });

    /* hero */
    if (C.hero) {
      put('.hero .eyebrow', C.hero.eyebrow);
      put('.hero__title', C.hero.title, 'rich');
      put('.hero__lede', C.hero.lede, 'rich');
      if (C.hero.image) { const img = document.querySelector('.hero__img'); if (img) img.src = C.hero.image; }
    }

    /* statement + blindspot */
    if (C.statement) put('#statement .statement__text', C.statement.text, 'rich');
    if (C.blindspot) {
      put('#blindspot .statement__text', C.blindspot.text, 'rich');
      put('#blindspot .statement__sub', C.blindspot.sub, 'rich');
    }

    /* sectors */
    if (C.sectors) {
      put('#sectors .eyebrow', C.sectors.eyebrow);
      put('#sectors .h2', C.sectors.title, 'rich');
      const grid = document.querySelector('.sector-grid');
      if (grid && Array.isArray(C.sectors.items)) {
        const cls = ['sector--medical', 'sector--corporate', 'sector--university'];
        grid.innerHTML = C.sectors.items.map((s, i) =>
          `<a class="sector ${cls[i % cls.length]} reveal" href="#contact"><h3>${esc(s.name)}</h3><p>${esc(s.keywords)}</p></a>`
        ).join('');
      }
    }

    /* approach */
    if (C.approach && Array.isArray(C.approach.blocks)) {
      document.querySelectorAll('#approach .grid-2 > div').forEach((blockEl, i) => {
        const b = C.approach.blocks[i];
        if (!b) return;
        const ey = blockEl.querySelector('.eyebrow'), h = blockEl.querySelector('.h2'), l = blockEl.querySelector('.lead');
        if (ey && b.eyebrow) ey.textContent = b.eyebrow;
        if (h && b.title) h.innerHTML = rich(b.title);
        if (l && b.lead) l.innerHTML = rich(b.lead);
      });
    }

    /* capabilities */
    if (C.capabilities) {
      put('#capabilities .eyebrow', C.capabilities.eyebrow);
      put('#capabilities .h2', C.capabilities.title, 'rich');
      const ol = document.querySelector('.caplist');
      if (ol && Array.isArray(C.capabilities.items)) {
        ol.innerHTML = C.capabilities.items.map((it, i) =>
          `<li class="cap reveal"><span class="cap__idx">${String(i + 1).padStart(2, '0')}</span><h3 class="cap__name">${esc(it.name)}</h3><span class="cap__desc">${esc(it.desc || '')}</span><span class="cap__arrow" aria-hidden="true">↗</span></li>`
        ).join('');
      }
    }

    /* montage (image or video tiles) */
    if (C.montage) {
      const rot = document.querySelector('.strips__rot');
      if (rot && Array.isArray(C.montage.rows)) {
        const media = (u) => /\.(mp4|webm|mov)(\?|$)/i.test(u)
          ? `<video class="strip__img" src="${esc(u)}" autoplay muted loop playsinline></video>`
          : `<span class="strip__img" style="--img:url('${esc(u)}')"></span>`;
        rot.innerHTML = C.montage.rows.map((row, i) =>
          `<div class="strip" data-strip="${i % 2 ? 'right' : 'left'}">${row.map(media).join('')}</div>`
        ).join('');
      }
      const note = document.querySelector('.strips__note');
      if (note && C.montage.note) note.innerHTML = '<span aria-hidden="true">*</span> ' + rich(C.montage.note);
    }

    /* services */
    if (C.services) {
      put('#services .eyebrow', C.services.eyebrow);
      put('#services .h2', C.services.title, 'rich');
      put('#services .lead', C.services.lead, 'rich');
      const cards = document.querySelector('#services .cards');
      if (cards && Array.isArray(C.services.cards)) {
        cards.innerHTML = C.services.cards.map(c =>
          `<article class="card reveal"><div class="card__icon">${esc(c.icon || '◇')}</div><h3>${esc(c.name)}</h3><p>${esc(c.desc || '')}</p></article>`
        ).join('');
      }
    }

    /* team (rotator headline) */
    if (C.team) {
      put('#team .eyebrow', C.team.eyebrow);
      put('#team .lead', C.team.lead, 'rich');
      const h = document.querySelector('#team .h2');
      if (h && C.team.titlePrefix) {
        h.innerHTML = rich(C.team.titlePrefix) + '<span class="rotator" id="rotator"></span>';
      }
    }

    /* innovation */
    if (C.innovation) {
      put('#innovation .eyebrow', C.innovation.eyebrow);
      put('#innovation .h2', C.innovation.title, 'rich');
      put('#innovation .lead', C.innovation.lead, 'rich');
      const ul = document.querySelector('.pillars');
      if (ul && Array.isArray(C.innovation.pillars)) {
        ul.innerHTML = C.innovation.pillars.map(p =>
          `<li><span>${esc(p.name)}</span><p>${esc(p.desc || '')}</p></li>`
        ).join('');
      }
    }

    /* experience */
    if (C.experience) {
      const num = document.querySelector('.experience__num span');
      const suf = document.querySelector('.experience__num i');
      if (num && C.experience.number != null) { num.dataset.count = C.experience.number; num.textContent = C.experience.number; }
      if (suf && C.experience.suffix) suf.textContent = C.experience.suffix;
      put('.experience__label', C.experience.label, 'rich');
    }

    /* work */
    if (C.work) {
      put('#work .eyebrow', C.work.eyebrow);
      put('#work .h2', C.work.title, 'rich');
      const gal = document.querySelector('.gallery');
      if (gal && Array.isArray(C.work.tiles)) {
        const layout = ['tile--lg', '', '', '', 'tile--wide'];
        gal.innerHTML = C.work.tiles.map((t, i) => {
          const style = t.image ? ` style="--img:url('${esc(t.image)}')"` : '';
          return `<a class="tile ${layout[i % layout.length]} reveal" href="#"${style}><div class="tile__meta"><span>${esc(t.tag || '')}</span><h4>${esc(t.title)}</h4></div></a>`;
        }).join('');
      }
    }

    /* clients */
    if (C.clients) {
      put('#clients .eyebrow', C.clients.eyebrow);
      put('#clients .h2', C.clients.title, 'rich');
      const wall = document.querySelector('.logos');
      if (wall && Array.isArray(C.clients.logos)) {
        wall.innerHTML = C.clients.logos.map(l =>
          `<div class="logo reveal">${l.img ? `<img src="${esc(l.img)}" alt="${esc(l.name || '')}" />` : `<span>${esc(l.name)}</span>`}</div>`
        ).join('');
      }
    }

    /* contact + footer */
    if (C.contact) {
      put('#contact .eyebrow', C.contact.eyebrow);
      put('#contact .h2', C.contact.title, 'rich');
      put('#contact .lead', C.contact.lead, 'rich');
      const mail = document.querySelector('#contact a[href^="mailto:"]');
      if (mail && C.contact.email) { mail.href = 'mailto:' + C.contact.email; mail.textContent = C.contact.email; }
      const tel = document.querySelector('#contact a[href^="tel:"]');
      if (tel && C.contact.phone) { tel.href = 'tel:' + C.contact.phone.replace(/[^+\d]/g, ''); tel.textContent = C.contact.phone; }
    }
    if (C.footer && C.footer.note) {
      const copy = document.querySelector('.footer__copy');
      if (copy) {
        const ver = copy.querySelector('.footer__ver');
        copy.innerHTML = `© <span id="year"></span> ${esc((C.site && C.site.name) || 'Aperio')} Studio. ${esc(C.footer.note)} `;
        if (ver) copy.appendChild(ver);
      }
    }
  }

  /* ---------- interactions ---------- */
  function initNav() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const toggle = document.getElementById('navToggle');
    if (toggle) toggle.addEventListener('click', () => document.querySelector('.nav__links')?.classList.toggle('open'));
  }

  function initReveals() {
    const reveals = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.16, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i % 4, 3) * 80}ms`;
      io.observe(el);
    });
  }

  function initCounters() {
    const counters = document.querySelectorAll('.stat__num, .experience__num span');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const target = parseInt(el.dataset.count, 10);
        if (isNaN(target)) return;
        const dur = 1200, start = performance.now();
        const tick = (now) => {
          const p = Math.min((now - start) / dur, 1);
          el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.unobserve(el);
      });
    }, { threshold: 0.6 });
    counters.forEach((c) => io.observe(c));
  }

  function initRotator(words) {
    const el = document.getElementById('rotator');
    if (!el) return;
    const list = (Array.isArray(words) && words.length ? words : [
      { word: 'science.', color: '#2f6fe0' },
      { word: 'brand.', color: '#d24d86' },
      { word: 'technology.', color: '#6b4fd0' },
      { word: 'goals.', color: '#2c7a5b' },
      { word: 'mission.', color: '#0f766e' },
      { word: 'audience.', color: '#9c3b46' }
    ]).map(w => Array.isArray(w) ? { word: w[0], color: w[1] } : w);
    el.textContent = list[0].word;
    el.style.color = list[0].color;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let i = 0;
    setInterval(() => {
      el.classList.add('rotator--out');
      setTimeout(() => {
        i = (i + 1) % list.length;
        el.textContent = list[i].word;
        el.style.color = list[i].color;
        el.classList.remove('rotator--out');
        el.classList.add('rotator--in');
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('rotator--in')));
      }, 560);
    }, 2600);
  }

  function initStrips() {
    const section = document.querySelector('.strips');
    const rows = document.querySelectorAll('.strip[data-strip]');
    if (!section || !rows.length) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const TRAVEL = 260;
    let ticking = false;
    const update = () => {
      const r = section.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
      const shift = (p - 0.5) * 2;
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
  }
})();
