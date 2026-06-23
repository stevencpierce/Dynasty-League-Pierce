# Prelude — Event Production Studio (website mockup)

A clean, Apple-minimal marketing site for a premium event production company
focused on photography, film, and a prep-driven, soup-to-nuts process.

> **"Prelude" is a placeholder name** (a nod to the *preparation* that is the
> core differentiator). Swap it freely. Imagery is placeholder stock and the
> hero video is a sample clip — replace with real work.

## Design direction
- **Aesthetic:** Apple-style minimalism — lots of neutral white/black,
  generous whitespace, scroll-driven reveals.
- **Accents:** two shades of blue (primary `#0a6cff`, deep `#0a3d8f`, sky
  `#5ea2ff`) with a subtle amber (`#d99a36`) used sparingly. All accent colors
  live as CSS variables at the top of `styles.css` — easy to retune.
- **Type:** Inter for UI text, Fraunces (serif) for cinematic display headlines.

## Sections
Hero (video) · client marquee · the prep "Approach" + stats · Services
(Photography / Film / Production / Media Strategy) · 4-step Process
(Discovery → Prep → Production → Post & Rollout) · Work gallery · pull quote ·
contact/brief form · footer.

## Run it
No build step — it's plain HTML/CSS/JS. Just open `index.html`, or serve it:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Files
- `index.html` — markup & copy
- `styles.css` — design tokens + all styling
- `script.js` — sticky nav, scroll reveals, count-up stats, form handler

## Notes for going to production
- Replace placeholder copy, contact details, and the `[City]` placeholder.
- Swap stock imagery / hero video for real event work (self-host the video).
- Easy to port into Webflow later; this static version doubles as a reference
  for layout, copy, and the color system.
