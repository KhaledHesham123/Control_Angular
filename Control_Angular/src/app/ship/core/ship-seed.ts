import { buildCertRegister } from './ship-certs';
import { Hold, ShipConfig, VesselData, VesselProfile } from './ship.types';

export const STATE_VERSION = 5;

export function emptyConfig(): ShipConfig {
  return {
    mode: 'port',
    power: 'aux_gen',
    hfoTonsPerDaySea: 0,
    mgoTonsPerDayPort: 0,
    boilerTonsPerHour: 0,
    lubeTonsPerHour: 0,
    foodKgPerPersonDay: 0,
    waterLitersPerPersonDay: 0,
    generators: [],
  };
}

export function emptyVesselData(): VesselData {
  return {
    tanks: [],
    holds: [],
    config: emptyConfig(),
    stock: {},
    movements: [],
    requests: [],
    crew: [],
    voyages: [],
    bunkers: [],
    expenses: [],
    logs: [],
    certificates: buildCertRegister('ship'),
    clients: [],
    shipments: [],
  };
}

/** مواصفات Amany Queen من بطاقة السفينة الحالية. للعرض في الفرونت فقط. */
export function amanyQueen(): VesselProfile {
  return {
    id: '11',
    name: 'M/V AMANY QUEEN',
    imo: '8318128',
    callSign: '9LU2856',
    flag: 'SIERRA LEONE',
    type: 'General Cargo',
    formerName: 'Ocean',
    classSociety: 'DBS',
    buildYear: '1983',
    owner: 'AMANY SHIPPING CO.',
    dwt: 5676.7,
    grt: 3780,
    nrt: 1533,
    loa: 96.96,
    beam: 17.6,
    draft: 6.826,
    grainCapacity: 5540,
    baleCapacity: 4876.8,
    mainEngine: 'MAK 6M551AK, 1470/2647 KE, 425 rpm, IF 380',
    cranes: '',
    speedKn: 15,
    availableForCharter: false,
    charterRate: null,
    location: '',
    lat: 0,
    lng: 0,
    notes:
      'المدير: NELLY SHIPPING COMPANY، 51 شارع رأس البر، دمياط، IMO 6403821. المالك: تسجيل C-120292، 80 Broad Street، Monrovia، ليبيريا، IMO 5940907. ميناء التسجيل فريتاون. الرقم الرسمي SLR10843، التسجيل VHQ-200-22-1944، MMSI 667002053، رقم التصنيف G30460. البناء J.J. Sietas رقم 860. الطول بين القائمين 90.36 م، والعمق للسطح العلوي 8.50 م. الغاطس شتاء 6.674 م، والحمولة الساكنة شتاء 5476 طن. الإزاحة 7780.5 / 7579.8 طن، الفري بورد الصيفي 1684 مم، الغاطس الهوائي 36.50 م، الوزن الخفيف 2103.80 طن. محركان مساعدان KHD AB 6M816 LLK-U، 257 ك.و / 350 حصان، 1500 لفة، MDO. مولدات PILLER ومولد عمود 300 ك.ف.أ. دافع مقدمة PLEUGER WM110-300. رفاص BERG 900H4 قطر 3800 مم. العنبر 52 × 12.6 × 8.275 م، فتحتان 25.15 × 12.57 م. تحميل الغطاء 1.65 طن/م² والقاع 10 طن/م². الاستهلاك 7 طن/24 ساعة DO، وفي الميناء 0.5 طن/24 ساعة MGO. إنمارسات 467100467.',
  };
}

/** عنبر واحد كما في بطاقة المواصفات، والسعة هي سعة الحبوب بالمتر المكعب. */
export function amanyHolds(): Hold[] {
  return [{ id: 'h1', name: 'العنبر', capacity: 5540, loaded: 0 }];
}

export function amanyConfig(): ShipConfig {
  return {
    ...emptyConfig(),
    mgoTonsPerDayPort: 0.5,
    dailyRates: [
      { kind: 'Diesel', motion: 'Sailing', tonsPerDay: 7 },
      { kind: 'Diesel', motion: 'Stopped', tonsPerDay: 0.5 },
    ],
    generators: [
      { id: 'g1', name: 'PILLER NKT 350-4 — 300 KVA', tonsPerHour: 0, defaultHours: 0 },
      { id: 'g2', name: 'PILLER NKT 350-4 — 300 KVA', tonsPerHour: 0, defaultHours: 0 },
      { id: 'g3', name: 'Shaft generator PILLER NKT 350-4 — 300 KVA', tonsPerHour: 0, defaultHours: 0 },
    ],
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
    speedKn: 0,
    availableForCharter: false,
    charterRate: null,
    location: '',
    lat: 0,
    lng: 0,
    notes: '',
  };
}
