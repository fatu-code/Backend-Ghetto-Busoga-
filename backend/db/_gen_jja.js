/* Generate 200 profiled members for Jinja City: 10 per depot (20 depots).
 * First 5 of each depot get the leadership roles. Profile-first (no money).
 * Run: node _gen_jja.js head | tail   (also writes seed_jja.sql)
 */
const fs = require('fs');
const base = 'c:/Users/FATU/Documents/GitHub/GHETTO-BUSOGA/Ghetto-Busoga/frontend/js/';
eval(fs.readFileSync(base + 'depots.js', 'utf8').replace('const DEPOTS', 'globalThis.DEPOTS'));
eval(fs.readFileSync(base + 'locations.js', 'utf8').replace('const LOCATIONS', 'globalThis.LOCATIONS'));

let seed = 20260603;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = a => a[Math.floor(rnd() * a.length)];
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const phone = () => { let s = '07'; for (let i = 0; i < 8; i++) s += ri(0, 9); return s; };

const SUR = ['Nabirye','Mukose','Nandhego','Isabirye','Waiswa','Balidawa','Kagoda','Menya','Magombe','Naigaga','Babirye','Tenywa','Kirunda','Nangobi','Namukose','Mukeba','Bakaki','Mbayo','Gonza','Kawudha','Mwebaza','Mutesi','Maganda','Mukabire','Namusobya','Tibenda','Namukasa','Nakirya','Nambi','Mawogole','Namugaya','Biribawa','Mulinda','Nkono','Namaganda','Bateganya','Nambweira','Namulondo','Musobya','Budde','Aliyinza','Nkaye','Wambi','Kakaire','Isiko','Izimba','Wandera','Kisige','Wabwire','Ntege','Bagonza','Kaaya','Mukama','Naluwairo','Kataike','Batambuze','Nkutu','Gabula','Zibondo','Ngobi','Bukenya','Wambuzi','Kintu','Waako','Lubega','Kasadha','Wakooli','Mutyaba'];
const F_CHR = ['Justine','Mary','Sarah','Grace','Joyce','Betty','Juliet','Jennifer','Annet','Florence','Rose','Faith','Esther','Joan','Lydia','Resty','Harriet','Prossy','Deborah','Catherine','Christine','Margaret','Agnes','Brenda','Sandra','Sylvia','Maureen','Doreen','Edith','Irene','Winnie','Stella','Hellen','Phiona','Ruth','Immaculate','Proscovia','Scovia'];
const M_CHR = ['John','Peter','Paul','James','Joseph','David','Robert','George','Stephen','Henry','Richard','Patrick','Moses','Daniel','Samuel','Michael','Charles','Francis','Andrew','Emmanuel','Isaac','Joshua','Simon','Edward','Martin','Vincent','Lawrence','Geofrey','Ronald','Bosco','Tom','Brian','Allan','Ivan','Derrick','Joel','Timothy','Mark','Fred','Wilson','Dennis'];
const F_MUS = ['Fatuma','Hadijah','Aisha','Zaina','Zaitun','Shamira','Madina','Sumaya','Halima','Sania','Rehema','Zakia','Hawa','Shadia','Saidah','Amina','Asia','Maimuna','Swabra','Nasifa','Ramula','Jamira','Tausi','Naima','Mariam','Salima','Sharifah','Faridah','Rashidah','Zulaika'];
const M_MUS = ['Hassan','Hussein','Ali','Musa','Yusuf','Ibrahim','Ismail','Hamza','Hakim','Karim','Rashid','Said','Nasser','Najib','Siraji','Suudi','Faluku','Abdul','Abdallah','Hamidu','Swaibu','Sula','Idi','Ramadhan','Kasim','Twaha','Shafik','Muzamiru','Sharif','Sadat','Fahad','Umar','Bashir','Yasin','Juma'];

function person() {
  const female = rnd() < 0.6;
  const muslim = rnd() < 0.5;
  const given = pick(female ? (muslim ? F_MUS : F_CHR) : (muslim ? M_MUS : M_CHR));
  return { name: (pick(SUR) + ' ' + given).toUpperCase(), gender: female ? 'Female' : 'Male' };
}

const ROLES = ['Chairperson', 'Vice Chairperson', 'Treasurer', 'Secretary', 'Publicity'];
const esc = s => s.replace(/'/g, "''");
const subs = Object.keys(LOCATIONS.JJA);

const rows = [];
DEPOTS.JJA.forEach(dep => {
  for (let i = 0; i < 10; i++) {
    const p = person();
    const sub = pick(subs);
    const parish = pick(LOCATIONS.JJA[sub]);
    const role = i < 5 ? ROLES[i] : '';
    const ph = phone();
    rows.push(`(next_member_id('JJA'), '${esc(p.name)}', '${ph}', 'JJA', 'Jinja City', '${esc(sub)}', '${esc(parish)}', '${esc(dep)}', ${role ? `'${role}'` : 'NULL'}, '${p.gender}', 0, NULL, 'Active')`);
  }
});

const HEAD = `-- BGS - 200 profiled members for Jinja City (10 per depot; first 5 per depot are the leaders).
-- Profile-first: no money yet, everyone is Pending. Run ONCE in Supabase (after the depot_role migration).
BEGIN;
INSERT INTO members
  (id, name, phone, district, district_name, sub_county, parish, depot, depot_role, gender, amount, disbursement_date, status)
VALUES`;
const FOOT = `;
UPDATE members SET registered_by = (SELECT id FROM users WHERE username='faruk' LIMIT 1) WHERE registered_by IS NULL;
COMMIT;`;

fs.writeFileSync(__dirname + '/seed_jja.sql', HEAD + '\n' + rows.join(',\n') + FOOT);

// Each block is a COMPLETE, standalone INSERT statement so it can be run on its own.
const COLS = `INSERT INTO members
  (id, name, phone, district, district_name, sub_county, parish, depot, depot_role, gender, amount, disbursement_date, status)
VALUES`;
const arg = process.argv[2];
if (arg === 'head') {
  console.log('-- BLOCK 1 of 2 (Jinja City members 1-100). Run this whole block.');
  console.log(COLS);
  console.log(rows.slice(0, 100).join(',\n') + ';');
} else if (arg === 'tail') {
  console.log('-- BLOCK 2 of 2 (Jinja City members 101-200). Run this whole block.');
  console.log(COLS);
  console.log(rows.slice(100).join(',\n') + ';');
  console.log("UPDATE members SET registered_by = (SELECT id FROM users WHERE username='faruk' LIMIT 1) WHERE registered_by IS NULL;");
} else { console.log('rows:', rows.length); }
