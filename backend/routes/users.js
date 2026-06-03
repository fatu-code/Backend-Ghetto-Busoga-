const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');
const { logAudit } = require('../db/audit');

// Only administrators may manage staff accounts.
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Only an administrator can manage staff accounts' });
}

// GET /api/users — list staff (never returns password hashes)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const db = req.app.locals.db;
  const { rows } = await db.query(
    'SELECT id, name, username, role, created_at FROM users ORDER BY created_at ASC'
  );
  res.json({ users: rows });
});

// POST /api/users — add a staff account
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const db = req.app.locals.db;
  const { name, password, role } = req.body;
  const username = String(req.body.username || '').trim().toLowerCase();

  if (!name || !username || !password)
    return res.status(400).json({ error: 'Name, username and password are required' });
  if (String(password).length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const dup = await db.query('SELECT id FROM users WHERE username = $1', [username]);
  if (dup.rows[0]) return res.status(409).json({ error: 'That username is already taken' });

  const hash = await bcrypt.hash(password, 12);
  const { rows } = await db.query(
    `INSERT INTO users (name, username, password_hash, role)
     VALUES ($1,$2,$3,$4) RETURNING id, name, username, role, created_at`,
    [name.trim(), username, hash, role === 'admin' ? 'admin' : 'staff']
  );
  await logAudit(db, req, 'user.create', 'user', rows[0].id, `Added staff @${username} (${rows[0].role})`);
  res.status(201).json({ user: rows[0] });
});

// PUT /api/users/:id — update name/role, optionally reset password
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const cur = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  if (!cur.rows[0]) return res.status(404).json({ error: 'User not found' });

  const { name, role, password } = req.body;
  let hash = cur.rows[0].password_hash;
  if (password) {
    if (String(password).length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    hash = await bcrypt.hash(password, 12);
  }

  // Never let an admin demote their own account (prevents lock-out).
  let newRole = role === undefined ? cur.rows[0].role : (role === 'admin' ? 'admin' : 'staff');
  if (Number(id) === Number(req.user.id) && newRole !== 'admin') newRole = 'admin';

  const { rows } = await db.query(
    `UPDATE users SET name = $1, role = $2, password_hash = $3 WHERE id = $4
     RETURNING id, name, username, role, created_at`,
    [name ? name.trim() : cur.rows[0].name, newRole, hash, id]
  );
  await logAudit(db, req, 'user.update', 'user', id, `Updated staff @${rows[0].username}`);
  res.json({ user: rows[0] });
});

// DELETE /api/users/:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const db = req.app.locals.db;
  if (Number(req.params.id) === Number(req.user.id))
    return res.status(400).json({ error: 'You cannot delete your own account' });

  const cur = await db.query('SELECT id, name, username FROM users WHERE id = $1', [req.params.id]);
  if (!cur.rows[0]) return res.status(404).json({ error: 'User not found' });

  // Keep the records they touched, just unlink the reference.
  await db.query('UPDATE members SET registered_by = NULL WHERE registered_by = $1', [req.params.id]);
  await db.query('UPDATE repayments SET recorded_by = NULL WHERE recorded_by = $1', [req.params.id]);
  await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  await logAudit(db, req, 'user.delete', 'user', req.params.id, `Removed staff @${cur.rows[0].username}`);
  res.json({ success: true });
});

module.exports = router;
