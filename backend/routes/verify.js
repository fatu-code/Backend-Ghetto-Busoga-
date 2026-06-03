// ── PUBLIC VERIFY ROUTE ─────────────────────────────────────────────
const verifyRouter = require('express').Router();

// Mask a NIN for public display: keep first 4 + last 4, hide the middle.
// e.g. CM91XXXXXX1234 -> CM91••••••1234
function maskNin(nin) {
  if (!nin) return null;
  if (nin.length <= 8) return nin[0] + '•'.repeat(Math.max(1, nin.length - 1));
  return nin.slice(0, 4) + '•'.repeat(nin.length - 8) + nin.slice(-4);
}

// GET /api/verify/:id  — no auth required, this is the public endpoint
verifyRouter.get('/:id', async (req, res) => {
  const db = req.app.locals.db;
  const { rows } = await db.query(
    `SELECT id, name, district_name, depot, village, gender, nin,
            photo_url, amount, disbursement_date, status, created_at
       FROM members WHERE id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Beneficiary not found' });

  // Never expose the raw NIN on the public endpoint — only a masked form.
  const { nin, ...member } = rows[0];
  member.nin_masked = maskNin(nin);
  res.json({ member });
});

module.exports = verifyRouter;
