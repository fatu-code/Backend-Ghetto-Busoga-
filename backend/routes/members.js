const router     = require('express').Router();
const multer     = require('multer');
const cloudinary = require('cloudinary').v2;
const QRCode     = require('qrcode');
const { requireAuth, accessOf } = require('../middleware/auth');
const { logAudit } = require('../db/audit');

// Profilers must never see money. Blank out the financial fields on the way out.
function stripMoney(row) {
  if (!row) return row;
  return { ...row, amount: 0, disbursement_date: null, repaid: 0 };
}

// ── CLOUDINARY CONFIG ───────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── MULTER - memory storage, we stream to Cloudinary ───────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith('image/'))
      return cb(new Error('Only image files are allowed'));
    cb(null, true);
  },
});

// Helper: normalise a Uganda NIN - uppercase, strip spaces
function normaliseNin(nin) {
  return (nin || '').toUpperCase().replace(/\s+/g, '').trim();
}

// Helper: basic NIN shape check (Uganda NIN is 14 alphanumeric chars, starts with C)
function isValidNin(nin) {
  return /^[A-Z0-9]{10,14}$/.test(nin);
}

// Helper: upload buffer to Cloudinary
function uploadToCloudinary(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, folder: 'bgs-members', overwrite: true, transformation: [{ width: 600, height: 600, crop: 'fill', gravity: 'face' }] },
      (err, result) => err ? reject(err) : resolve(result)
    );
    stream.end(buffer);
  });
}

// ── GET /api/members - list with filters + pagination ───────────────
router.get('/', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const acc = accessOf(req.user);
  const { q, district, depot, status, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let where = [];
  let params = [];
  let i = 1;

  if (q) {
    where.push(`(name ILIKE $${i} OR id ILIKE $${i} OR phone ILIKE $${i} OR nin ILIKE $${i})`);
    params.push(`%${q}%`); i++;
  }
  // Scoped users (RDC / Profiler) only ever see their own district.
  const districtFilter = acc.scoped ? acc.district : district;
  if (districtFilter) { where.push(`district = $${i}`); params.push(districtFilter); i++; }
  if (depot)    { where.push(`depot = $${i}`);    params.push(depot);    i++; }
  if (status)   { where.push(`status = $${i}`);   params.push(status);   i++; }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const countResult = await db.query(
    `SELECT COUNT(*) FROM members ${whereClause}`, params
  );
  const total = parseInt(countResult.rows[0].count);

  params.push(parseInt(limit), offset);
  const result = await db.query(
    `SELECT id, name, phone, district, district_name, depot, depot_role, village, gender, nin,
            photo_url, amount, disbursement_date, status, created_at,
            COALESCE(r.repaid, 0) AS repaid
       FROM members
       LEFT JOIN (SELECT member_id, SUM(amount) AS repaid FROM repayments GROUP BY member_id) r
         ON r.member_id = members.id
       ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${i} OFFSET $${i+1}`,
    params
  );

  const members = acc.canSeeMoney ? result.rows : result.rows.map(stripMoney);
  res.json({ members, total, page: parseInt(page), limit: parseInt(limit) });
});

