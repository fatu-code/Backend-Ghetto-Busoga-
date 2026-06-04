const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../db/audit');

// Allowed roles. 'rdc' and 'profiler' are scoped to one district.
const ROLES = ['admin', 'rdc', 'profiler'];
function cleanRole(r) { return ROLES.includes(r) ? r : 'profiler'; }

// GET /api/users — list users (never returns password hashes)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const db = req.app.locals.db;
  const { rows } = await db.query(
    'SELECT id, name, username, role, district, created_at FROM users ORDER BY created_at ASC'
  );
  res.json({ users: rows });
});

// POST /api/users — add a user account
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const db = req.app.locals.db;
  const { name, password } = req.body;
  const username = String(req.body.username || '').trim().toLowerCase();
  const role = cleanRole(req.body.role);
  const district = (role === 'admin') ? null : (req.body.district || null);

  if (!name || !username || !password)
    return res.status(400).json({ error: 'Name, username and password are required' });
  if (String(password).length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (role !== 'admin' && !district)
    return res.status(400).json({ error: 'An RDC or Profiler must be assigned a district' });

  const dup = await db.query('SELECT id FROM users WHERE username = $1', [username]);
  if (dup.rows[0]) return res.status(409).json({ error: 'That username is already taken' });

  const hash = await bcrypt.hash(password, 12);
  const { rows } = await db.query(
    `INSERT INTO users (name, username, password_hash, role, district)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, name, username, role, district, created_at`,
    [name.trim(), username, hash, role, district]
  );
  await logAudit(db, req, 'user.create', 'user', rows[0].id,
    `Added ${role} @${username}${district ? ' (' + district + ')' : ''}`);
  res.status(201).json({ user: rows[0] });
});

// PUT /api/users/:id — update name/role/district, optionally reset password
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const cur = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  if (!cur.rows[0]) return res.status(404).json({ error: 'User not found' });

  const { name, password } = req.body;
  let hash = cur.rows[0].password_hash;
  if (password) {
    if (String(password).length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    hash = await bcrypt.hash(password, 12);
  }

  // Resolve the new role. Never let an admin demote their own account (lock-out guard).
  let newRole = req.body.role === undefined ? cur.rows[0].role : cleanRole(req.body.role);
  if (Number(id) === Number(req.user.id)) newRole = 'admin';

  // District applies only to rdc/profiler; admins have none.
  let newDistrict = cur.rows[0].district;
  if (req.body.district !== undefined) newDistrict = req.body.district || null;
  if (newRole === 'admin') newDistrict = null;
  if (newRole !== 'admin' && !newDistrict)
    return res.status(400).json({ error: 'An RDC or Profiler must be assigned a district' });

  const { rows } = await db.query(
    `UPDATE users SET name = $1, role = $2, district = $3, password_hash = $4 WHERE id = $5
     RETURNING id, name, username, role, district, created_at`,
    [name ? name.trim() : cur.rows[0].name, newRole, newDistrict, hash, id]
  );
  await logAudit(db, req, 'user.update', 'user', id, `Updated ${rows[0].role} @${rows[0].username}`);
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
  await logAudit(db, req, 'user.delete', 'user', req.params.id, `Removed @${cur.rows[0].username}`);
  res.json({ success: true });
});

module.exports = router;
