import { addDays, rootOf, suggestVoyageConsumption, today, uid } from './ship-calc';
import { buildCertRegister } from './ship-certs';
import { AMANY_CERT_VALUES } from './ship-certs-seed';
import {
  BunkerRecord,
  CargoClient,
  Category,
  CrewCert,
  CrewDept,
  CrewEvent,
  CrewMember,
  CrewStatus,
  DailyLog,
  Movement,
  Offer,
  Port,
  PortStop,
  Product,
  ReqLine,
  ReqStatus,
  Requisition,
  Shipment,
  ShipConfig,
  ShipState,
  ShipUser,
  Supplier,
  Tank,
  Hold,
  VesselData,
  VesselProfile,
  Voyage,
  VoyageStatus,
} from './ship.types';

export const STATE_VERSION = 5;

/* ───────────── الأقسام ───────────── */

const CATEGORIES: Category[] = [
  { id: 'c-kitchen', name: 'المطبخ والإعاشة', parentId: null, icon: 'utensils' },
  { id: 'c-meat', name: 'لحوم ودواجن وأسماك', parentId: 'c-kitchen', icon: 'tag' },
  { id: 'c-veg', name: 'خضروات وفاكهة', parentId: 'c-kitchen', icon: 'tag' },
  { id: 'c-dry', name: 'بقالة ومواد جافة', parentId: 'c-kitchen', icon: 'tag' },
  { id: 'c-dairy', name: 'ألبان ومشروبات', parentId: 'c-kitchen', icon: 'tag' },
  { id: 'c-clean', name: 'نظافة وغسيل', parentId: 'c-kitchen', icon: 'tag' },
  { id: 'c-galley', name: 'أدوات المطبخ والسفرة', parentId: 'c-kitchen', icon: 'tag' },

  { id: 'c-bridge', name: 'الكوبري (الملاحة)', parentId: null, icon: 'compass' },
  { id: 'c-nav', name: 'أجهزة ملاحة', parentId: 'c-bridge', icon: 'tag' },
  { id: 'c-comm', name: 'اتصالات', parentId: 'c-bridge', icon: 'tag' },
  { id: 'c-charts', name: 'خرائط ومطبوعات', parentId: 'c-bridge', icon: 'tag' },
  { id: 'c-personal', name: 'مستلزمات شخصية وملابس عمل', parentId: 'c-bridge', icon: 'tag' },

  { id: 'c-deck', name: 'السطح', parentId: null, icon: 'anchor' },
  { id: 'c-paint', name: 'دهانات', parentId: 'c-deck', icon: 'tag' },
  { id: 'c-rope', name: 'حبال وأسلاك رباط', parentId: 'c-deck', icon: 'tag' },
  { id: 'c-decktools', name: 'عدد ومعدات سطح', parentId: 'c-deck', icon: 'tag' },

  { id: 'c-safety', name: 'السلامة', parentId: null, icon: 'shield' },
  { id: 'c-fire', name: 'مكافحة الحريق', parentId: 'c-safety', icon: 'tag' },
  { id: 'c-life', name: 'وسائل النجاة', parentId: 'c-safety', icon: 'tag' },
  { id: 'c-ppe', name: 'ملابس ومعدات وقاية', parentId: 'c-safety', icon: 'tag' },
  { id: 'c-med', name: 'أدوية وإسعافات', parentId: 'c-safety', icon: 'tag' },

  { id: 'c-spares', name: 'قطع الغيار', parentId: null, icon: 'wrench' },
  { id: 'c-engine', name: 'غرفة المحركات', parentId: 'c-spares', icon: 'tag' },
  { id: 'c-crane', name: 'الأوناش والهيدروليك', parentId: 'c-spares', icon: 'tag' },
  { id: 'c-elec', name: 'الكهرباء والمولدات', parentId: 'c-spares', icon: 'tag' },
  { id: 'c-pumps', name: 'مضخات وصمامات', parentId: 'c-spares', icon: 'tag' },

  { id: 'c-oils', name: 'الزيوت والشحوم', parentId: null, icon: 'fuel' },
  { id: 'c-lube', name: 'زيوت تشحيم المحرك', parentId: 'c-oils', icon: 'tag' },
  { id: 'c-hyd', name: 'زيوت هيدروليك وتروس', parentId: 'c-oils', icon: 'tag' },
  { id: 'c-grease', name: 'شحوم', parentId: 'c-oils', icon: 'tag' },
];

/* [id, القسم, الاسم, الكود, الوحدة, الحد الأدنى, رصيد سفينة 11] */
type ProdRow = [string, string, string, string, string, number, number];

