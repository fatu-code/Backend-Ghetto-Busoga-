require('dotenv').config();
require('express-async-errors');

const express     = require('express');
const cors        = require('cors');
const compression = require('compression');
const path        = require('path');
const { Pool } = require('pg');

const app = express();

// ── DATABASE ────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,                       // keep a small warm pool of reusable connections
  keepAlive: true,               // reuse the TCP socket instead of re-handshaking
  idleTimeoutMillis: 30000,      // drop idle connections after 30s
  connectionTimeoutMillis: 10000, // fail fast instead of hanging if the DB is slow
  statement_timeout: 15000,      // never let a single query hang the request
});
app.locals.db = pool;

// ── MIDDLEWARE ──────────────────────────────────────────────────────
app.use(compression()); // gzip JSON responses (big member lists shrink a lot)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API ROUTES ──────────────────────────────────────────────────────
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/members', require('./routes/members'));
app.use('/api/verify',  require('./routes/verify'));
app.use('/api/stats',   require('./routes/stats'));
app.use('/api/users',   require('./routes/users'));
app.use('/api/audit',   require('./routes/audit'));
app.use('/api/depots',  require('./routes/depots'));

// ── HEALTH CHECK ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── PUBLIC VERIFICATION PAGE ────────────────────────────────────────
// Scanned from the QR on a beneficiary card. Served by the backend so it
// is reachable from any phone (the frontend may be local/Live Server).
app.get('/v/:id', async (req, res) => {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const initials = (name) => ((name || '').trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0] || '').join('').toUpperCase() || '?');
  const fmt = (n) => Number(n || 0).toLocaleString('en-UG');
  const maskNin = (nin) => !nin ? '-'
    : (nin.length <= 8 ? nin[0] + '•'.repeat(Math.max(1, nin.length - 1))
      : nin.slice(0, 4) + '•'.repeat(nin.length - 8) + nin.slice(-4));
  const fmtDate = (d) => {
    if (!d) return '-';
    const x = new Date(d);
    return isNaN(x) ? '-'
      : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const { rows } = await pool.query(
    `SELECT id, name, district_name, depot, sub_county, village, gender,
            nin, photo_url, amount, disbursement_date, status
       FROM members WHERE id = $1`,
    [req.params.id]
  );
  const m = rows[0];
  res.set('Content-Type', 'text/html; charset=utf-8');

  const shell = (body) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Beneficiary Verification</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#e9efeb;color:#1c3326;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:18px}
  .wrap{width:100%;max-width:430px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.1);margin-top:14px}
  .hd{background:linear-gradient(125deg,#16271d 0%,#0c4a2b 55%,#0a7a3a 100%);color:#fff;padding:20px;text-align:center;position:relative;overflow:hidden}
  .hd::after{content:"";position:absolute;right:-40px;top:-60px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.05)}
  .hd .prog{font-size:1rem;font-weight:800;line-height:1.2;position:relative}
  .hd .off{font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.16em;color:rgba(255,255,255,.62);margin-top:7px;position:relative}
  .badge{display:inline-flex;align-items:center;gap:7px;background:#eaf7f0;color:#007a33;border:1.5px solid #b3e6c8;border-radius:100px;padding:7px 16px;font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em;margin:18px auto 4px}
  .badge .dot{width:9px;height:9px;border-radius:50%;background:#009c41}
  .ident{text-align:center;padding:8px 22px 4px}
  .photo,.ph{width:96px;height:96px;border-radius:18px;margin:0 auto 12px}
  .photo{object-fit:cover}
  .ph{background:#eaf7f0;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:800;color:#009c41}
  .nm{font-size:1.4rem;font-weight:800;line-height:1.1}
  .sid{font-size:.92rem;font-weight:800;color:#009c41;letter-spacing:.04em;margin-top:5px}
  .rows{padding:14px 22px 6px}
  .row{display:flex;justify-content:space-between;gap:14px;padding:11px 0;border-bottom:1px solid #eef2f0;font-size:.86rem}
  .row .k{font-weight:700;color:#7a8e83}
  .row .v{font-weight:800;color:#1c3326;text-align:right}
  .row .v.amt{color:#009c41;font-size:1rem}
  .ft{padding:16px 22px 22px;text-align:center;font-size:.66rem;font-weight:700;color:#9aa8a0;line-height:1.6}
  .nf{padding:46px 24px;text-align:center}
  .nf .x{font-size:2.4rem;margin-bottom:10px}
  .nf h1{font-size:1.2rem;color:#142a1d}
  .nf p{font-size:.86rem;color:#7a8e83;margin-top:8px}
</style></head><body><div class="wrap">${body}</div></body></html>`;

  if (!m) {
    return res.status(404).send(shell(`
      <div class="hd"><div class="prog">Busoga Ghetto Presidential Empowerment Fund</div>
        <div class="off">Office of the Special Presidential Assistant, State House Uganda</div></div>
      <div class="nf"><div class="x">&#9888;</div><h1>Beneficiary not found</h1>
        <p>No record matches this code. It may be invalid or withdrawn.</p></div>`));
  }

  const photo = m.photo_url
    ? `<img class="photo" src="${esc(m.photo_url)}" alt="">`
    : `<div class="ph">${esc(initials(m.name))}</div>`;

  res.send(shell(`
    <div class="hd">
      <div class="prog">Busoga Ghetto Presidential Empowerment Fund</div>
      <div class="off">Office of the Special Presidential Assistant, State House Uganda</div>
    </div>
    <div style="text-align:center"><span class="badge"><span class="dot"></span>Verified Beneficiary</span></div>
    <div class="ident">
      ${photo}
      <div class="nm">${esc(m.name)}</div>
      <div class="sid">${esc(m.id)}</div>
    </div>
    <div class="rows">
      <div class="row"><span class="k">Status</span><span class="v">${esc(m.status || 'Active')}</span></div>
      <div class="row"><span class="k">District</span><span class="v">${esc(m.district_name)}</span></div>
      <div class="row"><span class="k">Depot (Ghetto Cell)</span><span class="v">${esc(m.depot)}</span></div>
      ${m.sub_county ? `<div class="row"><span class="k">Sub-County</span><span class="v">${esc(m.sub_county)}</span></div>` : ''}
      <div class="row"><span class="k">National ID (NIN)</span><span class="v">${esc(maskNin(m.nin))}</span></div>
      <div class="row"><span class="k">Disbursed</span><span class="v">${esc(fmtDate(m.disbursement_date))}</span></div>
      <div class="row"><span class="k">Amount Received</span><span class="v amt">UGX ${esc(fmt(m.amount))}</span></div>
    </div>
    <div class="ft">This record is maintained by the Busoga Ghetto Presidential Empowerment Fund<br>under the Office of the Special Presidential Assistant, State House Uganda.</div>`));
});

// ── ERROR HANDLER ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── START ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BGS running on port ${PORT}`));

module.exports = app;