// ── GET /api/members/:id - single member (no qr_data_url in list) ──
router.get('/:id', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const acc = accessOf(req.user);
  const { rows } = await db.query(
    'SELECT * FROM members WHERE id = $1', [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Member not found' });
  if (acc.scoped && rows[0].district !== acc.district)
    return res.status(403).json({ error: 'This record is outside your district' });
  res.json({ member: acc.canSeeMoney ? rows[0] : stripMoney(rows[0]) });
});

// ── POST /api/members - register new beneficiary ────────────────────
router.post('/', requireAuth, upload.single('photo'), async (req, res) => {
  const db = req.app.locals.db;
  const acc = accessOf(req.user);
  if (!acc.canWrite)
    return res.status(403).json({ error: 'You have view-only access and cannot register beneficiaries' });

  const { name, phone, district, district_name, sub_county, parish, depot, depot_role, village, gender, amount, disbursement_date, notes } = req.body;
  const nin = normaliseNin(req.body.nin);

  // Scoped users (Profiler) may only register into their own district.
  if (acc.scoped && district !== acc.district)
    return res.status(403).json({ error: 'You can only register beneficiaries in your assigned district' });

  // Profilers never set money; amount/date are forced empty for them.
  const amountVal = (acc.canSeeMoney && amount) ? parseInt(amount) : 0;
  const disbVal   = acc.canSeeMoney ? (disbursement_date || null) : null;

  // Profile-first: a member can be registered to a depot before any money.
  // Amount and disbursement date are optional and filled in when funds come.
  if (!name || !district || !depot)
    return res.status(400).json({ error: 'Name, district and depot are required' });
  if (!nin)
    return res.status(400).json({ error: 'NIN is required' });
  if (!isValidNin(nin))
    return res.status(400).json({ error: 'NIN looks invalid - it should be 10–14 letters/numbers (e.g. CM91...)' });

  // Block duplicate beneficiaries sharing a NIN
  const dup = await db.query('SELECT id, name FROM members WHERE nin = $1', [nin]);
  if (dup.rows[0])
    return res.status(409).json({ error: `NIN already registered to ${dup.rows[0].name} (${dup.rows[0].id})` });

  // Upload photo to Cloudinary if provided (independent of the serial number)
  let photo_url       = null;
  let photo_public_id = null;
  if (req.file) {
    const result    = await uploadToCloudinary(req.file.buffer, `member-${district}-${Date.now()}`);
    photo_url       = result.secure_url;
    photo_public_id = result.public_id;
  }

  // Assign the next serial (lowest freed number) and insert. Because serials are
  // reused, two registrations in the same district could race for the same number;
  // the id is the primary key, so on the rare clash we grab the next free one and retry.
  let rows;
  for (let attempt = 0; attempt < 5; attempt++) {
    const memberId  = (await db.query('SELECT next_member_id($1) AS id', [district])).rows[0].id;
    const verifyUrl = `${process.env.APP_URL}/verify.html?id=${memberId}`;
    const qr_data_url = await QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: 'H', margin: 2, width: 300,
      color: { dark: '#1a2e22', light: '#ffffff' },
    });
    try {
      ({ rows } = await db.query(
        `INSERT INTO members
           (id, name, phone, district, district_name, sub_county, parish, depot, village, gender, nin,
            photo_url, photo_public_id, amount, disbursement_date, notes, qr_data_url, registered_by, depot_role)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING *`,
        [memberId, name, phone, district, district_name, sub_county, parish, depot, village, gender, nin,
         photo_url, photo_public_id, amountVal, disbVal,
         notes, qr_data_url, req.user.id, depot_role || null]
      ));
      break;
    } catch (e) {
      if (e.code === '23505' && attempt < 4) continue; // serial taken in a race, try the next free number
      throw e;
    }
  }

  await logAudit(db, req, 'member.create', 'member', rows[0].id, `Profiled ${name} (${rows[0].id})`);
  res.status(201).json({ member: rows[0] });
});

