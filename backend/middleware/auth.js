const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No token provided' });

  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── ROLE-BASED ACCESS ───────────────────────────────────────────────
// Three roles:
//   admin    — full access, all 12 districts (Fatu, Al-Hajj)
//   rdc      — view-only oversight, limited to one assigned district
//   profiler — registers people in one assigned district, never sees money
// Any legacy/unknown role (e.g. an old 'staff' account) is treated as a
// full-access admin so existing logins keep working.
function accessOf(user) {
  const role = (user && user.role) || 'admin';
  const isRDC = role === 'rdc';
  const isProfiler = role === 'profiler';
  const isAdmin = !isRDC && !isProfiler;
  return {
    role,
    isAdmin,
    isRDC,
    isProfiler,
    district: (user && user.district) || null,
    scoped: isRDC || isProfiler,   // limited to their own district
    canSeeMoney: !isProfiler,      // profilers never see amounts/disbursement/repayments
    canWrite: isAdmin || isProfiler, // rdc is view-only
    canDisburse: isAdmin,          // only admins handle money
    canDelete: isAdmin,            // only admins delete records
  };
}

// Administrators only (manage users, audit log, etc.)
function requireAdmin(req, res, next) {
  if (accessOf(req.user).isAdmin) return next();
  return res.status(403).json({ error: 'Administrators only' });
}

module.exports = { requireAuth, requireAdmin, accessOf };
