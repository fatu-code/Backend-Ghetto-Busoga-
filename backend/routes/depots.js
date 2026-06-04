const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../db/audit');

// GET /api/depots  (any signed-in user; optional ?district=CODE)
router.get('/', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { district } = req.query;
  const { rows } = district
    ? await db.query('SELECT * FROM depots WHERE district = $1 ORDER BY name', [district])
    : await db.query('SELECT * FROM depots ORDER BY district, name');
  res.json({ depots: rows });
});

// POST /api/depots  (admin only) — create a real depot
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const db = req.app.locals.db;
  const name          = String(req.body.name || '').trim();
  const district      = String(req.body.district || '').trim();
  const district_name = (req.body.district_name || '').trim() || null;
  const sub_county    = (req.body.sub_county || '').trim() || null;
  const parish        = (req.body.parish || '').trim() || null;

  if (!name || !district)
    return res.status(400).json({ error: 'Depot name and district are required' });

  const dup = await db.query(
    'SELECT id FROM depots WHERE district = $1 AND lower(name) = lower($2)', [district, name]
  );
  if (dup.rows[0]) return res.status(409).json({ error: 'That depot already exists in this district' });

  const { rows } = await db.query(
    `INSERT INTO depots (district, district_name, name, sub_county, parish, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [district, district_name, name, sub_county, parish, req.user.id]
  );
  await logAudit(db, req, 'depot.create', 'depot', rows[0].id,
    `Created depot ${name} (${district_name || district})`);
  res.status(201).json({ depot: rows[0] });
});

// POST /api/depots/clear  (admin only) — delete a depot by name AND everyone in it.
// Handles legacy/hardcoded depots that have no depots-table row but do have members.
router.post('/clear', requireAuth, requireAdmin, async (req, res) => {
  const db = req.app.locals.db;
  const district = String(req.body.district || '').trim();
  const name     = String(req.body.name || '').trim();
  if (!district || !name)
    return res.status(400).json({ error: 'District and depot name are required' });

  await db.query(
    `DELETE FROM repayments WHERE member_id IN (SELECT id FROM members WHERE district = $1 AND depot = $2)`,
    [district, name]
  );
  const del = await db.query('DELETE FROM members WHERE district = $1 AND depot = $2', [district, name]);
  await db.query('DELETE FROM depots WHERE district = $1 AND lower(name) = lower($2)', [district, name]);
  await logAudit(db, req, 'depot.delete', 'depot', null,
    `Deleted depot ${name} (${district}) with ${del.rowCount} member(s)`);
  res.json({ success: true, membersDeleted: del.rowCount });
});

// PUT /api/depots/:id  (admin only)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const db = req.app.locals.db;
  const cur = await db.query('SELECT * FROM depots WHERE id = $1', [req.params.id]);
  if (!cur.rows[0]) return res.status(404).json({ error: 'Depot not found' });
  const c = cur.rows[0];

  const name       = req.body.name       !== undefined ? String(req.body.name).trim()                : c.name;
  const sub_county = req.body.sub_county !== undefined ? (String(req.body.sub_county).trim() || null) : c.sub_county;
  const parish     = req.body.parish     !== undefined ? (String(req.body.parish).trim() || null)     : c.parish;
  if (!name) return res.status(400).json({ error: 'Depot name is required' });

  // Block renaming onto an existing depot in the same district
  if (name.toLowerCase() !== c.name.toLowerCase()) {
    const dup = await db.query(
      'SELECT id FROM depots WHERE district = $1 AND lower(name) = lower($2) AND id <> $3',
      [c.district, name, c.id]
    );
    if (dup.rows[0]) return res.status(409).json({ error: 'That depot already exists in this district' });
  }

  const { rows } = await db.query(
    'UPDATE depots SET name=$1, sub_county=$2, parish=$3 WHERE id=$4 RETURNING *',
    [name, sub_county, parish, req.params.id]
  );
  // Keep members in sync if the depot was renamed (their depot is stored as text).
  if (name !== c.name) {
    await db.query('UPDATE members SET depot = $1 WHERE district = $2 AND depot = $3', [name, c.district, c.name]);
  }
  await logAudit(db, req, 'depot.update', 'depot', req.params.id, `Updated depot ${name}`);
  res.json({ depot: rows[0] });
});

// DELETE /api/depots/:id  (admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const db = req.app.locals.db;
  const cur = await db.query('SELECT name FROM depots WHERE id = $1', [req.params.id]);
  if (!cur.rows[0]) return res.status(404).json({ error: 'Depot not found' });
  await db.query('DELETE FROM depots WHERE id = $1', [req.params.id]);
  await logAudit(db, req, 'depot.delete', 'depot', req.params.id, `Deleted depot ${cur.rows[0].name}`);
  res.json({ success: true });
});

module.exports = router;