// ── PUT /api/members/:id - update member ───────────────────────────
router.put('/:id', requireAuth, upload.single('photo'), async (req, res) => {
  const db = req.app.locals.db;
  const acc = accessOf(req.user);
  const { id } = req.params;

  if (!acc.canWrite)
    return res.status(403).json({ error: 'You have view-only access and cannot edit records' });

  // Fetch existing
  const existing = await db.query('SELECT * FROM members WHERE id = $1', [id]);
  if (!existing.rows[0]) return res.status(404).json({ error: 'Member not found' });
  const current = existing.rows[0];

  if (acc.scoped && current.district !== acc.district)
    return res.status(403).json({ error: 'This record is outside your district' });

  let photo_url       = current.photo_url;
  let photo_public_id = current.photo_public_id;

  if (req.file) {
    // Delete old photo from Cloudinary
    if (current.photo_public_id) {
      await cloudinary.uploader.destroy(current.photo_public_id).catch(() => {});
    }
    const result    = await uploadToCloudinary(req.file.buffer, `member-${id}`);
    photo_url       = result.secure_url;
    photo_public_id = result.public_id;
  }

  const { name, phone, district, district_name, sub_county, parish, depot, depot_role, village, gender, amount, disbursement_date, status, notes } = req.body;

  // NIN: keep existing unless a new one is supplied
  let nin = current.nin;
  if (req.body.nin !== undefined) {
    nin = normaliseNin(req.body.nin);
    if (!nin)
      return res.status(400).json({ error: 'NIN is required' });
    if (!isValidNin(nin))
      return res.status(400).json({ error: 'NIN looks invalid - it should be 10–14 letters/numbers (e.g. CM91...)' });
    if (nin !== current.nin) {
      const dup = await db.query('SELECT id, name FROM members WHERE nin = $1 AND id <> $2', [nin, id]);
      if (dup.rows[0])
        return res.status(409).json({ error: `NIN already registered to ${dup.rows[0].name} (${dup.rows[0].id})` });
    }
  }

  // Profilers can never touch money; scoped users can never move a record out of their district.
  const newAmt   = acc.canSeeMoney ? (amount ? parseInt(amount) : Number(current.amount)) : Number(current.amount);
  const newDisb  = acc.canSeeMoney ? (disbursement_date ?? current.disbursement_date) : current.disbursement_date;
  const effDist  = acc.scoped ? current.district : (district || current.district);
  const effDistN = acc.scoped ? current.district_name : (district_name || current.district_name);

  const { rows } = await db.query(
    `UPDATE members SET
       name=$1, phone=$2, district=$3, district_name=$4, sub_county=$5, parish=$6,
       depot=$7, village=$8, gender=$9, nin=$10, photo_url=$11, photo_public_id=$12,
       amount=$13, disbursement_date=$14, status=$15, notes=$16, depot_role=$17
     WHERE id=$18 RETURNING *`,
    [name || current.name, phone ?? current.phone,
     effDist, effDistN,
     sub_county ?? current.sub_county, parish ?? current.parish,
     depot || current.depot, village ?? current.village,
     gender || current.gender, nin, photo_url, photo_public_id,
     newAmt, newDisb,
     status || current.status, notes ?? current.notes,
     depot_role ?? current.depot_role, id]
  );

  const disbursing = Number(current.amount) === 0 && newAmt > 0;
  await logAudit(db, req, disbursing ? 'member.disburse' : 'member.update', 'member', id,
    disbursing
      ? `Disbursed UGX ${newAmt.toLocaleString('en-UG')} to ${name || current.name} (${id})`
      : `Updated ${name || current.name} (${id})`);

  res.json({ member: rows[0] });
});

// ── BULK DISBURSE (admin only) ──────────────────────────────────────
// Disburse many beneficiaries in one request. Only members not yet disbursed
// (amount = 0) are touched, so re-running can never double-disburse anyone.
router.post('/disburse-bulk', requireAuth, async (req, res) => {
  if (!accessOf(req.user).canDisburse)
    return res.status(403).json({ error: 'Only an administrator can disburse funds' });
  const db = req.app.locals.db;
  const date = req.body.date || new Date();
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: 'No beneficiaries were selected' });

  let disbursed = 0, total = 0;
  for (const it of items) {
    const amt = parseInt(it.amount);
    if (!it || !it.id || !amt || amt <= 0) continue;
    const r = await db.query(
      `UPDATE members SET amount = $1, disbursement_date = $2
         WHERE id = $3 AND amount = 0
       RETURNING id, name`,
      [amt, date, it.id]
    );
    if (r.rows[0]) {
      disbursed++; total += amt;
      await logAudit(db, req, 'member.disburse', 'member', it.id,
        `Disbursed UGX ${amt.toLocaleString('en-UG')} to ${r.rows[0].name} (${it.id})`);
    }
  }
  res.json({ disbursed, total, skipped: items.length - disbursed });
});