const PRODUCT_ROWS: ProdRow[] = [
  ['p-chicken', 'c-meat', 'فراخ مجمدة', 'KIT-001', 'كجم', 80, 140],
  ['p-beef', 'c-meat', 'لحم بقري مجمد', 'KIT-002', 'كجم', 60, 95],
  ['p-fish', 'c-meat', 'سمك مجمد', 'KIT-003', 'كجم', 40, 55],
  ['p-veg', 'c-veg', 'خضروات طازجة مشكلة', 'KIT-010', 'كجم', 100, 120],
  ['p-fruit', 'c-veg', 'فاكهة طازجة', 'KIT-011', 'كجم', 60, 38],
  ['p-rice', 'c-dry', 'أرز', 'KIT-020', 'كجم', 150, 420],
  ['p-pasta', 'c-dry', 'مكرونة', 'KIT-021', 'كجم', 80, 260],
  ['p-flour', 'c-dry', 'دقيق', 'KIT-022', 'كجم', 100, 180],
  ['p-oil', 'c-dry', 'زيت طعام', 'KIT-023', 'لتر', 40, 85],
  ['p-sugar', 'c-dry', 'سكر', 'KIT-024', 'كجم', 60, 110],
  ['p-beans', 'c-dry', 'فول وعدس', 'KIT-025', 'كجم', 70, 90],
  ['p-milk', 'c-dairy', 'لبن UHT', 'KIT-030', 'لتر', 80, 120],
  ['p-cheese', 'c-dairy', 'جبن', 'KIT-031', 'كجم', 20, 30],
  ['p-bottled', 'c-dairy', 'مياه معبأة (كرتونة)', 'KIT-032', 'علبة', 40, 60],
  ['p-detergent', 'c-clean', 'مسحوق غسيل', 'CLN-001', 'كجم', 40, 70],
  ['p-bleach', 'c-clean', 'كلور مطهر', 'CLN-002', 'لتر', 30, 18],
  ['p-pots', 'c-galley', 'طقم حلل ستانلس', 'GAL-001', 'طقم', 3, 6],
  ['p-plates', 'c-galley', 'أطباق وأكواب', 'GAL-002', 'دستة', 8, 18],

  ['p-binoc', 'c-nav', 'منظار بحري', 'BRG-001', 'قطعة', 2, 3],
  ['p-vhf', 'c-comm', 'جهاز VHF محمول', 'BRG-010', 'قطعة', 2, 3],
  ['p-charts', 'c-charts', 'خرائط ملاحية ورقية', 'BRG-020', 'طقم', 2, 4],
  ['p-uniform', 'c-personal', 'بدلة عمل (أفرول)', 'BRG-030', 'قطعة', 20, 34],

  ['p-paint-epoxy', 'c-paint', 'دهان إيبوكسي بحري 20 لتر', 'DCK-001', 'جالون', 12, 28],
  ['p-paint-af', 'c-paint', 'دهان مانع للحشف 20 لتر', 'DCK-002', 'جالون', 10, 18],
  ['p-thinner', 'c-paint', 'ثنر ومذيب 20 لتر', 'DCK-003', 'جالون', 8, 14],
  ['p-brush', 'c-paint', 'رولات وفرش دهان', 'DCK-004', 'قطعة', 30, 95],
  ['p-rope', 'c-rope', 'حبل رباط 56 مم', 'DCK-010', 'قطعة', 4, 6],
  ['p-wire', 'c-rope', 'سلك صلب مجلفن', 'DCK-011', 'متر', 200, 450],
  ['p-shackle', 'c-decktools', 'قفل بحري 25 طن', 'DCK-020', 'قطعة', 10, 24],
  ['p-chipping', 'c-decktools', 'مطرقة تقشير صدأ', 'DCK-021', 'قطعة', 6, 9],

  ['p-extinguisher', 'c-fire', 'طفاية CO2', 'SAF-001', 'قطعة', 4, 9],
  ['p-firehose', 'c-fire', 'خرطوم إطفاء', 'SAF-002', 'قطعة', 3, 5],
  ['p-lifejacket', 'c-life', 'سترة نجاة', 'SAF-010', 'قطعة', 24, 36],
  ['p-flare', 'c-life', 'صواريخ استغاثة', 'SAF-011', 'علبة', 2, 4],
  ['p-helmet', 'c-ppe', 'خوذة سلامة', 'SAF-020', 'قطعة', 20, 30],
  ['p-boots', 'c-ppe', 'حذاء سيفتي', 'SAF-021', 'قطعة', 20, 16],
  ['p-gloves', 'c-ppe', 'قفازات عمل', 'SAF-022', 'دستة', 10, 16],
  ['p-firstaid', 'c-med', 'صندوق إسعافات أولية', 'SAF-030', 'علبة', 3, 5],
  ['p-medicine', 'c-med', 'أدوية أساسية', 'SAF-031', 'طقم', 2, 3],

  ['p-bearing', 'c-engine', 'رولمان بلي SKF 6208', 'ENG-001', 'قطعة', 8, 18],
  ['p-filter-fuel', 'c-engine', 'فلتر وقود المحرك الرئيسي', 'ENG-002', 'قطعة', 6, 4],
  ['p-filter-lube', 'c-engine', 'فلتر زيت', 'ENG-003', 'قطعة', 6, 10],
  ['p-gasket', 'c-engine', 'جوان رأس سلندر', 'ENG-004', 'طقم', 2, 3],
  ['p-injector', 'c-engine', 'بخاخ وقود (Injector)', 'ENG-005', 'قطعة', 4, 6],
  ['p-pistonring', 'c-engine', 'شنابر بستم', 'ENG-006', 'طقم', 2, 2],
  ['p-hyd-hose', 'c-crane', 'خرطوم هيدروليك', 'CRN-001', 'قطعة', 4, 7],
  ['p-crane-wire', 'c-crane', 'سلك ونش 22 مم', 'CRN-002', 'متر', 100, 220],
  ['p-avr', 'c-elec', 'منظم جهد مولد (AVR)', 'ELC-001', 'قطعة', 1, 2],
  ['p-cable', 'c-elec', 'كابل كهرباء بحري', 'ELC-002', 'متر', 100, 300],
  ['p-lamp', 'c-elec', 'لمبات وإنارة', 'ELC-003', 'قطعة', 40, 85],
  ['p-pumpseal', 'c-pumps', 'سيل ميكانيكال للطلمبة', 'PMP-001', 'قطعة', 6, 9],
  ['p-valve', 'c-pumps', 'صمام كروي 2 بوصة', 'PMP-002', 'قطعة', 3, 5],

  ['p-lube-cyl', 'c-lube', 'زيت سلندر SAE 50 (برميل 208 ل)', 'OIL-001', 'برميل', 6, 9],
  ['p-lube-sys', 'c-lube', 'زيت نظام SAE 30 (برميل 208 ل)', 'OIL-002', 'برميل', 4, 6],
  ['p-hyd', 'c-hyd', 'زيت هيدروليك ISO 46', 'OIL-010', 'برميل', 3, 5],
  ['p-grease', 'c-grease', 'شحم بحري متعدد الأغراض', 'OIL-020', 'كجم', 40, 60],
];

/* ───────────── الموانئ والموردون ───────────── */

type PortRow = [string, string, string, number, number, number, number, number, number, number, number];

const PORT_ROWS: PortRow[] = [
  /* id, name, country, lat, lng, hfo, mgo, berth/day, pilot, agency, canal */
  ['dam', 'دمياط', 'مصر', 31.47, 31.76, 540, 780, 2600, 3800, 4500, 0],
  ['alx', 'الإسكندرية', 'مصر', 31.19, 29.86, 548, 790, 3100, 2400, 1800, 0],
  ['psd', 'بورسعيد', 'مصر', 31.26, 32.31, 535, 775, 2400, 2600, 2200, 5500],
  ['suz', 'السويس', 'مصر', 29.95, 32.55, 540, 782, 2300, 2500, 2000, 6200],
  ['jed', 'جدة', 'السعودية', 21.48, 39.17, 560, 800, 3800, 3200, 2800, 0],
  ['pir', 'بيرايوس', 'اليونان', 37.94, 23.64, 520, 765, 4800, 3600, 2900, 0],
  ['gen', 'جنوة', 'إيطاليا', 44.4, 8.91, 585, 810, 5200, 4100, 3300, 0],
  ['gib', 'جبل طارق', 'جبل طارق', 36.14, -5.36, 495, 740, 1500, 1900, 1400, 0],
  ['rtm', 'روتردام', 'هولندا', 51.95, 4.14, 510, 755, 9500, 6800, 8200, 0],
  ['ham', 'هامبورج', 'ألمانيا', 53.54, 9.96, 530, 770, 8800, 6200, 7400, 0],
  ['fuj', 'الفجيرة', 'الإمارات', 25.18, 56.36, 500, 745, 3300, 2800, 2600, 0],
  ['sin', 'سنغافورة', 'سنغافورة', 1.26, 103.82, 505, 750, 6100, 4400, 4800, 0],
];

type SupRow = [string, string, string, string, string, string, string[], string[], number[], string];

