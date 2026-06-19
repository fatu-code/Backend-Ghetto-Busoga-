const router = require('express').Router();
const { requireAuth, accessOf } = require('../middleware/auth');
const cache = require('../cache');

// GET /api/stats
router.get('/', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const acc = accessOf(req.user);

  // Scoped users (RDC / Profiler) see totals for their own district only.
  const scoped   = acc.scoped;
  const memWhere = scoped ? 'WHERE district = $1' : '';
  const repWhere = scoped ? 'JOIN members m ON r.member_id = m.id WHERE m.district = $1' : '';
  const ovDist   = scoped ? 'AND m.district = $1' : '';
  const dparams  = scoped ? [acc.district] : [];

  // Cache the raw aggregates per scope. Money is blanked per-user below into NEW
  // objects, so the cached rows are never mutated and stay safe to reuse.
  const cacheKey = 'stats:' + (scoped ? acc.district : 'all');
  let raw = cache.get(cacheKey);
  if (!raw) {
  const [totals, byDistrict, byDepot, recent] = await Promise.all([
    db.query(`
      SELECT
        COUNT(*)                       AS total_members,
        SUM(amount)                    AS total_disbursed,
        COUNT(DISTINCT district)       AS districts_covered,
        COUNT(DISTINCT depot)          AS total_depots,
        COUNT(*) FILTER (WHERE status = 'Active') AS active_members,
        COUNT(*) FILTER (WHERE amount > 0)        AS disbursed_count,
        (SELECT COALESCE(SUM(r.amount), 0) FROM repayments r ${repWhere}) AS total_repaid,
        (SELECT COUNT(*) FROM members m
           WHERE m.amount > 0 AND m.disbursement_date IS NOT NULL
             AND m.disbursement_date + INTERVAL '12 months' < CURRENT_DATE
             AND (m.amount * 1.06) > COALESCE((SELECT SUM(r.amount) FROM repayments r WHERE r.member_id = m.id), 0)
             ${ovDist}
        ) AS overdue_count
      FROM members ${memWhere}
    `, dparams),
    db.query(`
      SELECT district, district_name,
             COUNT(*)     AS member_count,
             COUNT(*) FILTER (WHERE amount > 0) AS disbursed_count,
             SUM(amount)  AS total_amount
        FROM members ${memWhere}
       GROUP BY district, district_name
       ORDER BY total_amount DESC NULLS LAST, member_count DESC
    `, dparams),
    db.query(`
      SELECT depot, district_name,
             COUNT(*)    AS member_count,
             SUM(amount) AS total_amount
        FROM members ${memWhere}
       GROUP BY depot, district_name
       ORDER BY member_count DESC
       LIMIT 10
    `, dparams),
    db.query(`
      SELECT id, name, district_name, depot, amount, disbursement_date, photo_url, created_at
        FROM members ${memWhere}
       ORDER BY created_at DESC
       LIMIT 5
    `, dparams),
  ]);
    raw = {
      totals:     totals.rows[0] || {},
      byDistrict: byDistrict.rows,
      byDepot:    byDepot.rows,
      recent:     recent.rows,
    };
    cache.set(cacheKey, raw);
  }

  // Profilers never see money - blank it into NEW objects (never touch the cache).
  if (!acc.canSeeMoney) {
    return res.json({
      totals: { ...raw.totals, total_disbursed: null, total_repaid: null, overdue_count: null, disbursed_count: null },
      byDistrict: raw.byDistrict.map(r => ({ ...r, total_amount: null, disbursed_count: null })),
      byDepot:    raw.byDepot.map(r => ({ ...r, total_amount: null })),
      recent:     raw.recent.map(r => ({ ...r, amount: null, disbursement_date: null })),
    });
  }

  res.json(raw);
});

module.exports = router;
