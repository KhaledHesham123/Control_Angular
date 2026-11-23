/* ───────────── الأدوار والصلاحيات ───────────── */

export type ShipRole = 'Admin' | 'Captain' | 'ChiefEngineer' | 'Viewer';

export const SHIP_ROLES: { id: ShipRole; label: string; hint: string }[] = [
  { id: 'Admin', label: 'مدير الشركة (Admin)', hint: 'يدير الكتالوج والموردين والموافقات والتكاليف' },
  { id: 'Captain', label: 'القبطان (Captain)', hint: 'طلبات الشراء، الصرف، الاستلام، الطاقم' },
  { id: 'ChiefEngineer', label: 'كبير المهندسين (Engineer)', hint: 'طلبات الشراء، الصرف، الوقود والتقرير اليومي' },
  { id: 'Viewer', label: 'مراقب (Viewer)', hint: 'عرض فقط' },
];

export type ShipPerm =
  | 'request'
  | 'review'
  | 'approve'
  | 'receive'
  | 'issue'
  | 'daily'
  | 'bunker'
  | 'catalog'
  | 'suppliers'
  | 'voyages'
  | 'crew'
  | 'fleet'
  | 'costs';

export const ROLE_PERMS: Record<ShipRole, ShipPerm[]> = {
  Admin: ['request', 'review', 'approve', 'receive', 'issue', 'daily', 'bunker', 'catalog', 'suppliers', 'voyages', 'crew', 'fleet', 'costs'],
  Captain: ['request', 'receive', 'issue', 'daily', 'crew', 'voyages'],
  ChiefEngineer: ['request', 'receive', 'issue', 'daily', 'bunker'],
  Viewer: [],
};

/* ───────────── السفينة والأسطول ───────────── */

export interface VesselProfile {
  id: string;
  name: string;
  imo: string;
  callSign: string;
  flag: string;
  type: string;
  formerName: string;
  classSociety: string;
  buildYear: string;
  owner: string;
  dwt: number;
  grt: number;
  nrt: number;
  loa: number | null;
  beam: number | null;
  draft: number | null;
  grainCapacity: number | null;
  baleCapacity: number | null;
  mainEngine: string;
  cranes: string;
  speedKn: number;
  availableForCharter: boolean;
  charterRate: number | null;
  location: string;
  lat: number;
  lng: number;
  notes: string;
}

export type TankKind = 'hfo' | 'mgo' | 'lube' | 'water';

export const TANK_KIND_LABEL: Record<TankKind, string> = {
  hfo: 'وقود ثقيل (HFO)',
  mgo: 'ديزل (MGO)',
  lube: 'زيوت',
  water: 'مياه عذبة',
};

export interface Tank {
  id: string;
  name: string;
  kind: TankKind;
  current: number;
  max: number;
}

export interface Hold {
  id: string;
  name: string;
  capacity: number;
  loaded: number;
}

export interface Generator {
  id: string;
  name: string;
  tonsPerHour: number;
  defaultHours: number;
}

export interface ShipConfig {
  mode: 'sea' | 'port';
  power: 'aux_gen' | 'shaft_gen' | 'shore_power';
  hfoTonsPerDaySea: number;
  mgoTonsPerDayPort: number;
  boilerTonsPerHour: number;
  lubeTonsPerHour: number;
  foodKgPerPersonDay: number;
  waterLitersPerPersonDay: number;
  generators: Generator[];
}

/* ───────────── الكتالوج ───────────── */

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  icon: string;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  unit: string;
  minLevel: number;
  active: boolean;
}

export const UNITS = ['قطعة', 'علبة', 'كجم', 'لتر', 'جالون', 'طقم', 'متر', 'كيس', 'برميل', 'دستة'];

export const DEPARTMENTS = [
  'غرفة المحركات',
  'الكوبري (الملاحة)',
  'السطح',
  'المطبخ',
  'الإعاشة والنظافة',
  'الورشة',
  'الطاقم / شخصي',
  'السلامة',
];

/* ───────────── الموردون والموانئ ───────────── */

export interface SupplierReview {
  id: string;
  date: string;
  stars: number;
  comment: string;
  by: string;
}

export interface Supplier {
  id: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
  country: string;
  categoryIds: string[];
  portIds: string[];
  reviews: SupplierReview[];
  notes: string;
  active: boolean;
}