const SUPPLIER_ROWS: SupRow[] = [
  ['s-misr', 'مصر للبترول للتموين البحري', 'م. حسام الدين', 'bunkers@misrmarine.example', '+20 3 480 1100', 'مصر', ['c-oils'], ['dam', 'alx', 'psd', 'suz'], [5, 4, 5], 'تموين وقود وزيوت، يعمل 24 ساعة'],
  ['s-minerva', 'Minerva Bunkering Med', 'Mr. Nikos P.', 'sales@minerva-bunkers.example', '+30 210 411 2200', 'اليونان', ['c-oils'], ['pir'], [4, 4], 'وقود VLSFO وMGO في شرق المتوسط'],
  ['s-vivo', 'Shell / Vivo Marine Bunkers', 'Ms. Anke V.', 'marine@vivo-bunkers.example', '+31 10 288 4400', 'هولندا', ['c-oils'], ['rtm', 'ham'], [5, 4], 'زيوت سلندر ونظام وفئات الوقود'],
  ['s-ahram', 'الأهرام لتموين السفن', 'أ. محمود فتحي', 'orders@ahram-chandlers.example', '+20 3 480 7788', 'مصر', ['c-kitchen', 'c-safety', 'c-deck', 'c-bridge'], ['dam', 'alx'], [4, 3, 4], 'تموين شامل: إعاشة وسطح وسلامة'],
  ['s-nile', 'Nile Marine Provisions', 'أ. سعيد رضوان', 'info@nileprovisions.example', '+20 2 2574 9000', 'مصر', ['c-kitchen'], ['alx', 'psd'], [3, 3, 4], 'مؤن طازجة ومجمدة'],
  ['s-hellenic', 'Hellenic Ship Stores', 'Mr. Dimitris K.', 'quotes@hellenic-stores.example', '+30 210 428 1900', 'اليونان', ['c-kitchen', 'c-deck', 'c-safety'], ['pir'], [4, 5], 'مؤن ومهمات سطح'],
  ['s-rotterdam', 'Rotterdam Marine Spares BV', 'Ms. Eva J.', 'spares@rms-bv.example', '+31 10 412 7000', 'هولندا', ['c-spares', 'c-bridge'], ['rtm', 'ham'], [5, 5, 4], 'قطع غيار أصلية للمحركات'],
  ['s-gulf', 'Gulf Engine Parts FZE', 'Mr. Rashid A.', 'sales@gulfengine.example', '+971 9 222 6600', 'الإمارات', ['c-spares'], ['fuj', 'suz', 'jed'], [3, 4], 'قطع غيار بديلة وسريعة'],
  ['s-paints', 'Marine Paints Egypt', 'م. عادل سمير', 'tenders@marinepaints.example', '+20 3 540 2210', 'مصر', ['c-deck', 'c-oils'], ['dam', 'alx'], [4, 4, 5], 'دهانات بحرية وشحوم'],
  ['s-safesea', 'SafeSea Equipment', 'Mr. Tom H.', 'orders@safesea.example', '+31 10 220 5500', 'هولندا', ['c-safety'], ['pir', 'rtm'], [4, 5], 'معدات إطفاء ونجاة معتمدة'],
  ['s-suezchand', 'Suez Canal Ship Chandlers', 'أ. مصطفى لبيب', 'desk@suezchand.example', '+20 62 333 4400', 'مصر', ['c-kitchen', 'c-deck'], ['suz', 'psd'], [3, 4], 'تموين سريع لسفن العبور'],
];

function buildPorts(): Port[] {
  return PORT_ROWS.map(([id, name, country, lat, lng, hfoPrice, mgoPrice, berthPerDay, pilotage, agency, canal]) => ({
    id,
    name,
    country,
    lat,
    lng,
    hfoPrice,
    mgoPrice,
    berthPerDay,
    pilotage,
    agency,
    canal,
    supplierIds: SUPPLIER_ROWS.filter((s) => s[7].includes(id)).map((s) => s[0]),
    notes: '',
  }));
}

function buildSuppliers(): Supplier[] {
  return SUPPLIER_ROWS.map(([id, company, contact, email, phone, country, categoryIds, portIds, stars, notes]) => ({
    id,
    company,
    contact,
    email,
    phone,
    country,
    categoryIds,
    portIds,
    notes,
    active: true,
    reviews: stars.map((s, i) => ({
      id: `${id}-r${i}`,
      date: addDays(today(), -30 - i * 20),
      stars: s,
      comment: s >= 5 ? 'التزام ممتاز بالمواعيد والجودة' : s >= 4 ? 'تعامل جيد' : 'تأخر بسيط في التوريد',
      by: 'إدارة الأسطول',
    })),
  }));
}

/* ───────────── السفن ───────────── */

function buildVessels(): VesselProfile[] {
  return [
    {
      id: '11',
      name: 'M/V AMANY QUEEN',
      imo: '8318128',
      callSign: 'D6A2010',
      flag: 'SIERRA LEONE',
      type: 'MPP / Conbulker',
      formerName: 'MERRY M',
      classSociety: 'CAPITAL REGISTER OF SHIPPING',
      buildYear: '1984 / 1985',
      owner: 'CEDAR MARINE SERVICES SAL',
      dwt: 10509.51,
      grt: 5451,
      nrt: 3178,
      loa: 115.2,
      beam: 18.6,
      draft: 8.55,
      grainCapacity: 10921.89,
      baleCapacity: 9554.1,
      mainEngine: 'HITACHI B&W 6L35MC (4068 PS / 200 RPM)',
      cranes: '4 Derricks × 10 MT SWL',
      speedKn: 12,
      availableForCharter: false,
      charterRate: 6200,
      location: 'البحر المتوسط — بين الإسكندرية وبيرايوس',
      lat: 34.2,
      lng: 27.1,
      notes: 'سفينة بضائع عامة وحاويات خفيفة.',
    },
    {
      id: '12',
      name: 'M/V NILE STAR',
      imo: '9021457',
      callSign: 'SUNS',
      flag: 'EGYPT',
      type: 'General Cargo',
      formerName: 'STAR OF DAMIETTA',
      classSociety: 'BUREAU VERITAS',
      buildYear: '1996',
      owner: 'NILE STAR SHIPPING CO.',
      dwt: 6820,
      grt: 4210,
      nrt: 2105,
      loa: 102.4,
      beam: 16.8,
      draft: 7.1,
      grainCapacity: 8400,
      baleCapacity: 7650,
      mainEngine: 'MAN B&W 6S35MC (4500 PS / 173 RPM)',
      cranes: '2 Cranes × 25 MT SWL',
      speedKn: 11,
      availableForCharter: true,
      charterRate: 4800,
      location: 'ميناء دمياط — متاحة للتأجير',
      lat: 31.47,
      lng: 31.76,
      notes: 'متاحة للتأجير بالرحلة أو بالمدة.',
    },
  ];
}

/* ───────────── مساعدات البذور ───────────── */

