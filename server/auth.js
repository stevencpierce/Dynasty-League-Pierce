'use strict';

const bcrypt = require('bcryptjs');
const { db } = require('./db');

function findUser(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function verifyLogin(username, password) {
  const user = findUser(username);
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return user;
}

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, username: user.username, role: user.role, team_id: user.team_id };
}

// Require any logged-in user.
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Require commissioner role.
function requireCommissioner(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (req.session.role !== 'commissioner') {
    return res.status(403).json({ error: 'Commissioner access required' });
  }
  next();
}

module.exports = {
  bcrypt,
  findUser,
  verifyLogin,
  publicUser,
  requireAuth,
  requireCommissioner,
};