export interface Port {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  hfoPrice: number;
  mgoPrice: number;
  berthPerDay: number;
  pilotage: number;
  agency: number;
  canal: number;
  supplierIds: string[];
  notes: string;
}

/* ───────────── المخزن والحركة ───────────── */

export type MoveKind = 'in' | 'out' | 'adjust' | 'consume' | 'bunker';

export const MOVE_LABEL: Record<MoveKind, string> = {
  in: 'استلام',
  out: 'صرف',
  adjust: 'جرد / تسوية',
  consume: 'استهلاك يومي',
  bunker: 'تزويد وقود',
};

export interface Movement {
  id: string;
  date: string;
  kind: MoveKind;
  source: 'item' | 'tank';
  refId: string;
  name: string;
  categoryId: string | null;
  unit: string;
  qty: number;
  balanceAfter: number;
  by: string;
  department: string;
  note: string;
  requestId: string | null;
  voyageId: number | null;
}

/* ───────────── طلبات الشراء ───────────── */

export type ReqStatus = 'draft' | 'submitted' | 'ready' | 'sent' | 'offers' | 'approved' | 'received' | 'cancelled';

export const REQ_STATUS: Record<ReqStatus, { label: string; tone: string; order: number }> = {
  draft: { label: 'مسودة', tone: 'muted', order: 0 },
  submitted: { label: 'بانتظار مراجعة الإدارة', tone: 'warn', order: 1 },
  ready: { label: 'جاهز للإرسال للموردين', tone: 'info', order: 2 },
  sent: { label: 'أُرسل للموردين', tone: 'info', order: 3 },
  offers: { label: 'عروض وصلت', tone: 'violet', order: 4 },
  approved: { label: 'تمت الموافقة · بانتظار التوريد', tone: 'ok', order: 5 },
  received: { label: 'تم الاستلام', tone: 'done', order: 6 },
  cancelled: { label: 'ملغي', tone: 'bad', order: 7 },
};

export interface ReqLine {
  id: string;
  productId: string;
  name: string;
  unit: string;
  categoryId: string;
  groupId: string;
  qty: number;
  description: string;
  removed: boolean;
  received: number | null;
}

export interface OfferLine {
  lineId: string;
  unitPrice: number | null;
}

export interface Offer {
  id: string;
  groupId: string;
  supplierId: string;
  supplierName: string;
  date: string;
  deliveryDays: number;
  validityDays: number;
  payment: string;
  lines: OfferLine[];
  notes: string;
}

export interface GroupApproval {
  groupId: string;
  offerId: string;
  expectedDate: string;
  approvedAt: string;
  approvedBy: string;
}

export interface SendRecord {
  groupId: string;
  supplierId: string;
  supplierName: string;
  email: string;
  sentAt: string;
}

export interface ReqEvent {
  at: string;
  by: string;
  text: string;
}

export interface Requisition {
  id: string;
  no: string;
  vesselId: string;
  voyageId: number | null;
  createdAt: string;
  createdBy: string;
  status: ReqStatus;
  priority: 'normal' | 'urgent';
  notes: string;
  lines: ReqLine[];
  sends: SendRecord[];
  offers: Offer[];
  approvals: GroupApproval[];
  events: ReqEvent[];
}

/* ───────────── الطاقم ───────────── */

export type CrewStatus = 'OnBoard' | 'OnLeave' | 'Former';
export type CrewDept = 'deck' | 'engine' | 'catering';

export const CREW_DEPT_LABEL: Record<CrewDept, string> = {
  deck: 'سطح وملاحة',
  engine: 'ماكينة وكهرباء',
  catering: 'إعاشة وخدمات',
};

export const CREW_STATUS_LABEL: Record<CrewStatus, string> = {
  OnBoard: 'في الخدمة',
  OnLeave: 'في إجازة',
  Former: 'خرج من السفينة',
};