function defaultTanks(scale = 1): Tank[] {
  const t = (id: string, name: string, kind: Tank['kind'], current: number, max: number): Tank => ({
    id,
    name,
    kind,
    current: Math.round(current * scale * 10) / 10,
    max: Math.round(max * scale * 10) / 10,
  });
  return [
    t('hfo', 'خزان الوقود الثقيل', 'hfo', 990, 1150),
    t('mgo', 'خزان الديزل', 'mgo', 308, 360),
    t('lube', 'خزان الزيوت', 'lube', 76, 95),
    t('water', 'خزان المياه العذبة', 'water', 355, 420),
  ];
}

function withExpected(
  voyages: Array<Omit<Voyage, 'expectedHfo' | 'expectedMgo' | 'expectedLube' | 'status'> & { status: string }>,
  config: ShipConfig,
): Voyage[] {
  return voyages.map((voyage) => {
    const burn = suggestVoyageConsumption(voyage, config, 18);
    return {
      ...voyage,
      status: voyage.status as Voyage['status'],
      expectedHfo: burn.hfo,
      expectedMgo: burn.mgo,
      expectedLube: burn.lube,
    };
  });
}

function defaultConfig(): ShipConfig {
  return {
    mode: 'sea',
    power: 'aux_gen',
    hfoTonsPerDaySea: 24,
    mgoTonsPerDayPort: 0.5,
    boilerTonsPerHour: 0.08,
    lubeTonsPerHour: 0.01,
    foodKgPerPersonDay: 3.2,
    waterLitersPerPersonDay: 180,
    generators: [
      { id: 'g1', name: 'مولد مساعد 1 — KHD 257 kW', tonsPerHour: 0.11, defaultHours: 12 },
      { id: 'g2', name: 'مولد مساعد 2 — KHD 257 kW', tonsPerHour: 0.11, defaultHours: 12 },
      { id: 'g3', name: 'مولد العمود (Shaft)', tonsPerHour: 0, defaultHours: 0 },
    ],
  };
}

function stopOf(portId: string, eta: string, etd: string, activities: string[], agent: string, fda = 0): PortStop {
  const port = PORT_ROWS.find((p) => p[0] === portId);
  return {
    id: uid('stop'),
    portId,
    eta,
    etd,
    activities,
    berthFee: port ? port[7] * 1.5 : 0,
    pilotFee: port ? port[8] : 0,
    canalFee: port ? port[10] : 0,
    agencyFee: port ? port[9] : 0,
    actualFda: fda,
    agent,
    legNm: null,
    legFuelT: null,
  };
}

function productRow(id: string): ProdRow {
  const row = PRODUCT_ROWS.find((p) => p[0] === id);
  if (!row) {
    throw new Error(`seed product missing: ${id}`);
  }
  return row;
}

function mkLine(reqId: string, n: number, productId: string, qty: number, description = '', received: number | null = null): ReqLine {
  const row = productRow(productId);
  const root = rootOf(row[1], CATEGORIES);
  return {
    id: `${reqId}-L${n}`,
    productId,
    name: row[2],
    unit: row[4],
    categoryId: row[1],
    groupId: root?.id ?? row[1],
    qty,
    description,
    removed: false,
    received,
  };
}

function mkOffer(
  req: { id: string; lines: ReqLine[] },
  groupId: string,
  supplierId: string,
  supplierName: string,
  dayOffset: number,
  deliveryDays: number,
  payment: string,
  prices: (number | null)[],
): Offer {
  const lines = req.lines.filter((l) => l.groupId === groupId);
  return {
    id: `${req.id}-O-${supplierId}-${groupId}`,
    groupId,
    supplierId,
    supplierName,
    date: addDays(today(), dayOffset),
    deliveryDays,
    validityDays: 14,
    payment,
    lines: lines.map((l, i) => ({ lineId: l.id, unitPrice: prices[i] ?? null })),
    notes: '',
  };
}

function mkReq(
  n: number,
  voyageId: number,
  status: ReqStatus,
  createdOffset: number,
  by: string,
  notes: string,
  lines: ReqLine[],
  priority: 'normal' | 'urgent' = 'normal',
): Requisition {
  const id = `req-${n}`;
  return {
    id,
    no: `PR-2026-${String(n).padStart(3, '0')}`,
    vesselId: '11',
    voyageId,
    createdAt: addDays(today(), createdOffset),
    createdBy: by,
    status,
    priority,
    notes,
    lines,
    sends: [],
    offers: [],
    approvals: [],
    events: [{ at: addDays(today(), createdOffset), by, text: 'تم إنشاء الطلب' }],
  };
}

function crewMember(
  n: number,
  name: string,
  rank: string,
  dept: CrewDept,
  status: CrewStatus,
  salary: number,
  passport: string,
  phone: string,
  signOn: number,
  certs: [string, string, number][],
  extra: CrewEvent[] = [],
  notes = '',
): CrewMember {
  const events: CrewEvent[] = [{ id: `ev-${n}-0`, date: addDays(today(), signOn), type: 'sign-on', note: 'صعود على السفينة' }, ...extra];
  return {
    id: `crew-${n}`,
    name,
    rank,
    dept,
    nationality: 'مصري',
    passportNo: passport,
    seamanBookNo: `SB-${passport.slice(-5)}`,
    phone,
    salary,
    photo: null,
    status,
    certs: certs.map(([certName, number, exp], i): CrewCert => ({ id: `cc-${n}-${i}`, name: certName, number, expiry: addDays(today(), exp) })),
    events,
    notes,
  };
}

function finalizeMovements(movs: Movement[], stock: Record<string, number>, tanks: Tank[]): Movement[] {
  const sorted = [...movs].sort((a, b) => b.date.localeCompare(a.date));
  const balance: Record<string, number> = {};
  for (const m of sorted) {
    const key = `${m.source}:${m.refId}`;
    if (balance[key] === undefined) {
      balance[key] = m.source === 'item' ? (stock[m.refId] ?? 0) : (tanks.find((t) => t.id === m.refId)?.current ?? 0);
    }
    m.balanceAfter = Math.round(balance[key] * 100) / 100;
    if (m.kind === 'in' || m.kind === 'bunker') {
      balance[key] -= m.qty;
    } else if (m.kind === 'out' || m.kind === 'consume') {
      balance[key] += m.qty;
    }
  }
  return sorted;
}

/* ───────────── بيانات السفينة الرئيسية ───────────── */

