const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { requireAuth } = require('../middleware/auth');
const { logAudit } = require('../db/audit');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  const db  = req.app.locals.db;
  const { rows } = await db.query(
    'SELECT * FROM users WHERE username = $1', [username]
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

  const token = jwt.sign(
    { id: user.id, name: user.name, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, username: user.username, role: user.role },
  });
});

// ── SELF-SERVICE ACCOUNT — change your own name / password ──────────
router.put('/account', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'Account not found' });

  const { name, currentPassword, newPassword } = req.body;
  let hash = user.password_hash;
  if (newPassword) {
    if (String(newPassword).length < 6)
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const ok = await bcrypt.compare(currentPassword || '', user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Your current password is incorrect' });
    hash = await bcrypt.hash(newPassword, 12);
  }
  const newName = (name && name.trim()) ? name.trim() : user.name;

  const upd = await db.query(
    'UPDATE users SET name = $1, password_hash = $2 WHERE id = $3 RETURNING id, name, username, role',
    [newName, hash, user.id]
  );
  const u = upd.rows[0];
  const token = jwt.sign(
    { id: u.id, name: u.name, username: u.username, role: u.role },
    process.env.JWT_SECRET, { expiresIn: '24h' }
  );
  await logAudit(db, req, 'user.update', 'user', u.id, `Updated own account (@${u.username})`);
  res.json({ token, user: u });
});

module.exports = router;
