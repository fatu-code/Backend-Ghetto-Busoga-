// ── BGS SEED SCRIPT ─────────────────────────────────────────────────
// Inserts ~100 sample beneficiaries with real serial IDs + working QR
// codes. Photos are left blank on purpose — the UI falls back to initials.
//
// Run from the backend folder:   node db/seed.js
// Requires DATABASE_URL (and optionally APP_URL) in your .env, same as the
// server. Safe to re-run — it keeps adding fresh records with new serials.
// ────────────────────────────────────────────────────────────────────
require('dotenv').config();
const { Pool } = require('pg');
const QRCode   = require('qrcode');

const COUNT    = 100;
const APP_URL  = process.env.APP_URL || 'https://backend-ghetto-busoga-production.up.railway.app';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Districts (code → name) and a few real depots/towns per district
const DISTRICTS = [
  { code: 'JJA', name: 'Jinja City',     depots: ['Wakitaka', 'Bugembe', 'Mpumudde', 'Walukuba', 'Masese'] },
  { code: 'JJD', name: 'Jinja District', depots: ['Buwenge', 'Budondo', 'Kakira', 'Buyengo'] },
  { code: 'IGA', name: 'Iganga',         depots: ['Iganga Central', 'Nakalama', 'Nakigo', 'Bulamagi'] },
  { code: 'KLR', name: 'Kaliro',         depots: ['Kaliro Town', 'Bumanya', 'Nawaikoke'] },
  { code: 'LUK', name: 'Luuka',          depots: ['Luuka Central', 'Bukooma', 'Ikumbya'] },
  { code: 'MYG', name: 'Mayuge',         depots: ['Mayuge Town', 'Bukatube', 'Kityerera'] },
  { code: 'NMY', name: 'Namayingo',      depots: ['Namayingo Town', 'Buswale', 'Banda'] },
  { code: 'BGR', name: 'Bugiri',         depots: ['Bugiri Town', 'Buluguyi', 'Nankoma'] },
  { code: 'BGW', name: 'Bugweri',        depots: ['Idudi', 'Makuutu', 'Igombe'] },
  { code: 'NMT', name: 'Namutumba',      depots: ['Namutumba Town', 'Nsinze', 'Ivukula'] },
  { code: 'KML', name: 'Kamuli',         depots: ['Kamuli Town', 'Namwendwa', 'Balawoli'] },
  { code: 'BYD', name: 'Buyende',        depots: ['Buyende Town', 'Kidera', 'Bugaya'] },
];

const MALE_NAMES = [
  'John', 'Patrick', 'David', 'Moses', 'Isaac', 'Robert', 'Samuel', 'Joseph', 'Peter', 'Henry',
  'Ronald', 'Fred', 'Emmanuel', 'Andrew', 'Geofrey', 'Stephen', 'Wilson', 'Brian', 'Tom', 'James',
  'Abdul', 'Hassan', 'Musa', 'Ibrahim', 'Yusuf', 'Hamza', 'Ramadhan', 'Swaibu', 'Badru', 'Idi',
];
const FEMALE_NAMES = [
  'Annet', 'Sarah', 'Grace', 'Mary', 'Esther', 'Florence', 'Jane', 'Rebecca', 'Joan', 'Betty',
  'Christine', 'Justine', 'Sylvia', 'Ruth', 'Harriet', 'Sumaya', 'Hadijah', 'Fatuma', 'Aisha', 'Zaina',
  'Madina', 'Shamim', 'Halima', 'Rashida', 'Sauda', 'Nuru', 'Sophia', 'Phiona', 'Doreen', 'Brenda',
];
const SURNAMES = [
  'Mukasa', 'Okello', 'Musoke', 'Kato', 'Nanyonga', 'Namutebi', 'Waiswa', 'Balikowa', 'Isabirye', 'Mugema',
  'Tenywa', 'Kirunda', 'Naigaga', 'Babirye', 'Nabirye', 'Mutesi', 'Kawuki', 'Lubega', 'Ssali', 'Ssempala',
  'Magoba', 'Bwire', 'Wandera', 'Mukose', 'Nabbosa', 'Kisakye', 'Mubiru', 'Galiwango', 'Ssentongo', 'Namukose',
];

const rand  = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Unique-ish Uganda NIN: CM (male) / CF (female) + 12 alphanumerics = 14 chars
const usedNins = new Set();
function makeNin(gender) {
  const chars = 'ABCDEFGHJKLMNPQRTUVWXYZ0123456789';
  let nin;
  do {
    let body = '';
    for (let k = 0; k < 12; k++) body += chars[Math.floor(Math.random() * chars.length)];
    nin = (gender === 'Female' ? 'CF' : 'CM') + body;
  } while (usedNins.has(nin));
  usedNins.add(nin);
  return nin;
}

function makeDate() {
  // random day within the last ~180 days
  const d = new Date();
  d.setDate(d.getDate() - randInt(1, 180));
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function seed() {
  const db = await pool.connect();
  try {
    // Attribute records to the default admin if present
    const admin = await db.query("SELECT id FROM users WHERE username = 'faruk' LIMIT 1");
    const registeredBy = admin.rows[0]?.id || null;

    let inserted = 0;
    for (let n = 0; n < COUNT; n++) {
      const district = rand(DISTRICTS);
      const gender   = Math.random() < 0.5 ? 'Male' : 'Female';
      const first    = gender === 'Female' ? rand(FEMALE_NAMES) : rand(MALE_NAMES);
      const name     = `${first} ${rand(SURNAMES)}`;
      const depot    = rand(district.depots);
      const village  = depot; // village within the depot's town
      const nin      = makeNin(gender);
      const amount   = randInt(6, 20) * 50000;       // 300,000 – 1,000,000
      const date     = makeDate();
      const phone    = '+2567' + randInt(0, 9) + String(randInt(0, 9999999)).padStart(7, '0');

      // Real serial ID, exactly like the register endpoint
      const idRes    = await db.query('SELECT next_member_id($1) AS id', [district.code]);
      const memberId = idRes.rows[0].id;

      // Working QR that points at the public verify page
      const verifyUrl = `${APP_URL}/verify.html?id=${memberId}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        errorCorrectionLevel: 'H', margin: 2, width: 300,
        color: { dark: '#1a2e22', light: '#ffffff' },
      });

      await db.query(
        `INSERT INTO members
           (id, name, phone, district, district_name, depot, village, gender, nin,
            photo_url, photo_public_id, amount, disbursement_date, status, notes, qr_data_url, registered_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (id) DO NOTHING`,
        [memberId, name, phone, district.code, district.name, depot, village, gender, nin,
         null, null, amount, date, 'Active', null, qrDataUrl, registeredBy]
      );
      inserted++;
      if (inserted % 20 === 0) console.log(`  …${inserted}/${COUNT}`);
    }

    console.log(`\n✅ Seeded ${inserted} beneficiaries (no photos — UI shows initials).`);
  } finally {
    db.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