export const CREW_RANKS: { rank: string; dept: CrewDept }[] = [
  { rank: 'قبطان', dept: 'deck' },
  { rank: 'ضابط أول', dept: 'deck' },
  { rank: 'ضابط ثانٍ', dept: 'deck' },
  { rank: 'ضابط ثالث', dept: 'deck' },
  { rank: 'ريس بحري', dept: 'deck' },
  { rank: 'بحار ماهر (AB)', dept: 'deck' },
  { rank: 'بحار عادي (OS)', dept: 'deck' },
  { rank: 'كبير مهندسين', dept: 'engine' },
  { rank: 'مهندس ثانٍ', dept: 'engine' },
  { rank: 'مهندس ثالث', dept: 'engine' },
  { rank: 'مهندس كهرباء', dept: 'engine' },
  { rank: 'مزيّت (Oiler)', dept: 'engine' },
  { rank: 'طباخ رئيسي', dept: 'catering' },
  { rank: 'مضيف', dept: 'catering' },
];

export interface CrewCert {
  id: string;
  name: string;
  number: string;
  expiry: string;
}

export interface CrewEvent {
  id: string;
  date: string;
  type: 'sign-on' | 'sign-off' | 'leave' | 'return';
  note: string;
}

export interface CrewMember {
  id: string;
  name: string;
  rank: string;
  dept: CrewDept;
  nationality: string;
  passportNo: string;
  seamanBookNo: string;
  phone: string;
  salary: number;
  photo: string | null;
  status: CrewStatus;
  certs: CrewCert[];
  events: CrewEvent[];
  notes: string;
}

/* ───────────── الرحلات والمصروفات ───────────── */

export type VoyageStatus = 'planned' | 'active' | 'completed';

export const VOYAGE_STATUS_LABEL: Record<VoyageStatus, string> = {
  planned: 'مجدولة',
  active: 'جارية',
  completed: 'مكتملة',
};

export const STOP_ACTIVITIES = ['تحميل', 'تفريغ', 'تزويد وقود', 'تموين', 'عبور قناة', 'تبديل طاقم', 'فحص'];

export interface PortStop {
  id: string;
  portId: string;
  eta: string;
  etd: string;
  activities: string[];
  berthFee: number;
  pilotFee: number;
  canalFee: number;
  agencyFee: number;
  actualFda: number;
  agent: string;
  legNm: number | null;
  legFuelT: number | null;
}

export interface Voyage {
  id: number;
  number: string;
  title: string;
  status: VoyageStatus;
  startDate: string;
  endDate: string;
  stops: PortStop[];
  notes: string;
}

export interface BunkerRecord {
  id: string;
  date: string;
  tankId: string;
  qty: number;
  pricePerTon: number;
  supplier: string;
  port: string;
  invoice: string;
  voyageId: number | null;
}

export interface Expense {
  id: string;
  date: string;
  voyageId: number | null;
  label: string;
  amount: number;
  note: string;
}

export interface DailyLog {
  id: string;
  date: string;
  location: string;
  mode: 'sea' | 'port';
  by: string;
  hfo: number;
  mgo: number;
  lube: number;
  water: number;
  hours: { mainEngine: number; boiler: number; gens: number[] };
  voyageId: number | null;
}

/** أقسام نموذج "Vessel's Certificate Status" (DE-01). */
export type CertSection = 'cert' | 'lsa' | 'dated';