// ── DELETE /api/members/:id ─────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  if (!accessOf(req.user).canDelete)
    return res.status(403).json({ error: 'Only an administrator can delete records' });
  const { rows } = await db.query('SELECT photo_public_id FROM members WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Member not found' });

  if (rows[0].photo_public_id) {
    await cloudinary.uploader.destroy(rows[0].photo_public_id).catch(() => {});
  }
  await db.query('DELETE FROM members WHERE id = $1', [req.params.id]);
  await logAudit(db, req, 'member.delete', 'member', req.params.id, `Deleted member ${req.params.id}`);
  res.json({ success: true });
});

// ── REPAYMENTS ──────────────────────────────────────────────────────
// List repayments for a member (+ total repaid).
router.get('/:id/repayments', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const acc = accessOf(req.user);
  if (!acc.canSeeMoney)
    return res.status(403).json({ error: 'You do not have access to repayments' });
  // Scoped users may only view repayments within their district.
  if (acc.scoped) {
    const m = await db.query('SELECT district FROM members WHERE id = $1', [req.params.id]);
    if (m.rows[0] && m.rows[0].district !== acc.district)
      return res.status(403).json({ error: 'This record is outside your district' });
  }
  const { rows } = await db.query(
    'SELECT id, amount, paid_on, created_at FROM repayments WHERE member_id = $1 ORDER BY paid_on DESC, id DESC',
    [req.params.id]
  );
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  res.json({ repayments: rows, total_repaid: total });
});

// Record a repayment against a disbursed member. Money action - admins only.
router.post('/:id/repayments', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  if (!accessOf(req.user).canDisburse)
    return res.status(403).json({ error: 'Only an administrator can record repayments' });
  const { id } = req.params;
  const member = await db.query('SELECT id, name, amount FROM members WHERE id = $1', [id]);
  if (!member.rows[0]) return res.status(404).json({ error: 'Member not found' });
  if (!(Number(member.rows[0].amount) > 0))
    return res.status(400).json({ error: 'This member has not been disbursed yet, so there is nothing to repay' });

  const amt = parseInt(req.body.amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Enter a valid repayment amount' });

  // Never let a loan be repaid beyond what is owed (principal + 6%).
  const sumRes = await db.query('SELECT COALESCE(SUM(amount), 0) AS repaid FROM repayments WHERE member_id = $1', [id]);
  const alreadyRepaid = Number(sumRes.rows[0].repaid);
  const totalDue = Math.round(Number(member.rows[0].amount) * 1.06);
  const outstanding = totalDue - alreadyRepaid;
  if (outstanding <= 0)
    return res.status(400).json({ error: 'This loan is already fully cleared. Nothing more is owed.' });
  if (amt > outstanding)
    return res.status(400).json({ error: `That is more than the outstanding balance. Only UGX ${outstanding.toLocaleString('en-UG')} remains.` });

  await db.query(
    'INSERT INTO repayments (member_id, amount, paid_on, recorded_by) VALUES ($1,$2,$3,$4)',
    [id, amt, req.body.paid_on || new Date(), req.user.id]
  );
  const { rows } = await db.query(
    'SELECT id, amount, paid_on, created_at FROM repayments WHERE member_id = $1 ORDER BY paid_on DESC, id DESC',
    [id]
  );
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  await logAudit(db, req, 'repayment.add', 'member', id, `Recorded UGX ${amt.toLocaleString('en-UG')} repayment for ${member.rows[0].name} (${id})`);
  res.status(201).json({ repayments: rows, total_repaid: total });
});

module.exports = router;
