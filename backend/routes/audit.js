const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Only an administrator can view the audit log' });
}

// GET /api/audit?limit=300&action=member
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const db = req.app.locals.db;
  const limit = Math.min(parseInt(req.query.limit) || 300, 1000);
  const params = [];
  let where = '';
  if (req.query.action) { where = 'WHERE action LIKE $1'; params.push(req.query.action + '%'); }
  params.push(limit);
  const { rows } = await db.query(
    `SELECT id, user_name, action, entity, entity_id, detail, created_at
       FROM audit_log ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT $${params.length}`,
    params
  );
  res.json({ entries: rows });
});

module.exports = router;
