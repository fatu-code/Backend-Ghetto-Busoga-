/* One-off generator: 100 hypothetical beneficiaries -> SQL.
 * Lusoga surname + Christian/Muslim given name. Valid locations per district.
 * Run: node _gen_seed2.js  (prints SQL to stdout)
 */
const fs = require('fs');
const base = 'c:/Users/FATU/Documents/GitHub/GHETTO-BUSOGA/Ghetto-Busoga/frontend/js/';
eval(fs.readFileSync(base + 'depots.js', 'utf8').replace('const DEPOTS', 'globalThis.DEPOTS'));
eval(fs.readFileSync(base + 'locations.js', 'utf8').replace('const LOCATIONS', 'globalThis.LOCATIONS'));

// deterministic RNG (LCG) so output is reproducible
let seed = 73519;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = a => a[Math.floor(rnd() * a.length)];
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const phone = () => { let s = '07'; for (let i = 0; i < 8; i++) s += ri(0, 9); return s; };

const SURNAMES = ['Nabirye','Mukose','Nandhego','Isabirye','Waiswa','Balidawa','Kagoda','Menya','Magombe','Naigaga','Babirye','Tenywa','Kirunda','Nangobi','Namukose','Mukeba','Bakaki','Mbayo','Gonza','Kawudha','Mwebaza','Mutesi','Maganda','Mukabire','Namusobya','Tibenda','Namukasa','Nakirya','Nambi','Mawogole','Namugaya','Biribawa','Mulinda','Namusosa','Nkono','Namaganda','Bateganya','Mukyeya','Nambweira','Namulondo','Musobya','Budde','Aliyinza','Nkaye','Wambi','Kakaire','Isiko','Izimba','Wandera','Kisige','Wabwire','Ntege','Bagonza','Kaaya','Mukama','Naluwairo','Kataike','Batambuze','Nkutu','Nadiope','Gabula','Zibondo','Ngobi','Bukenya','Wambuzi','Muyodi','Balikoowa','Wairagala','Tigawalana','Kintu','Waako','Bwogi','Lubega','Tabula','Mutyaba','Kasadha','Wakooli'];

const F_CHR = ['Justine','Mary','Sarah','Grace','Joyce','Betty','Juliet','Jennifer','Annet','Florence','Rose','Faith','Esther','Joan','Lydia','Resty','Harriet','Prossy','Deborah','Catherine','Christine','Margaret','Agnes','Brenda','Sandra','Sylvia','Maureen','Doreen','Edith','Irene','Winnie','Stella','Hellen','Phiona','Ruth','Naome','Immaculate','Proscovia','Scovia'];
const M_CHR = ['John','Peter','Paul','James','Joseph','David','Robert','George','Stephen','Henry','Richard','Patrick','Moses','Daniel','Samuel','Michael','Charles','Francis','Andrew','Emmanuel','Isaac','Joshua','Simon','Edward','Martin','Vincent','Lawrence','Geofrey','Ronald','Bosco','Tom','Brian','Allan','Ivan','Derrick','Joel','Timothy','Mark','Philip','Fred','Wilson','Nelson','Dennis'];
const F_MUS = ['Fatuma','Hadijah','Aisha','Zaina','Zaitun','Shamira','Madina','Sumaya','Halima','Sania','Rehema','Zakia','Hawa','Shadia','Saidah','Amina','Asia','Maimuna','Swabra','Nasifa','Ramula','Sauya','Jamira','Tausi','Naima','Mariam','Salima','Sharifah','Faridah','Rashidah','Zulaika'];
const M_MUS = ['Hassan','Hussein','Ali','Musa','Yusuf','Ibrahim','Ismail','Hamza','Hakim','Karim','Rashid','Said','Nasser','Najib','Siraji','Suudi','Faluku','Abdul','Abdallah','Hamidu','Swaibu','Sula','Idi','Ramadhan','Kasim','Twaha','Shafik','Muzamiru','Sharif','Sadat','Fahad','Umar','Bashir','Yasin','Juma','Kamada'];

const DMAP = {
  JJA: 'Jinja City', JJD: 'Jinja District', IGA: 'Iganga', KLR: 'Kaliro', LUK: 'Luuka',
  MYG: 'Mayuge', NMY: 'Namayingo', BGR: 'Bugiri', BGW: 'Bugweri', NMT: 'Namutumba',
  KML: 'Kamuli', BYD: 'Buyende',
};
// district allocation totalling 100
const ALLOC = { JJA: 14, IGA: 12, JJD: 9, KML: 9, KLR: 7, LUK: 7, MYG: 7, NMY: 7, BGR: 7, BGW: 7, NMT: 7, BYD: 7 };
const AMOUNTS = [100000, 200000, 200000, 300000, 300000, 300000, 400000, 400000, 400000, 500000, 500000, 500000];

function person() {
  const female = rnd() < 0.62;
  const muslim = rnd() < 0.5;
  const given = pick(female ? (muslim ? F_MUS : F_CHR) : (muslim ? M_MUS : M_CHR));
  const name = (pick(SURNAMES) + ' ' + given).toUpperCase();
  return { name, gender: female ? 'Female' : 'Male' };
}

const rows = [];
for (const code of Object.keys(ALLOC)) {
  for (let i = 0; i < ALLOC[code]; i++) {
    const p = person();
    const g = person();                       // guarantor (name only used)
    const subs = Object.keys(LOCATIONS[code]);
    const sub = pick(subs);
    const parish = pick(LOCATIONS[code][sub]);
    const depot = pick(DEPOTS[code]);
    const amount = pick(AMOUNTS);
    const date = `2026-0${pick([4, 5])}-${String(ri(1, 28)).padStart(2, '0')}`;
    const notes = `Guarantor: ${g.name} (Tel. ${phone()})`;
    rows.push(`(next_member_id('${code}'), '${p.name}', '${phone()}', '${code}', '${DMAP[code]}', '${sub.replace(/'/g, "''")}', '${parish.replace(/'/g, "''")}', '${depot}', '${p.gender}', ${amount}, '${date}', 'Active', '${notes}')`);
  }
}

const out = `-- BGS — 100 additional hypothetical beneficiaries. Run ONCE in Supabase SQL Editor.
-- Lusoga surname + Christian/Muslim given name. IDs auto-generate (BGS-XXX-NNNN).
BEGIN;
INSERT INTO members
  (id, name, phone, district, district_name, sub_county, parish, depot, gender, amount, disbursement_date, status, notes)
VALUES
${rows.join(',\n')};
UPDATE members SET registered_by = (SELECT id FROM users WHERE username='faruk' LIMIT 1) WHERE registered_by IS NULL;
COMMIT;`;

fs.writeFileSync(__dirname + '/seed_beneficiaries_2.sql', out);
console.log(out);