export interface CertFile {
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

/** سطر في سجل شهادات السفينة: كل سطر = نوع شهادة (أو بند له تاريخ صلاحية). */
export interface Certificate {
  id: string;
  section: CertSection;
  /** رقم السطر في النموذج (1, 2, … 31-A, 51, …). */
  no: string;
  title: string;
  /** الجهة المانحة (Issued By). */
  issuer: string;
  /** رقم الشهادة (اختياري). */
  docNo: string;
  issueDate: string;
  /** آخر معاينة (Last Insp.) — للقسم الأول. */
  lastInsp: string;
  /** موعد الاستحقاق / المعاينة القادمة (Due Date) — للقسم الأول. */
  dueDate: string;
  expiryDate: string;
  /** للبنود المؤرخة: الكمية والنوع وتاريخ الصنع. */
  qty: string;
  type: string;
  mfgDate: string;
  notes: string;
  file: CertFile | null;
}

export const CERT_SECTIONS: { id: CertSection; label: string; short: string; hint: string }[] = [
  { id: 'cert', label: 'الشهادات الأساسية', short: '1 – 50', hint: 'شهادات التسجيل والتصنيف والقانونية والتأمين والموانئ' },
  { id: 'lsa', label: 'معدات الإنقاذ والراديو وغيرها', short: '51 – 100', hint: 'LSA / FFA / GMDSS وشهادات المعايرة والفحص السنوي' },
  { id: 'dated', label: 'بنود لها تاريخ صلاحية', short: 'Other dated items', hint: 'بطاريات، مشاعل، هيدروستات، طقم إسعافات… مع الكمية والمكان' },
];

export interface CargoClient {
  id: number;
  company: string;
  type: string;
  country: string;
  contact: string;
  phone: string;
  email: string;
  terms: string;
}

export interface Shipment {
  id: number;
  ref: string;
  clientId: number;
  voyageId: number;
  commodity: string;
  hold: string;
  loadingPort: string;
  dischargePort: string;
  tons: number;
  ratePerTon: number;
  extra: number;
  paid: number;
  status: string;
  date: string;
}

export interface ShipUser {
  id: string;
  name: string;
  email: string;
  role: ShipRole;
  vesselId: string;
  active: boolean;
}

/* ───────────── بيانات كل سفينة ───────────── */

export interface VesselData {
  tanks: Tank[];
  holds: Hold[];
  config: ShipConfig;
  stock: Record<string, number>;
  movements: Movement[];
  requests: Requisition[];
  crew: CrewMember[];
  voyages: Voyage[];
  bunkers: BunkerRecord[];
  expenses: Expense[];
  logs: DailyLog[];
  certificates: Certificate[];
  clients: CargoClient[];
  shipments: Shipment[];
}

export interface ShipState {
  version: number;
  vessels: VesselProfile[];
  categories: Category[];
  products: Product[];
  suppliers: Supplier[];
  ports: Port[];
  users: ShipUser[];
  data: Record<string, VesselData>;
}

/* ───────────── التنقل ───────────── */

export interface NavItem {
  route: string;
  label: string;
  icon: string;
  exact?: boolean;
  perm?: ShipPerm;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const SHIP_NAV: NavSection[] = [
  {
    title: 'نظرة المالك',
    items: [
      { route: '/ship', label: 'لوحة المتابعة', icon: 'gauge', exact: true },
      { route: '/ship/reports', label: 'التكاليف والتقارير', icon: 'chart', perm: 'costs' },
      { route: '/ship/fleet', label: 'الأسطول والتأجير', icon: 'ship', perm: 'fleet' },
      { route: '/ship/particulars', label: 'مواصفات السفينة', icon: 'file' },
    ],
  },
  {
    title: 'التشغيل اليومي',
    items: [
      { route: '/ship/requests', label: 'طلبات الشراء', icon: 'cart' },
      { route: '/ship/stores', label: 'المخزن والصرف', icon: 'box' },
      { route: '/ship/tanks', label: 'الخزانات والوقود', icon: 'fuel' },
      { route: '/ship/daily', label: 'التقرير اليومي', icon: 'clock' },
      { route: '/ship/log', label: 'سجل الحركة', icon: 'list' },
    ],
  },
  {
    title: 'الرحلات',
    items: [
      { route: '/ship/voyages', label: 'الرحلات وتكلفتها', icon: 'route' },
      { route: '/ship/planner', label: 'مخطط المسار والمقارنة', icon: 'compass', perm: 'voyages' },
      { route: '/ship/ports', label: 'الموانئ وأسعار الوقود', icon: 'anchor' },
      { route: '/ship/clients', label: 'العملاء والشحنات', icon: 'users2' },
      { route: '/ship/cargo', label: 'سعة العنابر', icon: 'cube' },
    ],
  },
  {
    title: 'الموردون والكتالوج',
    items: [
      { route: '/ship/suppliers', label: 'الموردون والتقييم', icon: 'truck', perm: 'suppliers' },
      { route: '/ship/catalog', label: 'كتالوج الأقسام والأصناف', icon: 'tag', perm: 'catalog' },
    ],
  },
  {
    title: 'الناس والمستندات',
    items: [
      { route: '/ship/crew', label: 'طاقم السفينة', icon: 'users' },
      { route: '/ship/certificates', label: 'شهادات السفينة', icon: 'shield' },
      { route: '/ship/users', label: 'المستخدمون والصلاحيات', icon: 'key', perm: 'fleet' },
      { route: '/ship/settings', label: 'أرقام التشغيل', icon: 'cog', perm: 'fleet' },
    ],
  },
];
