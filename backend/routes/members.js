const router     = require('express').Router();
const multer     = require('multer');
const cloudinary = require('cloudinary').v2;
const QRCode     = require('qrcode');
const { requireAuth } = require('../middleware/auth');

// ── CLOUDINARY CONFIG ───────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── MULTER — memory storage, we stream to Cloudinary ───────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith('image/'))
      return cb(new Error('Only image files are allowed'));
    cb(null, true);
  },
});

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

// ── GET /api/members — list with filters + pagination ───────────────
router.get('/', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { q, district, depot, status, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let where = [];
  let params = [];
  let i = 1;

  if (q) {
    where.push(`(name ILIKE $${i} OR id ILIKE $${i} OR phone ILIKE $${i})`);
    params.push(`%${q}%`); i++;
  }
  if (district) { where.push(`district = $${i}`); params.push(district); i++; }
  if (depot)    { where.push(`depot = $${i}`);    params.push(depot);    i++; }
  if (status)   { where.push(`status = $${i}`);   params.push(status);   i++; }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const countResult = await db.query(
    `SELECT COUNT(*) FROM members ${whereClause}`, params
  );
  const total = parseInt(countResult.rows[0].count);

  params.push(parseInt(limit), offset);
  const result = await db.query(
    `SELECT id, name, phone, district, district_name, depot, village, gender,
            photo_url, amount, disbursement_date, status, created_at
       FROM members ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${i} OFFSET $${i+1}`,
    params
  );

  res.json({ members: result.rows, total, page: parseInt(page), limit: parseInt(limit) });
});

// ── GET /api/members/:id — single member (no qr_data_url in list) ──
router.get('/:id', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { rows } = await db.query(
    'SELECT * FROM members WHERE id = $1', [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Member not found' });
  res.json({ member: rows[0] });
});

// ── POST /api/members — register new beneficiary ────────────────────
router.post('/', requireAuth, upload.single('photo'), async (req, res) => {
  const db = req.app.locals.db;
  const { name, phone, district, district_name, depot, village, gender, amount, disbursement_date, notes } = req.body;

  if (!name || !district || !depot || !amount)
    return res.status(400).json({ error: 'Name, district, depot and amount are required' });

  // Generate member ID
  const idResult = await db.query('SELECT next_member_id($1) AS id', [district]);
  const memberId = idResult.rows[0].id;

  // Upload photo to Cloudinary if provided
  let photo_url       = null;
  let photo_public_id = null;
  if (req.file) {
    const result    = await uploadToCloudinary(req.file.buffer, `member-${memberId}`);
    photo_url       = result.secure_url;
    photo_public_id = result.public_id;
  }

  // Generate QR code
  const verifyUrl  = `${process.env.APP_URL}/verify.html?id=${memberId}`;
  const qr_data_url = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 300,
    color: { dark: '#1a2e22', light: '#ffffff' },
  });

  const { rows } = await db.query(
    `INSERT INTO members
       (id, name, phone, district, district_name, depot, village, gender,
        photo_url, photo_public_id, amount, disbursement_date, notes, qr_data_url, registered_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [memberId, name, phone, district, district_name, depot, village, gender,
     photo_url, photo_public_id, parseInt(amount), disbursement_date || null,
     notes, qr_data_url, req.user.id]
  );

  res.status(201).json({ member: rows[0] });
});

// ── PUT /api/members/:id — update member ───────────────────────────
router.put('/:id', requireAuth, upload.single('photo'), async (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;

  // Fetch existing
  const existing = await db.query('SELECT * FROM members WHERE id = $1', [id]);
  if (!existing.rows[0]) return res.status(404).json({ error: 'Member not found' });
  const current = existing.rows[0];

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

  const { name, phone, district, district_name, depot, village, gender, amount, disbursement_date, status, notes } = req.body;

  const { rows } = await db.query(
    `UPDATE members SET
       name=$1, phone=$2, district=$3, district_name=$4, depot=$5, village=$6,
       gender=$7, photo_url=$8, photo_public_id=$9, amount=$10,
       disbursement_date=$11, status=$12, notes=$13
     WHERE id=$14 RETURNING *`,
    [name || current.name, phone ?? current.phone,
     district || current.district, district_name || current.district_name,
     depot || current.depot, village ?? current.village,
     gender || current.gender, photo_url, photo_public_id,
     amount ? parseInt(amount) : current.amount,
     disbursement_date ?? current.disbursement_date,
     status || current.status, notes ?? current.notes, id]
  );

  res.json({ member: rows[0] });
});

// ── DELETE /api/members/:id ─────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { rows } = await db.query('SELECT photo_public_id FROM members WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Member not found' });

  if (rows[0].photo_public_id) {
    await cloudinary.uploader.destroy(rows[0].photo_public_id).catch(() => {});
  }
  await db.query('DELETE FROM members WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
