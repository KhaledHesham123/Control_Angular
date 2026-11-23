import { daysBetween, today } from './ship-calc';
import { CertSection, Certificate } from './ship.types';

/**
 * سجل الشهادات القياسي لكل سفينة — مأخوذ من نموذج "Vessel's Certificate Status" (DE-01).
 * كل سفينة بتبدأ بنفس القائمة (فاضية)، والداتا بتتكتب باليد، والملف بيترفع على كل سطر.
 */

type Row = [no: string, title: string];

const CERT_ROWS: Row[] = [
  ['1', 'Registry'],
  ['2', 'Safe Manning'],
  ['3', 'Radio License'],
  ['4', 'Class H&M'],
  ['5', 'Safety Construction'],
  ['6', 'Load Line'],
  ['7', 'Tonnage'],
  ['8', 'Safety Equipment + Form E'],
  ['9', 'Safety Radio + Form R'],
  ['10', 'IOPP + Form A'],
  ['11', 'Air Pollution + Supplement'],
  ['12', 'Garbage'],
  ['13', 'Sewage + Discharge Rate'],
  ['14', 'IEEC'],
  ['15', 'AFS + Record'],
  ['16', 'DOC'],
  ['17', 'SMC'],
  ['18', 'ISSC'],
  ['19', 'MLC + DMLC part 1+2'],
  ['20', 'BWMC Exemption'],
  ['21', 'IMSBC'],
  ['22', 'Dangerous Goods'],
  ['23', 'Grain In Bulk'],
  ['24', 'IHM'],
  ['25', 'P&I + H&M'],
  ['26', 'Bunker CC'],
  ['27', 'WRK. Removal'],
  ['28', 'Oily Water Sep. Exemption'],
  ['29', 'EIAPP'],
  ['30', 'IMO DCS (Over 5000 GRT)'],
  ['31', 'MRV'],
  ['31-A', 'FUEL-EU (Over 5000 GRT)'],
  ['32', 'Medical Certificate'],
  ['33', 'Deratting'],
  ['34', 'EU Sanitary Vet. (For livestock)'],
  ['35', 'Paris MOU'],
  ['36', 'Medt. MOU'],
  ['37', 'Black Sea MOU'],
  ['38', 'Other MOU'],
  ['39', 'Ship Survey Status'],
  ['40', 'Last CSR'],
  ['41', 'Cargo Gear Annual'],
  ['42', 'Cargo Gear Annual (2)'],
  ['43', 'Suez Canal Tonnage Cert.'],
  ['44', 'Panama Canal Tonnage Cert.'],
  ['45', 'Solina Canal Tonnage Cert.'],
  ['46', 'Crew Accommodation'],
  ['47', 'Last And Next Drydock'],
];

