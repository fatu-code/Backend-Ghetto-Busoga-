// ── PUBLIC VERIFY ROUTE ─────────────────────────────────────────────
const verifyRouter = require('express').Router();

// GET /api/verify/:id  — no auth required, this is the public endpoint
verifyRouter.get('/:id', async (req, res) => {
  const db = req.app.locals.db;
  const { rows } = await db.query(
    `SELECT id, name, district_name, depot, village, gender,
            photo_url, amount, disbursement_date, status, created_at
       FROM members WHERE id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Beneficiary not found' });
  res.json({ member: rows[0] });
});

module.exports = verifyRouter;