function buildMainVessel(): VesselData {
  const now = today();
  const stock: Record<string, number> = {};
  PRODUCT_ROWS.forEach((r) => (stock[r[0]] = r[6]));
  const tanks = defaultTanks();
  const holds: Hold[] = [
    { id: 'hold1', name: 'عنبر 1', capacity: 5200, loaded: 2900 },
    { id: 'hold2', name: 'عنبر 2', capacity: 5300, loaded: 2900 },
  ];

  /* الرحلات */
  const v5Start = addDays(now, -150);
  const v6Start = addDays(now, -92);
  const v7Start = addDays(now, -13);
  const voyages = [
    {
      id: 5,
      number: 'VOY-2026-01',
      title: 'البحر الأحمر ⬅ الخليج (السويس – جدة – الفجيرة)',
      status: 'completed',
      startDate: v5Start,
      endDate: addDays(v5Start, 22),
      notes: 'شحنة صب ومعدات إلى الخليج',
      stops: [
        stopOf('suz', v5Start, addDays(v5Start, 2), ['تحميل', 'عبور قناة'], 'Suez Canal Agency', 15900),
        stopOf('jed', addDays(v5Start, 8), addDays(v5Start, 10), ['تموين', 'تزويد وقود'], 'Jeddah Marine Agency', 11800),
        stopOf('fuj', addDays(v5Start, 20), addDays(v5Start, 22), ['تفريغ'], 'Fujairah Gulf Agency', 9900),
      ],
    },
    {
      id: 6,
      number: 'VOY-2026-02',
      title: 'شرق المتوسط ⬅ غرب المتوسط (دمياط – بيرايوس – جنوة)',
      status: 'completed',
      startDate: v6Start,
      endDate: addDays(v6Start, 20),
      notes: 'حبوب إلى إيطاليا',
      stops: [
        stopOf('dam', v6Start, addDays(v6Start, 2), ['تحميل'], 'EgyCanal Shipping Agency', 13250),
        stopOf('pir', addDays(v6Start, 7), addDays(v6Start, 8), ['تموين', 'تزويد وقود'], 'Minerva Piraeus Agent', 12100),
        stopOf('gen', addDays(v6Start, 18), addDays(v6Start, 20), ['تفريغ'], 'Genoa Port Agency', 17400),
      ],
    },
    {
      id: 7,
      number: 'VOY-2026-03',
      title: 'شرق المتوسط ⬅ شمال أوروبا (دمياط – الإسكندرية – بيرايوس – جبل طارق – روتردام)',
      status: 'active',
      startDate: v7Start,
      endDate: addDays(now, 14),
      notes: 'رحلة شحن حبوب وأسمدة مع تموين ببيرايوس',
      stops: [
        stopOf('dam', v7Start, addDays(v7Start, 2), ['تحميل'], 'EgyCanal Shipping Agency', 13250),
        stopOf('alx', addDays(v7Start, 3), addDays(v7Start, 4), ['تموين', 'تزويد وقود'], 'Misr Marine Agency', 7300),
        stopOf('pir', addDays(now, 3), addDays(now, 4), ['تموين', 'تزويد وقود'], 'Minerva Piraeus Agent'),
        stopOf('gib', addDays(now, 9), addDays(now, 9), ['عبور قناة', 'تزويد وقود'], 'Gibraltar Strait Agency'),
        stopOf('rtm', addDays(now, 14), addDays(now, 17), ['تفريغ', 'تبديل طاقم'], 'EuroPort Agency BV'),
      ],
    },
    {
      id: 8,
      number: 'VOY-2026-04',
      title: 'البحر الأحمر ⬅ الخليج (السويس – جدة – الفجيرة)',
      status: 'planned',
      startDate: addDays(now, 30),
      endDate: addDays(now, 52),
      notes: 'عبور قناة السويس وشحن بضائع صب',
      stops: [
        stopOf('suz', addDays(now, 30), addDays(now, 32), ['تحميل', 'عبور قناة'], ''),
        stopOf('jed', addDays(now, 38), addDays(now, 40), ['تموين', 'تزويد وقود'], ''),
        stopOf('fuj', addDays(now, 50), addDays(now, 52), ['تفريغ'], ''),
      ],
    },
  ];

  /* طلبات الشراء */
  const reqs: Requisition[] = [];

  // طلب قديم لرحلة 5
  const r1 = mkReq(4, 5, 'received', -148, 'قبطان / طارق عبد الرحمن', 'تموين قبل رحلة الخليج', [
    mkLine('req-4', 1, 'p-rice', 300, '', 300),
    mkLine('req-4', 2, 'p-chicken', 120, '', 120),
    mkLine('req-4', 3, 'p-lube-cyl', 6, '', 6),
  ]);
  r1.offers = [
    mkOffer(r1, 'c-kitchen', 's-ahram', 'الأهرام لتموين السفن', -146, 3, 'خلال 30 يوم', [1.1, 3.2]),
    mkOffer(r1, 'c-oils', 's-misr', 'مصر للبترول للتموين البحري', -146, 4, 'تحويل بنكي', [1180]),
  ];
  r1.approvals = [
    { groupId: 'c-kitchen', offerId: r1.offers[0].id, expectedDate: addDays(now, -143), approvedAt: addDays(now, -145), approvedBy: 'إدارة الشركة' },
    { groupId: 'c-oils', offerId: r1.offers[1].id, expectedDate: addDays(now, -143), approvedAt: addDays(now, -145), approvedBy: 'إدارة الشركة' },
  ];
  reqs.push(r1);

  // طلب رحلة 6
  const r2 = mkReq(9, 6, 'received', -90, 'م. بحري / محمود عزت', 'صيانة قبل الرحلة', [
    mkLine('req-9', 1, 'p-filter-lube', 8, '', 8),
    mkLine('req-9', 2, 'p-bearing', 10, '', 10),
    mkLine('req-9', 3, 'p-paint-epoxy', 16, 'لدهان العنابر', 16),
    mkLine('req-9', 4, 'p-brush', 60, '', 60),
  ]);
  r2.offers = [
    mkOffer(r2, 'c-spares', 's-rotterdam', 'Rotterdam Marine Spares BV', -88, 6, 'LC', [58, 33]),
    mkOffer(r2, 'c-deck', 's-paints', 'Marine Paints Egypt', -88, 3, 'خلال 15 يوم', [168, 4.5]),
  ];
  r2.approvals = [
    { groupId: 'c-spares', offerId: r2.offers[0].id, expectedDate: addDays(now, -82), approvedAt: addDays(now, -87), approvedBy: 'إدارة الشركة' },
    { groupId: 'c-deck', offerId: r2.offers[1].id, expectedDate: addDays(now, -84), approvedAt: addDays(now, -87), approvedBy: 'إدارة الشركة' },
  ];
  reqs.push(r2);

  // طلب رحلة 7 — مستلم
  const r3 = mkReq(14, 7, 'received', -12, 'م. بحري / محمود عزت', 'زيوت ودهانات لصيانة الرحلة', [
    mkLine('req-14', 1, 'p-lube-sys', 4, '', 4),
    mkLine('req-14', 2, 'p-hyd', 2, '', 2),
    mkLine('req-14', 3, 'p-paint-af', 10, 'بدن السفينة', 10),
    mkLine('req-14', 4, 'p-thinner', 6, '', 6),  ]);
  r3.offers = [
    mkOffer(r3, 'c-oils', 's-misr', 'مصر للبترول للتموين البحري', -10, 3, 'تحويل بنكي', [1210, 940]),
    mkOffer(r3, 'c-oils', 's-vivo', 'Shell / Vivo Marine Bunkers', -10, 9, 'LC', [1160, 905]),
    mkOffer(r3, 'c-deck', 's-paints', 'Marine Paints Egypt', -10, 2, 'خلال 15 يوم', [236, 52]),
  ];
  r3.approvals = [
    { groupId: 'c-oils', offerId: r3.offers[0].id, expectedDate: addDays(now, -7), approvedAt: addDays(now, -9), approvedBy: 'إدارة الشركة' },
    { groupId: 'c-deck', offerId: r3.offers[2].id, expectedDate: addDays(now, -7), approvedAt: addDays(now, -9), approvedBy: 'إدارة الشركة' },
  ];
  r3.sends = [
    { groupId: 'c-oils', supplierId: 's-misr', supplierName: 'مصر للبترول للتموين البحري', email: 'bunkers@misrmarine.example', sentAt: addDays(now, -11) },
    { groupId: 'c-oils', supplierId: 's-vivo', supplierName: 'Shell / Vivo Marine Bunkers', email: 'marine@vivo-bunkers.example', sentAt: addDays(now, -11) },
    { groupId: 'c-deck', supplierId: 's-paints', supplierName: 'Marine Paints Egypt', email: 'tenders@marinepaints.example', sentAt: addDays(now, -11) },
  ];
  reqs.push(r3);

  // طلب إعاشة — موافق عليه وبانتظار التوريد
  const r4 = mkReq(18, 7, 'approved', -6, 'قبطان / طارق عبد الرحمن', 'مؤن قبل الوصول لبيرايوس', [
    mkLine('req-18', 1, 'p-chicken', 160),
    mkLine('req-18', 2, 'p-beef', 90),
    mkLine('req-18', 3, 'p-fruit', 120, 'فاكهة موسمية'),
    mkLine('req-18', 4, 'p-veg', 150),
    mkLine('req-18', 5, 'p-milk', 100),
  ]);
  r4.offers = [
    mkOffer(r4, 'c-kitchen', 's-ahram', 'الأهرام لتموين السفن', -4, 3, 'خلال 30 يوم', [3.4, 8.6, 1.9, 1.2, 1.05]),
    mkOffer(r4, 'c-kitchen', 's-nile', 'Nile Marine Provisions', -4, 2, 'نقداً عند التسليم', [3.1, 8.9, 1.7, 1.1, 1.1]),
    mkOffer(r4, 'c-kitchen', 's-hellenic', 'Hellenic Ship Stores', -4, 7, 'LC', [3.8, 9.4, 2.4, 1.6, 1.2]),
  ];
  r4.approvals = [{ groupId: 'c-kitchen', offerId: r4.offers[1].id, expectedDate: addDays(now, 3), approvedAt: addDays(now, -3), approvedBy: 'إدارة الشركة' }];
  r4.sends = r4.offers.map((o) => ({ groupId: 'c-kitchen', supplierId: o.supplierId, supplierName: o.supplierName, email: '', sentAt: addDays(now, -5) }));
  reqs.push(r4);

  // طلب قطع غيار عاجل — عروض وصلت
  const r5 = mkReq(
    21,
    7,
    'offers',
    -3,
    'م. بحري / محمود عزت',
    'أعطال في المحرك الرئيسي — مطلوب قبل بيرايوس',
    [
      mkLine('req-21', 1, 'p-filter-fuel', 8, 'فلاتر وقود المحرك الرئيسي'),
      mkLine('req-21', 2, 'p-injector', 6, 'بخاخات للأسطوانات 3 و4'),
      mkLine('req-21', 3, 'p-gasket', 2),
      mkLine('req-21', 4, 'p-pumpseal', 10, 'طلمبة مياه التبريد'),
    ],
    'urgent',
  );
  r5.offers = [
    mkOffer(r5, 'c-spares', 's-rotterdam', 'Rotterdam Marine Spares BV', -1, 6, 'LC', [66, 410, 1480, 84]),
    mkOffer(r5, 'c-spares', 's-gulf', 'Gulf Engine Parts FZE', -1, 4, 'تحويل بنكي', [58, 385, 1390, null]),
    mkOffer(r5, 'c-spares', 's-hellenic', 'Hellenic Ship Stores', -2, 5, 'خلال 30 يوم', [71, 440, 1560, 79]),
  ];
  r5.sends = r5.offers.map((o) => ({ groupId: 'c-spares', supplierId: o.supplierId, supplierName: o.supplierName, email: '', sentAt: addDays(now, -2) }));
  reqs.push(r5);

  // طلب جديد — بانتظار مراجعة الإدارة
  const r6 = mkReq(23, 7, 'submitted', -1, 'قبطان / طارق عبد الرحمن', 'مهمات سلامة وكوبري', [
    mkLine('req-23', 1, 'p-boots', 12, 'مقاسات 41–44'),
    mkLine('req-23', 2, 'p-extinguisher', 4),
    mkLine('req-23', 3, 'p-charts', 2, 'خرائط الأطلنطي'),
  ]);
  reqs.push(r6);

  /* حركة المخزن */
  const mv = (
    off: number,
    kind: Movement['kind'],
    productId: string,
    qty: number,
    by: string,
    department: string,
    note: string,
    requestId: string | null = null,
    voyageId: number | null = 7,
  ): Movement => {
    const row = productRow(productId);
    return {
      id: uid('mv'),
      date: addDays(now, off),
      kind,
      source: 'item',
      refId: productId,
      name: row[2],
      categoryId: row[1],
      unit: row[4],
      qty,
      balanceAfter: 0,
      by,
      department,
      note,
      requestId,
      voyageId,
    };
  };
  const movements = finalizeMovements(
    [
      mv(-1, 'out', 'p-rice', 25, 'طباخ رئيسي / عادل رمضان', 'المطبخ', 'وجبات الأسبوع'),
      mv(-1, 'out', 'p-chicken', 18, 'طباخ رئيسي / عادل رمضان', 'المطبخ', ''),
      mv(-2, 'out', 'p-paint-epoxy', 4, 'ريس بحري / السيد متولي', 'السطح', 'دهان سطح العنبر 2'),
      mv(-2, 'out', 'p-brush', 12, 'ريس بحري / السيد متولي', 'السطح', ''),
      mv(-3, 'out', 'p-filter-lube', 2, 'م. ثانٍ / سامح كمال', 'غرفة المحركات', 'تغيير فلاتر المولد 2'),
      mv(-3, 'out', 'p-bearing', 2, 'م. ثانٍ / سامح كمال', 'غرفة المحركات', 'طلمبة مياه التبريد'),
      mv(-4, 'out', 'p-detergent', 6, 'مضيف / كريم فؤاد', 'الإعاشة والنظافة', ''),
      mv(-5, 'out', 'p-lifejacket', 2, 'ضابط أول / حسام الدين', 'السلامة', 'استبدال سترات تالفة'),
      mv(-5, 'out', 'p-boots', 4, 'ريس بحري / السيد متولي', 'السطح', 'صرف شخصي للبحارة'),
      mv(-6, 'out', 'p-veg', 30, 'طباخ رئيسي / عادل رمضان', 'المطبخ', ''),
      mv(-7, 'in', 'p-lube-sys', 4, 'م. بحري / محمود عزت', 'غرفة المحركات', 'استلام طلب PR-2026-014', 'req-14'),
      mv(-7, 'in', 'p-hyd', 2, 'م. بحري / محمود عزت', 'غرفة المحركات', 'استلام طلب PR-2026-014', 'req-14'),
      mv(-7, 'in', 'p-paint-af', 10, 'ريس بحري / السيد متولي', 'السطح', 'استلام طلب PR-2026-014', 'req-14'),
      mv(-7, 'in', 'p-thinner', 6, 'ريس بحري / السيد متولي', 'السطح', 'استلام طلب PR-2026-014', 'req-14'),
      mv(-8, 'out', 'p-grease', 5, 'مزيّت / أحمد سعد', 'غرفة المحركات', 'تشحيم الونش'),
      mv(-9, 'adjust', 'p-cable', 0, 'م. ثانٍ / سامح كمال', 'غرفة المحركات', 'جرد دوري — لا فروقات'),
      mv(-10, 'out', 'p-sugar', 10, 'طباخ رئيسي / عادل رمضان', 'المطبخ', ''),
    ],
    stock,
    tanks,
  );

  /* التقارير اليومية (آخر 7 أيام) */
  const logs: DailyLog[] = [];
  for (let i = 1; i <= 7; i++) {
    logs.push({
      id: uid('log'),
      date: addDays(now, -i),
      location: i > 4 ? 'مياه دولية — شرق المتوسط' : 'الإبحار نحو بيرايوس',
      mode: 'sea',
      by: 'م. بحري / محمود عزت',
      hfo: 23.6 + (i % 3) * 0.5,
      mgo: 1.45 + (i % 2) * 0.1,
      lube: 0.24,
      water: 5.2 + (i % 3) * 0.2,
      hours: { mainEngine: 24, boiler: 6, gens: [12, 12, 0] },
      voyageId: 7,
    });
  }

  const bunkers: BunkerRecord[] = [
    { id: uid('bk'), date: addDays(v7Start, 3), tankId: 'hfo', qty: 220, pricePerTon: 548, supplier: 'مصر للبترول للتموين البحري', port: 'الإسكندرية', invoice: 'BNK-2026-188', voyageId: 7 },
    { id: uid('bk'), date: addDays(v7Start, 3), tankId: 'mgo', qty: 45, pricePerTon: 790, supplier: 'مصر للبترول للتموين البحري', port: 'الإسكندرية', invoice: 'BNK-2026-189', voyageId: 7 },
    { id: uid('bk'), date: addDays(v6Start, 7), tankId: 'hfo', qty: 240, pricePerTon: 524, supplier: 'Minerva Bunkering Med', port: 'بيرايوس', invoice: 'MNV-5521', voyageId: 6 },
    { id: uid('bk'), date: addDays(v5Start, 8), tankId: 'hfo', qty: 260, pricePerTon: 561, supplier: 'Gulf Bunkers', port: 'جدة', invoice: 'GB-3302', voyageId: 5 },
  ];

  const crew: CrewMember[] = [
    crewMember(1, 'طارق عبد الرحمن سالم', 'قبطان', 'deck', 'OnBoard', 6800, 'EG-A1021347', '+20 100 512 3301', -200, [['Master Mariner Unlimited COC', 'MM-44120', 900], ['STCW Basic Safety', 'BS-2291', 420]], [], 'خبرة 18 سنة في أعالي البحار'),
    crewMember(2, 'حسام الدين فؤاد', 'ضابط أول', 'deck', 'OnBoard', 4800, 'EG-A1041220', '+20 112 339 1020', -160, [['Chief Mate Unlimited STCW', 'CM-8830', 560], ['Medical First Aid', 'MFA-114', 38]]),
    crewMember(3, 'وليد شريف النجار', 'ضابط ثانٍ', 'deck', 'OnLeave', 3400, 'EG-A1090871', '+20 100 992 1144', -300, [['OOW Navigation STCW II/1', 'OOW-5521', 700]], [
      { id: 'ev-3-1', date: addDays(now, -20), type: 'leave', note: 'إجازة دورية بعد العقد' },
    ], 'عودة متوقعة قبل رحلة السويس'),
    crewMember(4, 'السيد متولي الغريب', 'ريس بحري', 'deck', 'OnBoard', 2100, 'EG-A2031190', '+20 109 771 4400', -120, [['Able Seafarer Deck', 'AB-7710', 820]]),
    crewMember(5, 'محمود عزت الدسوقي', 'كبير مهندسين', 'engine', 'OnBoard', 6400, 'EG-A1011994', '+20 101 884 2210', -240, [['Chief Engineer Class 1 COC', 'CE-3301', 1100], ['High Voltage Safety', 'HV-201', -12]], [], 'تخصص محركات MAN B&W وHitachi'),
    crewMember(6, 'سامح كمال الشناوي', 'مهندس ثانٍ', 'engine', 'OnBoard', 4700, 'EG-A1050655', '+20 122 650 9981', -110, [['Second Engineer Officer COC', 'SE-6612', 640]]),
    crewMember(7, 'أحمد سعد', 'مزيّت (Oiler)', 'engine', 'OnBoard', 1700, 'EG-A3010456', '+20 106 443 2201', -95, [['Engine Rating STCW', 'ER-901', 300]]),
    crewMember(8, 'عادل رمضان منصور', 'طباخ رئيسي', 'catering', 'OnBoard', 1850, 'EG-A3040987', '+20 106 211 7890', -330, [['Ship Cook MLC', 'SC-1180', 1000]]),
    crewMember(9, 'كريم فؤاد', 'مضيف', 'catering', 'OnBoard', 1400, 'EG-A3071123', '+20 100 330 9012', -75, [['Basic Safety STCW', 'BS-3340', 480]]),
    crewMember(10, 'مدحت شوقي عبد العزيز', 'قبطان', 'deck', 'Former', 6500, 'EG-A1000412', '+20 100 111 2233', -520, [['Master Mariner Unlimited COC', 'MM-30922', 400]], [
      { id: 'ev-10-1', date: addDays(now, -205), type: 'sign-off', note: 'انتهاء العقد — 3 عقود بتقييم ممتاز' },
    ]),
  ];

  const clients: CargoClient[] = [
    { id: 1, company: 'الهيئة العامة للسلع التموينية (GASC)', type: 'مستورد ومستلم (Consignee)', country: 'مصر', contact: 'لواء / وليد محمود', phone: '+20 2 2794 8100', email: 'contracts@gasc.example', terms: 'اعتماد مستندي LC 100%' },
    { id: 2, company: 'أبو قير للأسمدة', type: 'شاحن ومصدر (Shipper)', country: 'مصر', contact: 'م. طارق الصاوي', phone: '+20 3 560 3000', email: 'export@abuqir.example', terms: '80% عند الشحن + 20% عند الوصول' },
    { id: 3, company: 'Cargill Grain Europe', type: 'مستأجر سفينة (Charterer)', country: 'هولندا', contact: 'Mr. Jan De Vries', phone: '+31 10 288 4400', email: 'freight.eu@cargill.example', terms: 'تحويل بنكي خلال 5 أيام' },
  ];
  const shipments: Shipment[] = [
    { id: 1, ref: 'BL-EGY-501', clientId: 1, voyageId: 7, commodity: 'قمح صب', hold: 'عنبر 1', loadingPort: 'دمياط', dischargePort: 'روتردام', tons: 4800, ratePerTon: 58, extra: 0, paid: 70000, status: 'مشحونة بالبحر حالياً', date: v7Start },
    { id: 2, ref: 'BL-EGY-502', clientId: 2, voyageId: 7, commodity: 'سماد يوريا', hold: 'عنبر 2', loadingPort: 'دمياط', dischargePort: 'روتردام', tons: 1000, ratePerTon: 62, extra: 1200, paid: 0, status: 'مشحونة بالبحر حالياً', date: v7Start },
    { id: 3, ref: 'BL-EGY-488', clientId: 3, voyageId: 6, commodity: 'ذرة صفراء', hold: 'العنبران', loadingPort: 'دمياط', dischargePort: 'جنوة', tons: 5000, ratePerTon: 52, extra: 0, paid: 120000, status: 'تم التفريغ والتسليم', date: v6Start },
    { id: 4, ref: 'BL-EGY-451', clientId: 1, voyageId: 5, commodity: 'خام حديد', hold: 'العنبران', loadingPort: 'السويس', dischargePort: 'الفجيرة', tons: 4200, ratePerTon: 58, extra: 0, paid: 92400, status: 'تم التفريغ والتسليم', date: v5Start },
  ];

  const certificates = buildCertRegister('v11', AMANY_CERT_VALUES);

  return {
    tanks,
    holds,
    config: defaultConfig(),
    stock,
    movements,
    requests: reqs,
    crew,
    voyages: withExpected(voyages, defaultConfig()),
    bunkers,
    expenses: [
      { id: uid('ex'), date: addDays(now, -6), voyageId: 7, label: 'رسوم تفتيش وفحص (Port State)', amount: 850, note: '' },
      { id: uid('ex'), date: addDays(now, -70), voyageId: 6, label: 'مصاريف ميناء إضافية', amount: 1900, note: '' },
    ],
    logs,
    certificates,
    clients,
    shipments,
  };
}