const LSA_ROWS: Row[] = [
  ['51', 'LifeRafts 1, 2'],
  ['52', 'Life Boats Annual'],
  ['53', 'Life Boats Load Test'],
  ['54', 'Rescue Boat Annual'],
  ['55', 'Rescue Boat Load Test'],
  ['56', 'CO2 System'],
  ['57', 'CO2 System Last pressure Test'],
  ['58', 'Fire Extinguishers'],
  ['59', 'Fire Extinguishers Last Pressure Test'],
  ['60', 'Breathing Apparatus'],
  ['61', 'Oxygen Apparatus'],
  ['62', 'E.E.B.D Certificate'],
  ['63', 'Life Jacket'],
  ['64', 'Life Buoy'],
  ['65', 'Immersion Suit'],
  ['66', "Fireman's Outfit"],
  ['67', 'Pilot Ladder'],
  ['68', 'Embarkation Ladders'],
  ['69', 'Gangway Annual'],
  ['70', 'Gangway Load Test'],
  ['71', 'Fire Hoses'],
  ['72', 'Gas Detector Calibration'],
  ['73', 'Chemical Suit'],
  ['74', 'Oily Water separator Calibration'],
  ['75', 'Oily Water separator Annual'],
  ['76', 'Shore Based maintenance (GMDSS)'],
  ['77', 'SART'],
  ['78', 'EPIRB annual'],
  ['79', 'EPIRB shore based'],
  ['80', 'AIS'],
  ['81', 'SSAS'],
  ['82', 'LRIT'],
  ['83', 'BNWAS'],
  ['84', 'SVDR (over 3000 GRT)'],
  ['85', 'GMDSS Batteries'],
  ['86', 'TWO Way Portable VHF'],
  ['87', 'Fire Fighter VHF'],
  ['88', 'Battery Calculation'],
  ['89', 'Gyro Compass Last Annual'],
  ['90', 'Last Radio Survey Report'],
  ['91', 'Compass Card (Standard) cert'],
  ['92', 'Compass Card (Spare) cert'],
  ['93', 'Compass Div Card'],
  ['94', 'Smoke Detection System'],
  ['95', 'Fire Blanket Inspection'],
  ['96', 'Alcohol Tester'],
  ['97', 'Sprinkler system'],
  ['98', 'Fire Alarm'],
  ['99', 'Fire Nozzle'],
  ['100', 'Foam cert.'],
];

const DATED_ROWS: Row[] = [
  ['1', 'Parachutes / Bridge'],
  ['2', 'Parachutes / Life boat / 1'],
  ['3', 'Parachutes / Life boat 2'],
  ['4', 'Hand Flare / Life boat / 1'],
  ['5', 'Hand Flare / Life boat 2'],
  ['6', 'Smoke Signal / Life boat / 1'],
  ['7', 'Smoke Signal / Life boat / 2'],
  ['8', 'Man Over Board / Bridge wing P / 1'],
  ['9', 'Man Over Board / Bridge wing SB / 2'],
  ['10', 'Speed Line / Bridge'],
  ['11', 'EPIRB Batteries'],
  ['12', 'EPIRB Hydros'],
  ['13', 'SART Batteries / Bridge P / 1'],
  ['14', 'SART Batteries / Bridge SB / 2'],
  ['15', '2 Way VHF Emrg. Batt. / Bridge / 1'],
  ['16', '2 Way VHF Emrg. Batt. / Bridge / 2'],
  ['17', '2 Way VHF Emrg. Batt. / Bridge / 3'],
  ['18', 'LifeRaft Hydros. / Boat Deck P / 1'],
  ['19', 'LifeRaft Hydros. / Boat Deck P / 2'],
  ['20', 'Life Jackets Lights'],
  ['21', 'Immersion Suit lights'],
  ['22', 'Food Ration / Life Boat P / 1'],
  ['23', 'Food Ration / Life Boat SB / 2'],
  ['24', 'Water / Life Boat P / 1'],
  ['25', 'Water / Life Boat SB / 2'],
  ['26', 'First Aid kits / Life Boat P / 1'],
  ['27', 'First Aid kits / Life Boat SB / 2'],
  ['28', 'First Aid (Eng. Room)'],
  ['29', 'SVDR Battery'],
  ['30', 'SVDR Hydros'],
];

/** قيم جاهزة لسفينة بعينها: المفتاح "c:رقم" أو "l:رقم" أو "d:رقم". */
export type CertSeedValues = Record<string, Partial<Pick<Certificate, 'issuer' | 'issueDate' | 'lastInsp' | 'dueDate' | 'expiryDate' | 'qty' | 'type' | 'mfgDate' | 'notes'>>>;

function blank(id: string, section: CertSection, no: string, title: string): Certificate {
  return {
    id,
    section,
    no,
    title,
    issuer: '',
    docNo: '',
    issueDate: '',
    lastInsp: '',
    dueDate: '',
    expiryDate: '',
    qty: '',
    type: '',
    mfgDate: '',
    notes: '',
    file: null,
  };
}

