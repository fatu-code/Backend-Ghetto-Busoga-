-- ─────────────────────────────────────────────────────────────────────
-- BGS — Beneficiary seed data (42 beneficiaries)
-- Run ONCE in the Supabase SQL Editor (after init.sql has been run).
--
-- Notes:
--  * IDs are auto-generated per district via next_member_id() -> BGS-XXX-NNNN
--  * Amounts are rounded to the nearest UGX 100,000, min 100,000, max 500,000
--  * Each loan Guarantor (name + phone) is stored in the notes column
--  * Gender is inferred from given names and should be verified by staff
--  * registered_by is attributed to the 'faruk' admin user
--  * Re-running this script will create DUPLICATES (IDs auto-increment) — run once
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

INSERT INTO members
  (id, name, phone, district, district_name, sub_county, parish, depot, gender, amount, disbursement_date, status, notes, registered_by)
VALUES
-- ── JINJA CITY (JJA) ───────────────────────────────────────────────
(next_member_id('JJA'), 'NABIRYE JUSTINE', '0778151303', 'JJA', 'Jinja City', 'Jinja South Division', 'Walukuba West', 'Walukuba',  'Female', 300000, '2026-01-20', 'Active', 'Guarantor: MUWEREZA SUUDI (Tel. 0759520429)', (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('JJA'), 'TIBENDA BETTY',   '0777526469', 'JJA', 'Jinja City', 'Jinja South Division', 'Masese Ward',   'Masese',    'Female', 400000, '2026-01-20', 'Active', 'Guarantor: TIBENDA BETTY (Tel. 0777526469)',  (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('JJA'), 'NAMUKASA JULIET', '0753244088', 'JJA', 'Jinja City', 'Jinja South Division', 'Mpumudde Ward', 'Mpumudde',  'Female', 300000, '2026-01-20', 'Active', 'Guarantor: NAISANGA HELLEN (Tel. 0786459352)', (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('JJA'), 'NAKIRYA SARAH',   '0780233468', 'JJA', 'Jinja City', 'Jinja South Division', 'Kimaka Ward',   'Kimaka',    'Female', 300000, '2026-01-20', 'Active', 'Guarantor: WAISWA ROBERT (Tel. 0700256624)',  (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('JJA'), 'YOYETA JOYCE',    '0772409585', 'JJA', 'Jinja City', 'Jinja South Division', 'Nalufenya Ward','Nalufenya', 'Female', 300000, '2026-01-20', 'Active', 'Guarantor: ZIKULABE MANUEL (Tel. 0761097463)',(SELECT id FROM users WHERE username='faruk' LIMIT 1)),

-- ── IGANGA (IGA) ───────────────────────────────────────────────────
(next_member_id('IGA'), 'NAMBI HADIJA',    '0775271728', 'IGA', 'Iganga', 'Nabitende', 'Nabitende', 'Nabitende', 'Female', 500000, '2026-01-27', 'Active', 'Guarantor: MUKWAYA ROBERT (Tel. 0787525891)', (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('IGA'), 'MAWOGOLE MONIC',  '0787475151', 'IGA', 'Iganga', 'Nambale',   'Nambale',   'Nambale',   'Female', 200000, '2026-01-27', 'Active', 'Guarantor: SIMIYU ROSE (Tel. 0777984946)',    (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('IGA'), 'NANGOBI NASABU',  '0787064288', 'IGA', 'Iganga', 'Bulamagi',  'Bulamagi',  'Bulamagi',  'Female', 400000, '2026-01-27', 'Active', 'Guarantor: BIDI NASSER (Tel. 0774113409)',    (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('IGA'), 'NAMUGAYA JOY',    NULL,         'IGA', 'Iganga', 'Nakalama',  'Nakalama',  'Nakalama',  'Female', 200000, '2026-01-27', 'Active', 'Guarantor: BUWEMBA PETER (Tel. 0751745798)',  (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('IGA'), 'BIRIBAWA KEVIN',  '0750879400', 'IGA', 'Iganga', 'Nabitende', 'Bugono',    'Bugono',    NULL,     500000, '2026-01-27', 'Active', 'Guarantor: GENDA GEORGE (Tel. 0776477876)',   (SELECT id FROM users WHERE username='faruk' LIMIT 1)),

-- ── JINJA DISTRICT (JJD) ───────────────────────────────────────────
(next_member_id('JJD'), 'BAKAKI DANIEL',   '0786682970', 'JJD', 'Jinja District', 'Busedde',             'Kisasi',      'Busedde',  'Male',   400000, '2026-02-03', 'Active', 'Guarantor: ISABIRYE IBRAHIM (Tel. 0783612083)', (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('JJD'), 'MUKEBA YUNUSU',   '0752105559', 'JJD', 'Jinja District', 'Kakira Town Council', 'Kakira Ward', 'Kakira',   'Male',   500000, '2026-02-03', 'Active', 'Guarantor: NAKAYIMA JANET (Tel. 0780498739)',   (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('JJD'), 'MBATYA DAN',      NULL,         'JJD', 'Jinja District', 'Butagaya',            'Budima',      'Butagaya', 'Male',   500000, '2026-02-03', 'Active', 'Guarantor: BAMU PETER (Tel. 0773819332)',       (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('JJD'), 'NANDEGO MALIZA',  '0780714053', 'JJD', 'Jinja District', 'Buwenge',             'Kagoma',      'Buwenge',  'Female', 400000, '2026-02-03', 'Active', 'Guarantor: ITAKA YOKANA (Tel. 0785866581)',     (SELECT id FROM users WHERE username='faruk' LIMIT 1)),

-- ── KAMULI (KML) ───────────────────────────────────────────────────
(next_member_id('KML'), 'BAMU PETER',      '0773819332', 'KML', 'Kamuli', 'Balawoli',  'Namaira',   'Balawoli',  'Male',   500000, '2026-02-10', 'Active', 'Guarantor: NAIRUBA ANNET (Tel. 0784509698)',    (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('KML'), 'NABIRYE MELIDA',  '0788287891', 'KML', 'Kamuli', 'Nabwigulu', 'Nabwigulu', 'Nabwigulu', 'Female', 500000, '2026-02-10', 'Active', 'Guarantor: WAMBI SIRAGI (Tel. 0782982976)',     (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('KML'), 'NAIGAGA SYLIVIA', '0750543249', 'KML', 'Kamuli', 'Butansi',   'Butansi',   'Butansi',   'Female', 400000, '2026-02-10', 'Active', 'Guarantor: MAGANDA ABDALLAH (Tel. 0787358330)', (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('KML'), 'NAKAIMA JANET',   '0780498739', 'KML', 'Kamuli', 'Namwendwa', 'Bulange',   'Namwendwa', 'Female', 300000, '2026-02-10', 'Active', 'Guarantor: WAISWA MOOYA (Tel. 0789937592)',     (SELECT id FROM users WHERE username='faruk' LIMIT 1)),

-- ── KALIRO (KLR) ───────────────────────────────────────────────────
(next_member_id('KLR'), 'NAIGAGA JOAN',    '0701428225', 'KLR', 'Kaliro', 'Bumanya',  'Bumanya',  'Bumanya',  'Female', 400000, '2026-02-17', 'Active', 'Guarantor: ALUBAMU ISABIRYE (Tel. 0779348085)', (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('KLR'), 'MULINDA JOY',     '0776006159', 'KLR', 'Kaliro', 'Gadumire', 'Gadumire', 'Gadumire', 'Female', 400000, '2026-02-17', 'Active', 'Guarantor: NAMULINDA JOY (Tel. 0776006159)',    (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('KLR'), 'NAMUSOSA RESTY',  '0774597150', 'KLR', 'Kaliro', 'Namwiwa',  'Saaka',    'Namwiwa',  'Female', 500000, '2026-02-17', 'Active', 'Guarantor: MPANGO (Tel. 0786770177)',           (SELECT id FROM users WHERE username='faruk' LIMIT 1)),

-- ── LUUKA (LUK) ────────────────────────────────────────────────────
(next_member_id('LUK'), 'GONZA JENIFER',   '0756226903', 'LUK', 'Luuka', 'Bukooma', 'Bukooma', 'Bukooma', 'Female', 400000, '2026-02-24', 'Active', 'Guarantor: KALUYA DAVID (Tel. 0740435151)',    (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('LUK'), 'ANNET NKONO',     '0785869917', 'LUK', 'Luuka', 'Ikumbya', 'Ikumbya', 'Ikumbya', 'Female', 300000, '2026-02-24', 'Active', 'Guarantor: WAMUKULA JAMES (Tel. 0781564722)',  (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('LUK'), 'KAWUDHA SHADIA',  '0705546595', 'LUK', 'Luuka', 'Irongo',  'Irongo',  'Irongo',  'Female', 300000, '2026-02-24', 'Active', 'Guarantor: KIIRA ALAMANZAN (Tel. 0741524462)', (SELECT id FROM users WHERE username='faruk' LIMIT 1)),

-- ── MAYUGE (MYG) ───────────────────────────────────────────────────
(next_member_id('MYG'), 'NAMAGANDA LYDIA',   '0788199850', 'MYG', 'Mayuge', 'Kigandalo', 'Kigandalo', 'Kigandalo', 'Female', 400000, '2026-03-03', 'Active', 'Guarantor: NGOBI FRANCO (Tel. 0765728309)',     (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('MYG'), 'NAMUKOSE MARIAM',   '0751391823', 'MYG', 'Mayuge', 'Kityerera', 'Kitovu',    'Kityerera', 'Female', 500000, '2026-03-03', 'Active', 'Guarantor: NAMUKOSE MARIAM (Tel. 0751391823)',  (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('MYG'), 'BATEGANYA FALUKU',  '0771647653', 'MYG', 'Mayuge', 'Imanyiro',  'Mbaale',    'Imanyiro',  'Male',   500000, '2026-03-03', 'Active', 'Guarantor: BATEGENYA FALUKU (Tel. 0771647653)', (SELECT id FROM users WHERE username='faruk' LIMIT 1)),

-- ── NAMAYINGO (NMY) ────────────────────────────────────────────────
(next_member_id('NMY'), 'NANGOBI SYLIVIA', '0707895247', 'NMY', 'Namayingo', 'Buswale', 'Buswale', 'Buswale', 'Female', 400000, '2026-03-10', 'Active', 'Guarantor: NANGOBI SYLVIA (Tel. 0752004013)',  (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('NMY'), 'NAMUKOSE ZAKIA',  '0779309576', 'NMY', 'Namayingo', 'Buyinja', 'Nsono',   'Buyinja', 'Female', 500000, '2026-03-10', 'Active', 'Guarantor: MUDDE DAN (Tel. 0703079301)',       (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('NMY'), 'MUKYEYAYA HAWA',  '0701191062', 'NMY', 'Namayingo', 'Banda',   'Lugala',  'Banda',   'Female', 400000, '2026-03-10', 'Active', 'Guarantor: NAMULONDO EDISA (Tel. 0701191062)', (SELECT id FROM users WHERE username='faruk' LIMIT 1)),

-- ── BUGIRI (BGR) ───────────────────────────────────────────────────
(next_member_id('BGR'), 'NAMBWEIRA ROSE',    '0759557568', 'BGR', 'Bugiri', 'Bulesa',  'Iggwe',   'Bulesa',  'Female', 500000, '2026-03-17', 'Active', 'Guarantor: NAMULONDO MARIAM (Tel. 0758199790)', (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('BGR'), 'NAMULONDO MARIAM',  '0758199790', 'BGR', 'Bugiri', 'Buwunga', 'Buwunga', 'Buwunga', 'Female', 500000, '2026-03-17', 'Active', 'Guarantor: NAMBWOIRA ROSE (Tel. 0759557568)',   (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('BGR'), 'MUSOBYA GRACE',     '07431338959','BGR', 'Bugiri', 'Nankoma', 'Isegero', 'Nankoma', 'Female', 400000, '2026-03-17', 'Active', 'Guarantor: MUTESI EDISA (Tel. 0783801541)',     (SELECT id FROM users WHERE username='faruk' LIMIT 1)),

-- ── BUGWERI (BGW) ──────────────────────────────────────────────────
(next_member_id('BGW'), 'NAMULONDO EDISA', '0701191062',  'BGW', 'Bugweri', 'Buyanga',   'Lubira',    'Buyanga',   'Female', 300000, '2026-03-24', 'Active', 'Guarantor: NANGOBI SARAH (Tel. 0701189378)',   (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('BGW'), 'BUDDE DAN',       '07030793301', 'BGW', 'Bugweri', 'Makuutu',   'Makuutu',   'Makuutu',   'Male',   500000, '2026-03-24', 'Active', 'Guarantor: NAMUKOSE ZAKIA (Tel. 0779309576)',  (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('BGW'), 'ALIYINZA LYDIA',  '0756226903',  'BGW', 'Bugweri', 'Namalemba', 'Namalemba', 'Namalemba', 'Female', 500000, '2026-03-24', 'Active', 'Guarantor: ALIYINZA LYDIA (Tel. 0787645486)',  (SELECT id FROM users WHERE username='faruk' LIMIT 1)),

-- ── NAMUTUMBA (NMT) ────────────────────────────────────────────────
(next_member_id('NMT'), 'MUTESI EDISA',  '0758897090', 'NMT', 'Namutumba', 'Bulange', 'Bulange', 'Bulange', 'Female', 500000, '2026-03-31', 'Active', 'Guarantor: MUKISA RICHARD (Tel. 0757017153)',  (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('NMT'), 'NKAYE ALI',     '0754607090', 'NMT', 'Namutumba', 'Ivukula', 'Ivukula', 'Ivukula', 'Male',   500000, '2026-03-31', 'Active', 'Guarantor: BASOGA STEVEN (Tel. 0775867050)',   (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('NMT'), 'MAGANDA PETER', '0753504559', 'NMT', 'Namutumba', 'Kibaale', 'Kibaale', 'Kibaale', 'Male',   400000, '2026-03-31', 'Active', 'Guarantor: NAMUTIBYA LYDIA (Tel. 0773835112)', (SELECT id FROM users WHERE username='faruk' LIMIT 1)),

-- ── BUYENDE (BYD) ──────────────────────────────────────────────────
(next_member_id('BYD'), 'MWEBAZA ROSE',     '0781426230', 'BYD', 'Buyende', 'Bugaya', 'Bugaya',  'Bugaya', 'Female', 500000, '2026-04-07', 'Active', 'Guarantor: TUMBYA HENRY (Tel. 0786727951)',     (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('BYD'), 'MUKABIRE DEBORAH', '0704046719', 'BYD', 'Buyende', 'Kidera', 'Kasiira', 'Kidera', 'Female', 400000, '2026-04-07', 'Active', 'Guarantor: NAMUSUSWA PROSSY (Tel. 0773327915)', (SELECT id FROM users WHERE username='faruk' LIMIT 1)),
(next_member_id('BYD'), 'NAMUSOBYA BETTY',  '078758185',  'BYD', 'Buyende', 'Nkondo', 'Kigingi', 'Nkondo', 'Female', 400000, '2026-04-07', 'Active', 'Guarantor: WABUBI HENRY (Tel. 0782235519)',     (SELECT id FROM users WHERE username='faruk' LIMIT 1));

COMMIT;

-- Quick check after running:
--   SELECT district_name, COUNT(*), SUM(amount) FROM members GROUP BY district_name ORDER BY district_name;
