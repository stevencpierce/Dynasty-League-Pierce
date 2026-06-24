# Prelude — Event Production Studio (website mockup)

A clean, Apple-minimal marketing site for a premium event company: collaboration
and prep first, full production, and a strategy that makes the work pay off long
after the event.

> **"Prelude" is a placeholder name.** Swap it freely. Imagery is placeholder and
> the hero video is a sample clip — replace with real work.

## Design direction
- **Aesthetic:** black-and-white minimalism, headline-led, low text, scroll-driven.
- **Accent (themeable):** the single accent flexes per client/vertical via
  `<html data-theme="…">` — `medical` (blue), `corporate` (green), `violet`
  (artistic), plus `fashion`, `oxblood`, `mono`. Buttons/marks stay black in
  every theme. Defined at the top of `styles.css`.
- **Type:** Inter for UI text; display face is one variable — `--display` in
  `styles.css` (currently **Space Grotesk**; swap to `Bricolage Grotesque` or
  `Syne` in one line). Headlines use a subtle "downhill glide" motion.

## Sections
Hero (video) · statement (*small made impactful / big made effortless*) ·
Approach (collaboration + communicate early) · Services (Prep & Strategy ·
Production · Asset Creation · Activation) · Team/scale · Innovation (AI + process)
· 20+ years · Work gallery · contact form · footer.

## Preview the fonts
`compare.html` shows the three display-font candidates side by side. Web fonts
only render in a real browser (not in headless screenshot tools), so use a live
preview to judge type and motion.

## Run it
No build step — plain HTML/CSS/JS. Open `index.html`, or serve it:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

For a shareable link, drag the folder onto https://app.netlify.com/drop.

## Files
- `index.html` — markup & copy
- `styles.css` — design tokens (color themes, `--display` font) + all styling
- `script.js` — sticky nav, scroll reveals, count-up, form handler
- `compare.html` — three-font comparison helper

## Notes for going to production
- Replace placeholder copy, contact details, and the real years figure.
- Swap stock imagery / hero video for real event work (self-host the video).
- Easy to port into Webflow later; this static version doubles as a reference
  for layout, copy, the color theming, and the type system.
