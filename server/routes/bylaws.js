'use strict';

const express = require('express');
const { marked } = require('marked');
const { db } = require('../db');
const { requireCommissioner } = require('../auth');

const router = express.Router();

marked.setOptions({ headerIds: true, mangle: false });

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'article';
}

// List all bylaws (metadata only, grouped client-side by category).
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT id, slug, title, category, sort_order, updated_at FROM bylaws ORDER BY sort_order, title')
    .all();
  res.json({ bylaws: rows });
});

// Full-text-ish search across title + body.
router.get('/search', (req, res) => {
  const q = `%${(req.query.q || '').trim()}%`;
  const rows = db
    .prepare(
      `SELECT id, slug, title, category, substr(body_md, 1, 240) AS excerpt
       FROM bylaws WHERE title LIKE ? OR body_md LIKE ? ORDER BY sort_order LIMIT 50`
    )
    .all(q, q);
  res.json({ results: rows });
});

// One bylaw with rendered HTML.
router.get('/:slug', (req, res) => {
  const row = db.prepare('SELECT * FROM bylaws WHERE slug = ?').get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Bylaw not found' });
  res.json({ bylaw: { ...row, html: marked.parse(row.body_md || '') } });
});

// Amendment history for a bylaw.
router.get('/:slug/revisions', (req, res) => {
  const bylaw = db.prepare('SELECT id FROM bylaws WHERE slug = ?').get(req.params.slug);
  if (!bylaw) return res.status(404).json({ error: 'Bylaw not found' });
  const revisions = db
    .prepare(
      `SELECT r.id, r.note, r.created_at, u.username AS editor
       FROM bylaw_revisions r LEFT JOIN users u ON u.id = r.edited_by
       WHERE r.bylaw_id = ? ORDER BY r.created_at DESC`
    )
    .all(bylaw.id);
  res.json({ revisions });
});

router.get('/:slug/revisions/:revId', (req, res) => {
  const row = db
    .prepare('SELECT * FROM bylaw_revisions WHERE id = ?')
    .get(req.params.revId);
  if (!row) return res.status(404).json({ error: 'Revision not found' });
  res.json({ revision: { ...row, html: marked.parse(row.body_md || '') } });
});

// Create a new bylaw article.
router.post('/', requireCommissioner, (req, res) => {
  const { title, category, body_md, sort_order } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });
  let slug = slugify(title);
  // Ensure unique slug.
  let n = 1;
  while (db.prepare('SELECT 1 FROM bylaws WHERE slug = ?').get(slug)) {
    slug = `${slugify(title)}-${++n}`;
  }
  const tx = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO bylaws (slug, title, category, body_md, sort_order) VALUES (?, ?, ?, ?, ?)')
      .run(slug, title, category || 'General', body_md || '', sort_order || 99);
    db.prepare('INSERT INTO bylaw_revisions (bylaw_id, body_md, note, edited_by) VALUES (?, ?, ?, ?)').run(
      info.lastInsertRowid,
      body_md || '',
      'Created',
      req.session.userId
    );
    return info.lastInsertRowid;
  });
  res.status(201).json({ id: tx(), slug });
});

// Edit a bylaw — snapshots the new body into revision history.
router.put('/:slug', requireCommissioner, (req, res) => {
  const { title, category, body_md, sort_order, note } = req.body || {};
  const bylaw = db.prepare('SELECT * FROM bylaws WHERE slug = ?').get(req.params.slug);
  if (!bylaw) return res.status(404).json({ error: 'Bylaw not found' });
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE bylaws SET title = COALESCE(?, title), category = COALESCE(?, category),
        body_md = COALESCE(?, body_md), sort_order = COALESCE(?, sort_order),
        updated_at = datetime('now') WHERE id = ?`
    ).run(title || null, category || null, body_md ?? null, sort_order ?? null, bylaw.id);
    if (body_md != null && body_md !== bylaw.body_md) {
      db.prepare('INSERT INTO bylaw_revisions (bylaw_id, body_md, note, edited_by) VALUES (?, ?, ?, ?)').run(
        bylaw.id,
        body_md,
        note || 'Amended',
        req.session.userId
      );
    }
  });
  tx();
  res.json({ ok: true });
});

router.delete('/:slug', requireCommissioner, (req, res) => {
  db.prepare('DELETE FROM bylaws WHERE slug = ?').run(req.params.slug);
  res.json({ ok: true });
});

module.exports = router;