function buildSecondVessel(): VesselData {
  const now = today();
  const stock: Record<string, number> = {};
  PRODUCT_ROWS.forEach((r) => (stock[r[0]] = Math.round(r[6] * 0.7)));
  const start = addDays(now, -40);
  return {
    tanks: defaultTanks(0.75),
    holds: [
      { id: 'hold1', name: 'عنبر 1', capacity: 3400, loaded: 0 },
      { id: 'hold2', name: 'عنبر 2', capacity: 3400, loaded: 0 },
    ],
    config: { ...defaultConfig(), mode: 'port', hfoTonsPerDaySea: 19 },
    stock,
    movements: [],
    requests: [],
    crew: [
      crewMember(21, 'أيمن فتحي', 'قبطان', 'deck', 'OnBoard', 6200, 'EG-B2020881', '+20 100 777 1010', -90, [['Master Mariner COC', 'MM-55231', 800]]),
      crewMember(22, 'ياسر منير', 'كبير مهندسين', 'engine', 'OnBoard', 5900, 'EG-B2021990', '+20 101 777 2020', -90, [['Chief Engineer COC', 'CE-4410', 640]]),
    ],
    voyages: withExpected(
      [
        {
          id: 21,
          number: 'VOY-2026-N1',
          title: 'دمياط ⬅ الإسكندرية (رحلة داخلية)',
          status: 'completed',
          startDate: start,
          endDate: addDays(start, 6),
          notes: '',
          stops: [stopOf('dam', start, addDays(start, 1), ['تحميل'], 'EgyCanal', 9200), stopOf('alx', addDays(start, 5), addDays(start, 6), ['تفريغ'], 'Misr Marine', 6100)],
        },
      ],
      { ...defaultConfig(), hfoTonsPerDaySea: 19 },
    ),
    bunkers: [],
    expenses: [],
    logs: [],
    certificates: buildCertRegister('v12'),
    clients: [],
    shipments: [],
  };
}

