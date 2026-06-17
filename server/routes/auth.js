'use strict';

const express = require('express');
const { db } = require('../db');
const { bcrypt, verifyLogin, publicUser, findUser, requireAuth, requireCommissioner } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const user = verifyLogin(username, password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.userId = user.id;
  req.session.role = user.role;
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  res.json({ user: publicUser(user) });
});

// Change own password.
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!bcrypt.compareSync(currentPassword || '', user.password_hash)) {
    return res.status(403).json({ error: 'Current password is incorrect' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  res.json({ ok: true });
});

// Commissioner: list users.
router.get('/users', requireCommissioner, (req, res) => {
  const rows = db
    .prepare('SELECT id, username, role, team_id, created_at FROM users ORDER BY username')
    .all();
  res.json({ users: rows });
});

// Commissioner: create a member account.
router.post('/users', requireCommissioner, (req, res) => {
  const { username, password, role, team_id } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (findUser(username)) return res.status(409).json({ error: 'Username already exists' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (username, password_hash, role, team_id) VALUES (?, ?, ?, ?)')
    .run(username, hash, role === 'commissioner' ? 'commissioner' : 'member', team_id || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

// Commissioner: reset a user's password.
router.post('/users/:id/reset-password', requireCommissioner, (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  const info = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

router.delete('/users/:id', requireCommissioner, (req, res) => {
  if (Number(req.params.id) === req.session.userId) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
