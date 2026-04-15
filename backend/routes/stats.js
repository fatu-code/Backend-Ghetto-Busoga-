const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');

// GET /api/stats
router.get('/', requireAuth, async (req, res) => {
  const db = req.app.locals.db;

  const [totals, byDistrict, byDepot, recent] = await Promise.all([
    db.query(`
      SELECT
        COUNT(*)                       AS total_members,
        SUM(amount)                    AS total_disbursed,
        COUNT(DISTINCT district)       AS districts_covered,
        COUNT(DISTINCT depot)          AS total_depots,
        COUNT(*) FILTER (WHERE status = 'Active') AS active_members
      FROM members
    `),
    db.query(`
      SELECT district, district_name,
             COUNT(*)     AS member_count,
             SUM(amount)  AS total_amount
        FROM members
       GROUP BY district, district_name
       ORDER BY total_amount DESC
    `),
    db.query(`
      SELECT depot, district_name,
             COUNT(*)    AS member_count,
             SUM(amount) AS total_amount
        FROM members
       GROUP BY depot, district_name
       ORDER BY member_count DESC
       LIMIT 10
    `),
    db.query(`
      SELECT id, name, district_name, depot, amount, disbursement_date, photo_url, created_at
        FROM members
       ORDER BY created_at DESC
       LIMIT 5
    `),
  ]);

  res.json({
    totals:      totals.rows[0],
    byDistrict:  byDistrict.rows,
    byDepot:     byDepot.rows,
    recent:      recent.rows,
  });
});

module.exports = router;