export function emptyVesselData(): VesselData {
  const stock: Record<string, number> = {};
  PRODUCT_ROWS.forEach((r) => (stock[r[0]] = 0));
  return {
    tanks: defaultTanks(0.3),
    holds: [{ id: 'hold1', name: 'عنبر 1', capacity: 3000, loaded: 0 }],
    config: defaultConfig(),
    stock,
    movements: [],
    requests: [],
    crew: [],
    voyages: [],
    bunkers: [],
    expenses: [],
    logs: [],
    certificates: buildCertRegister(uid('v')),
    clients: [],
    shipments: [],
  };
}

export function emptyVessel(id: string, name: string): VesselProfile {
  return {
    id,
    name,
    imo: '',
    callSign: '',
    flag: '',
    type: '',
    formerName: '',
    classSociety: '',
    buildYear: '',
    owner: '',
    dwt: 0,
    grt: 0,
    nrt: 0,
    loa: null,
    beam: null,
    draft: null,
    grainCapacity: null,
    baleCapacity: null,
    mainEngine: '',
    cranes: '',
    speedKn: 11,
    availableForCharter: false,
    charterRate: null,
    location: '',
    lat: 31.2,
    lng: 29.9,
    notes: '',
  };
}

function buildUsers(): ShipUser[] {
  return [
    { id: 'u1', name: 'م. نبيل عبد السلام', email: 'admin@fleet.example', role: 'Admin', vesselId: 'all', active: true },
    { id: 'u2', name: 'قبطان / طارق عبد الرحمن', email: 'captain@amany.example', role: 'Captain', vesselId: '11', active: true },
    { id: 'u3', name: 'م. بحري / محمود عزت', email: 'engineer@amany.example', role: 'ChiefEngineer', vesselId: '11', active: true },
    { id: 'u4', name: 'مراقب الأسطول', email: 'viewer@fleet.example', role: 'Viewer', vesselId: 'all', active: true },
  ];
}

export function buildSeed(): ShipState {
  const products: Product[] = PRODUCT_ROWS.map((r) => ({
    id: r[0],
    categoryId: r[1],
    name: r[2],
    code: r[3],
    unit: r[4],
    minLevel: r[5],
    active: true,
  }));
  return {
    version: STATE_VERSION,
    vessels: buildVessels(),
    categories: CATEGORIES.map((c) => ({ ...c })),
    products,
    suppliers: buildSuppliers(),
    ports: buildPorts(),
    users: buildUsers(),
    data: { '11': buildMainVessel(), '12': buildSecondVessel() },
  };
}

export const VOYAGE_STATUS_ORDER: VoyageStatus[] = ['active', 'planned', 'completed'];