/** يبني سجل الشهادات الكامل لسفينة (كل أنواع الشهادات الموجودة في النموذج). */
export function buildCertRegister(prefix: string, values: CertSeedValues = {}): Certificate[] {
  const out: Certificate[] = [];
  const add = (rows: Row[], section: CertSection, key: string) => {
    for (const [no, title] of rows) {
      out.push({ ...blank(`${prefix}-${key}${no}`, section, no, title), ...(values[`${key}:${no}`] ?? {}) });
    }
  };
  add(CERT_ROWS, 'cert', 'c');
  add(LSA_ROWS, 'lsa', 'l');
  add(DATED_ROWS, 'dated', 'd');
  return out;
}

export function newCertificate(section: CertSection, existing: Certificate[]): Certificate {
  const inSection = existing.filter((c) => c.section === section);
  const nums = inSection.map((c) => parseInt(c.no, 10)).filter((n) => !Number.isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : section === 'lsa' ? 101 : 1;
  return blank(`cert-${Math.random().toString(36).slice(2, 10)}`, section, String(next), '');
}

/** تحويل تاريخ مكتوب (يوم/شهر/سنة أو شهر/يوم/سنة لو اليوم أكبر من 12) إلى ISO. */
export function dmy(text: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return '';
  let day = Number(m[1]);
  let month = Number(m[2]);
  if (month > 12 && day <= 12) [day, month] = [month, day];
  return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/* ───────────── الحالة ───────────── */

export type CertKey = 'ok' | 'soon' | 'expired' | 'nodate' | 'empty' | 'na';

export interface CertStatus {
  key: CertKey;
  tone: 'ok' | 'warn' | 'bad' | 'muted';
  label: string;
  /** المتبقي بالأيام (سالب = متأخر) أو null. */
  days: number | null;
  /** التاريخ اللي بنبني عليه الحالة. */
  ref: string;
}

export function hasData(c: Certificate): boolean {
  return Boolean(c.issuer || c.docNo || c.issueDate || c.lastInsp || c.dueDate || c.expiryDate || c.qty || c.mfgDate || c.file);
}

/** نفس منطق النموذج: الحالة على أقرب تاريخ (الاستحقاق أو الانتهاء)، وتحذير قبل 3 شهور. */
export function certDocStatus(c: Certificate): CertStatus {
  if (c.qty.trim().toUpperCase() === 'N/A') {
    return { key: 'na', tone: 'muted', label: 'لا ينطبق', days: null, ref: '' };
  }
  if (!hasData(c)) {
    return { key: 'empty', tone: 'muted', label: 'لم تُسجَّل', days: null, ref: '' };
  }
  const dates = [c.dueDate, c.expiryDate].filter(Boolean).sort();
  const ref = dates[0];
  if (!ref) {
    return { key: 'nodate', tone: 'muted', label: 'بدون تاريخ انتهاء', days: null, ref: '' };
  }
  const left = daysBetween(today(), ref);
  if (left < 0) return { key: 'expired', tone: 'bad', label: `منتهية منذ ${-left} يوم`, days: left, ref };
  if (left <= 90) return { key: 'soon', tone: 'warn', label: `تنتهي خلال ${left} يوم`, days: left, ref };
  return { key: 'ok', tone: 'ok', label: 'سارية', days: left, ref };
}

export interface CertSummary {
  total: number;
  ok: number;
  soon: number;
  expired: number;
  empty: number;
  noFile: number;
}

export function certSummary(list: Certificate[]): CertSummary {
  const s: CertSummary = { total: 0, ok: 0, soon: 0, expired: 0, empty: 0, noFile: 0 };
  for (const c of list) {
    const st = certDocStatus(c);
    if (st.key === 'na') continue;
    s.total++;
    if (st.key === 'ok') s.ok++;
    else if (st.key === 'soon') s.soon++;
    else if (st.key === 'expired') s.expired++;
    if (st.key === 'empty') s.empty++;
    else if (!c.file) s.noFile++;
  }
  return s;
}
