import {
  CrewMember,
  Offer,
  Port,
  PortStop,
  Product,
  Category,
  DailyKind,
  Requisition,
  ShipConfig,
  Supplier,
  Tank,
  TANK_SINGLE_NAME,
  TankKind,
  Voyage,
  VesselData,
  VesselProfile,
} from './ship.types';

/* ───────────── تواريخ وأرقام ───────────── */

export function today(): string {
  return toIso(new Date());
}

export function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso || today()}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return 0;
  }
  return Math.round((b - a) / 86400000);
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

export function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/* ───────────── الكتالوج ───────────── */

export function rootOf(categoryId: string, categories: Category[]): Category | null {
  let current = categories.find((c) => c.id === categoryId) ?? null;
  const guard = new Set<string>();
  while (current?.parentId && !guard.has(current.id)) {
    guard.add(current.id);
    current = categories.find((c) => c.id === current!.parentId) ?? null;
  }
  return current;
}

export function categoryPath(categoryId: string | null, categories: Category[]): string {
  if (!categoryId) {
    return '';
  }
  const parts: string[] = [];
  let current = categories.find((c) => c.id === categoryId) ?? null;
  const guard = new Set<string>();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    parts.unshift(current.name);
    current = current.parentId ? (categories.find((c) => c.id === current!.parentId) ?? null) : null;
  }
  return parts.join(' / ');
}

export function descendantIds(categoryId: string, categories: Category[]): string[] {
  const out = [categoryId];
  const walk = (id: string) => {
    for (const child of categories.filter((c) => c.parentId === id)) {
      out.push(child.id);
      walk(child.id);
    }
  };
  walk(categoryId);
  return out;
}

/* ───────────── الخزانات ───────────── */

export interface Gauge {
  current: number;
  max: number;
  percent: number;
  tone: 'ok' | 'warn' | 'bad';
}

export function gaugeOf(current: number, max: number): Gauge {
  const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return { current, max, percent, tone: percent >= 45 ? 'ok' : percent >= 22 ? 'warn' : 'bad' };
}

export function tanksOf(tanks: Tank[], kind: TankKind): Tank[] {
  return tanks.filter((t) => t.kind === kind && (t.unit ?? 'طن') !== 'لتر');
}

export function kindGauge(tanks: Tank[], kind: TankKind): Gauge {
  const list = tanksOf(tanks, kind);
  return gaugeOf(
    list.reduce((s, t) => s + t.current, 0),
    list.reduce((s, t) => s + t.max, 0),
  );
}

export function onBoardCount(crew: CrewMember[]): number {
  return crew.filter((c) => c.status === 'OnBoard').length;
}

function storedDaily(config: ShipConfig, kind: DailyKind): number | null {
  const motion = config.mode === 'port' ? 'Stopped' : 'Sailing';
  const row = config.dailyRates?.find((item) => item.kind === kind && item.motion === motion);
  return row ? row.tonsPerDay : null;
}

/** الاستهلاك اليومي المتوقع (طن/يوم) لكل نوع حسب وضع السفينة. */
export function dailyBurn(kind: TankKind, config: ShipConfig, crewOnBoard: number): number {
  const gens = config.power === 'aux_gen' ? config.generators.reduce((s, g) => s + g.tonsPerHour * g.defaultHours, 0) : 0;
  if (kind === 'hfo') {
    return config.mode === 'sea' ? config.hfoTonsPerDaySea : 0;
  }
  if (kind === 'mgo') {
    const diesel = storedDaily(config, 'Diesel');
    if (diesel != null) return diesel;
    const boiler = config.boilerTonsPerHour * (config.mode === 'sea' ? 6 : 18);
    const port = config.mode === 'port' ? config.mgoTonsPerDayPort : 0;
    return gens + boiler + port;
  }
  if (kind === 'lube') {
    const oil = storedDaily(config, 'Lubricant');
    if (oil != null) return oil;
    return config.lubeTonsPerHour * (config.mode === 'sea' ? 24 : 12);
  }
  return storedDaily(config, 'Water') ?? (crewOnBoard * config.waterLitersPerPersonDay) / 1000 + 0.4;
}

/** عدد أيام الرحلة من تاريخ البداية حتى النهاية (يوم واحد على الأقل). */
export function voyageSpanDays(voyage: Pick<Voyage, 'startDate' | 'endDate'>): number {
  if (!voyage.startDate) {
    return 1;
  }
  const end = voyage.endDate && voyage.endDate > voyage.startDate ? voyage.endDate : today();
  return Math.max(1, daysBetween(voyage.startDate, end) || 1);
}

/** استهلاك الرحلة المتوقع بالطن: المعدل اليومي في الإبحار × أيام الرحلة. */
export function suggestVoyageConsumption(
  voyage: Pick<Voyage, 'startDate' | 'endDate'>,
  config: ShipConfig,
  crewOnBoard: number,
): { days: number; hfo: number; mgo: number; lube: number; water: number } {
  const days = voyageSpanDays(voyage);
  const atSea: ShipConfig = { ...config, mode: 'sea' };
  return {
    days,
    hfo: round(dailyBurn('hfo', atSea, crewOnBoard) * days, 1),
    mgo: round(dailyBurn('mgo', atSea, crewOnBoard) * days, 1),
    lube: round(dailyBurn('lube', atSea, crewOnBoard) * days, 1),
    water: round(dailyBurn('water', atSea, crewOnBoard) * days, 1),
  };
}

const CONSUMPTION_OF: Record<TankKind, 'HeavyFuel' | 'Diesel' | 'Water' | 'Lubricant'> = {
  hfo: 'HeavyFuel',
  mgo: 'Diesel',
  water: 'Water',
  lube: 'Lubricant',
};

export function voyageExpectedTons(voyage: Voyage, kind: TankKind, config: ShipConfig, crewOnBoard: number): number {
  const fromRows = num(voyage.consumptions?.find((row) => row.kind === CONSUMPTION_OF[kind])?.quantity);
  const stored = fromRows > 0
    ? fromRows
    : kind === 'hfo'
      ? voyage.expectedHfo
      : kind === 'mgo'
        ? voyage.expectedMgo
        : kind === 'lube'
          ? voyage.expectedLube
          : num(voyage.expectedWater);
  if (stored > 0) {
    return stored;
  }
  if (kind === 'water') {
    return 0;
  }
  const suggested = suggestVoyageConsumption(voyage, config, crewOnBoard);
  return kind === 'hfo' ? suggested.hfo : kind === 'mgo' ? suggested.mgo : suggested.lube;
}

/** المعدل اليومي من استهلاك الرحلة، وكم يوم تكفي الكمية الحالية. */
export function voyageFuelOutlook(
  kind: TankKind,
  current: number,
  voyage: Voyage | null,
  config: ShipConfig,
  crewOnBoard: number,
): { expected: number | null; spanDays: number; rate: number; lasts: number | null; coversVoyage: boolean | null } {
  if (!voyage) {
    const rate = dailyBurn(kind, config, crewOnBoard);
    return {
      expected: null,
      spanDays: 0,
      rate,
      lasts: rate > 0 ? current / rate : null,
      coversVoyage: null,
    };
  }
  const spanDays = voyageSpanDays(voyage);
  const expected = voyageExpectedTons(voyage, kind, config, crewOnBoard);
  if (expected <= 0) {
    const rate = dailyBurn(kind, config, crewOnBoard);
    return {
      expected: null,
      spanDays,
      rate,
      lasts: rate > 0 ? current / rate : null,
      coversVoyage: null,
    };
  }
  const rate = spanDays > 0 ? expected / spanDays : 0;
  const lasts = rate > 0 ? current / rate : null;
  const end = voyage.endDate && voyage.endDate >= today() ? voyage.endDate : voyage.startDate;
  const remaining = Math.max(0, daysBetween(today(), end));
  return {
    expected,
    spanDays,
    rate,
    lasts,
    coversVoyage: lasts == null ? null : lasts + 0.05 >= remaining,
  };
}

export function collapseTanks(tanks: Tank[]): Tank[] {
  const kinds: TankKind[] = ['hfo', 'mgo', 'lube', 'water'];
  return kinds.flatMap((kind) => {
    const list = tanks.filter((tank) => tank.kind === kind);
    const kept = list.filter((tank) => tank.unit === 'لتر' || tank.bob != null);
    const plain = list.filter((tank) => !kept.includes(tank));
    if (!plain.length) {
      return kept;
    }
    if (plain.length === 1 && plain[0].id === kind) {
      return [...plain, ...kept];
    }
    return [
      {
        id: kind,
        name: TANK_SINGLE_NAME[kind],
        kind,
        current: round(plain.reduce((sum, tank) => sum + num(tank.current), 0), 2),
        max: round(plain.reduce((sum, tank) => sum + num(tank.max), 0), 2),
      },
      ...kept,
    ];
  });
}

/* ───────────── الطاقم ───────────── */

export interface Interval {
  from: string;
  to: string | null;
}

/** الفترات اللي كان فيها الفرد فعلاً على السفينة (من الصعود حتى النزول أو بدء الإجازة). */
export function onboardIntervals(member: CrewMember): Interval[] {
  const events = [...member.events].sort((a, b) => a.date.localeCompare(b.date));
  const out: Interval[] = [];
  let open: string | null = null;
  for (const ev of events) {
    if ((ev.type === 'sign-on' || ev.type === 'return') && open === null) {
      open = ev.date;
    } else if ((ev.type === 'sign-off' || ev.type === 'leave') && open !== null) {
      out.push({ from: open, to: ev.date });
      open = null;
    }
  }
  if (open !== null) {
    out.push({ from: open, to: null });
  }
  return out;
}

export function overlapDays(intervals: Interval[], from: string, to: string): number {
  let total = 0;
  for (const it of intervals) {
    const a = it.from > from ? it.from : from;
    const end = it.to ?? to;
    const b = end < to ? end : to;
    if (b > a) {
      total += daysBetween(a, b);
    }
  }
  return total;
}

export function crewCostForPeriod(crew: CrewMember[], from: string, to: string): number {
  return crew.reduce((sum, m) => sum + (overlapDays(onboardIntervals(m), from, to) * m.salary) / 30, 0);
}

export function crewVoyageCount(member: CrewMember, voyages: Voyage[]): number {
  const intervals = onboardIntervals(member);
  const now = today();
  return voyages.filter((v) => {
    const end = v.endDate || (v.status === 'completed' ? v.startDate : now);
    return v.status !== 'planned' && overlapDays(intervals, v.startDate, end > v.startDate ? end : addDays(v.startDate, 1)) > 0;
  }).length;
}

export function certState(expiry: string): { tone: 'ok' | 'warn' | 'bad' | 'muted'; label: string } {
  if (!expiry) {
    return { tone: 'muted', label: 'بدون تاريخ' };
  }
  const left = daysBetween(today(), expiry);
  if (left < 0) {
    return { tone: 'bad', label: `منتهية منذ ${-left} يوم` };
  }
  if (left <= 90) {
    return { tone: 'warn', label: `تنتهي خلال ${left} يوم` };
  }
  return { tone: 'ok', label: 'سارية' };
}

/* ───────────── المسارات والرحلات ───────────── */

export function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const R = 3440.065;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** المسافة البحرية التقريبية: الدائرة العظمى × معامل انحناء المسار. */
export function seaDistanceNm(a: Port, b: Port): number {
  return Math.round(haversineNm(a.lat, a.lng, b.lat, b.lng) * 1.18);
}

export interface Leg {
  from: PortStop | null;
  to: PortStop;
  fromName: string;
  toName: string;
  nm: number;
  days: number;
  fuelT: number;
}

export function legsOf(voyage: Voyage, ports: Port[], speedKn: number, tpd: number): Leg[] {
  const out: Leg[] = [];
  const speed = speedKn > 0 ? speedKn : 10;
  for (let i = 1; i < voyage.stops.length; i++) {
    const a = voyage.stops[i - 1];
    const b = voyage.stops[i];
    const pa = ports.find((p) => p.id === a.portId);
    const pb = ports.find((p) => p.id === b.portId);
    const nm = b.legNm ?? (pa && pb ? seaDistanceNm(pa, pb) : 0);
    const days = nm / (speed * 24);
    out.push({
      from: a,
      to: b,
      fromName: pa?.name ?? '—',
      toName: pb?.name ?? '—',
      nm,
      days,
      fuelT: b.legFuelT ?? round(days * tpd, 1),
    });
  }
  return out;
}

export function stopFees(stop: PortStop): number {
  return stop.actualFda > 0 ? stop.actualFda : num(stop.berthFee) + num(stop.pilotFee) + num(stop.canalFee) + num(stop.agencyFee);
}

/* ───────────── العروض والتقييم ───────────── */

export function activeLines(req: Requisition, groupId: string) {
  return req.lines.filter((l) => !l.removed && l.groupId === groupId);
}

export function groupsOf(req: Requisition): string[] {
  return [...new Set(req.lines.filter((l) => !l.removed).map((l) => l.groupId))];
}

export interface OfferView {
  offer: Offer;
  total: number;
  priced: number;
  of: number;
  coverage: number;
  effective: number;
  score: number;
  best: boolean;
  cheapest: boolean;
  fastest: boolean;
  rating: number | null;
  reasons: string[];
}

export function supplierRating(supplier: Supplier | undefined): number | null {
  if (!supplier || supplier.reviews.length === 0) {
    return null;
  }
  return round(supplier.reviews.reduce((s, r) => s + r.stars, 0) / supplier.reviews.length, 1);
}

export function offerTotal(req: Requisition, offer: Offer): number {
  let total = 0;
  for (const line of activeLines(req, offer.groupId)) {
    const price = offer.lines.find((l) => l.lineId === line.id)?.unitPrice;
    if (price != null && price > 0) {
      total += price * line.qty;
    }
  }
  return total;
}

export function scoreOffers(req: Requisition, groupId: string, suppliers: Supplier[]): OfferView[] {
  const lines = activeLines(req, groupId);
  const offers = req.offers.filter((o) => o.groupId === groupId);
  if (!offers.length) {
    return [];
  }
  const rows = offers.map((offer) => {
    const priced = lines.filter((l) => {
      const p = offer.lines.find((x) => x.lineId === l.id)?.unitPrice;
      return p != null && p > 0;
    }).length;
    const total = offerTotal(req, offer);
    const coverage = lines.length ? priced / lines.length : 0;
    const supplier = suppliers.find((s) => s.id === offer.supplierId);
    return {
      offer,
      total,
      priced,
      of: lines.length,
      coverage,
      effective: coverage > 0 ? total / coverage : Number.POSITIVE_INFINITY,
      rating: supplierRating(supplier),
    };
  });
  const minEffective = Math.min(...rows.map((r) => r.effective));
  const minDays = Math.min(...rows.map((r) => Math.max(1, r.offer.deliveryDays)));
  const views: OfferView[] = rows.map((r) => {
    const priceScore = Number.isFinite(r.effective) && r.effective > 0 ? minEffective / r.effective : 0;
    const dayScore = minDays / Math.max(1, r.offer.deliveryDays);
    const ratingScore = (r.rating ?? 3.5) / 5;
    const score = Math.round((priceScore * 0.5 + dayScore * 0.2 + ratingScore * 0.15 + r.coverage * 0.15) * 100);
    return {
      ...r,
      score,
      best: false,
      cheapest: r.effective === minEffective,
      fastest: Math.max(1, r.offer.deliveryDays) === minDays,
      reasons: [],
    };
  });
  views.sort((a, b) => b.score - a.score);
  if (views[0]) {
    views[0].best = true;
    const v = views[0];
    if (v.cheapest) v.reasons.push('أقل سعر');
    if (v.fastest) v.reasons.push('أسرع توريد');
    if ((v.rating ?? 0) >= 4) v.reasons.push(`تقييم مورد ${v.rating}`);
    if (v.coverage === 1) v.reasons.push('يغطي كل الأصناف');
    if (!v.reasons.length) v.reasons.push('أفضل توازن بين السعر والتوريد والتقييم');
  }
  return views;
}

export function priceTone(ratio: number): { tone: 'ok' | 'warn' | 'bad'; label: string } {
  if (ratio <= 1.03) {
    return { tone: 'ok', label: 'سعر منافس' };
  }
  if (ratio <= 1.12) {
    return { tone: 'warn', label: 'سعر متوسط' };
  }
  return { tone: 'bad', label: 'سعر مرتفع' };
}

/** مؤشر غلاء المورد = متوسط (إجمالي عرضه ÷ أقل عرض) عبر كل المقارنات السابقة. */
export function supplierPriceIndex(supplierId: string, allRequests: Requisition[]): number | null {
  const ratios: number[] = [];
  for (const req of allRequests) {
    for (const groupId of groupsOf(req)) {
      const offers = req.offers.filter((o) => o.groupId === groupId);
      if (offers.length < 2) continue;
      const lines = activeLines(req, groupId);
      const eff = offers.map((o) => {
        const priced = lines.filter((l) => (o.lines.find((x) => x.lineId === l.id)?.unitPrice ?? 0) > 0).length;
        const total = offerTotal(req, o);
        return { id: o.supplierId, v: priced ? total / (priced / lines.length) : Number.POSITIVE_INFINITY };
      });
      const min = Math.min(...eff.map((e) => e.v));
      const mine = eff.find((e) => e.id === supplierId);
      if (mine && Number.isFinite(mine.v) && min > 0) {
        ratios.push(mine.v / min);
      }
    }
  }
  return ratios.length ? ratios.reduce((s, r) => s + r, 0) / ratios.length : null;
}

/* ───────────── تكلفة الرحلة ───────────── */

export interface VoyageCost {
  purchasesByGroup: Record<string, number>;
  purchases: number;
  committed: number;
  bunker: number;
  port: number;
  crew: number;
  other: number;
  total: number;
  days: number;
}

export function voyageEnd(v: Voyage): string {
  if (v.endDate) return v.endDate;
  if (v.status === 'planned') return v.startDate;
  return today();
}

export function purchaseValue(req: Requisition, groupId: string): { actual: number; committed: number } {
  const approval = req.approvals.find((a) => a.groupId === groupId);
  const offer = approval ? req.offers.find((o) => o.id === approval.offerId) : undefined;
  if (!offer) {
    return { actual: 0, committed: 0 };
  }
  let actual = 0;
  let committed = 0;
  for (const line of activeLines(req, groupId)) {
    const price = offer.lines.find((l) => l.lineId === line.id)?.unitPrice ?? 0;
    if (price <= 0) continue;
    if (line.received != null) {
      actual += price * line.received;
    } else {
      committed += price * line.qty;
    }
  }
  return { actual, committed };
}

export function voyageCost(voyage: Voyage, data: VesselData, categories: Category[]): VoyageCost {
  const purchasesByGroup: Record<string, number> = {};
  let committed = 0;
  for (const req of data.requests) {
    if (req.voyageId !== voyage.id || req.status === 'cancelled') continue;
    for (const groupId of groupsOf(req)) {
      const v = purchaseValue(req, groupId);
      const root = rootOf(groupId, categories)?.id ?? groupId;
      purchasesByGroup[root] = (purchasesByGroup[root] ?? 0) + v.actual + v.committed;
      committed += v.committed;
    }
  }
  const purchases = Object.values(purchasesByGroup).reduce((s, v) => s + v, 0);
  const end = voyageEnd(voyage);
  let bunker = data.bunkers.filter((b) => b.voyageId === voyage.id).reduce((s, b) => s + b.qty * b.pricePerTon, 0);
  let port = voyage.stops.reduce((s, st) => s + stopFees(st), 0);
  let sheetCrew = 0;
  let other = 0;
  for (const expense of data.expenses) {
    if (expense.voyageId !== voyage.id) continue;
    if (expense.category === 'fuel') bunker += expense.amount;
    else if (expense.category === 'port') port += expense.amount;
    else if (expense.category === 'crew') sheetCrew += expense.amount;
    else other += expense.amount;
  }
  const crew = sheetCrew > 0 ? sheetCrew : crewCostForPeriod(data.crew, voyage.startDate, end);
  return {
    purchasesByGroup,
    purchases,
    committed,
    bunker,
    port,
    crew,
    other,
    total: purchases + bunker + port + crew + other,
    days: Math.max(0, daysBetween(voyage.startDate, end)),
  };
}

export function voyageRevenue(voyage: Voyage, data: VesselData): number {
  return data.shipments
    .filter((s) => s.voyageId === voyage.id)
    .reduce((sum, s) => sum + s.tons * s.ratePerTon + s.extra, 0);
}

/* ───────────── مخطط المسار ───────────── */

export interface RoutePlan {
  portIds: string[];
  names: string[];
  nm: number;
  days: number;
  fuelT: number;
  bestBunkerPort: Port | null;
  fuelPrice: number;
  fuelCost: number;
  portCost: number;
  total: number;
  legs: { from: string; to: string; nm: number; days: number; fuelT: number }[];
  warnings: string[];
}

export function bunkerScore(port: Port, suppliers: Supplier[]): { price: number; rating: number | null; adjusted: number } {
  const linked = suppliers.filter((s) => s.active && (port.supplierIds.includes(s.id) || s.portIds.includes(port.id)));
  const ratings = linked.map((s) => supplierRating(s)).filter((r): r is number => r != null);
  const rating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const price = port.hfoPrice;
  // كل نجمة أقل من 5 تضيف 1.5٪ على السعر كعقوبة للمخاطرة.
  const adjusted = price * (1 + (5 - (rating ?? 3.5)) * 0.015);
  return { price, rating, adjusted };
}

export function planRoute(
  portIds: string[],
  ports: Port[],
  suppliers: Supplier[],
  vessel: VesselProfile,
  config: ShipConfig,
  daysInPort = 1.5,
): RoutePlan {
  const list = portIds.map((id) => ports.find((p) => p.id === id)).filter((p): p is Port => !!p);
  const legs: RoutePlan['legs'] = [];
  const speed = vessel.speedKn > 0 ? vessel.speedKn : 10;
  for (let i = 1; i < list.length; i++) {
    const nm = seaDistanceNm(list[i - 1], list[i]);
    const days = nm / (speed * 24);
    legs.push({ from: list[i - 1].name, to: list[i].name, nm, days, fuelT: round(days * config.hfoTonsPerDaySea, 1) });
  }
  const nm = legs.reduce((s, l) => s + l.nm, 0);
  const days = legs.reduce((s, l) => s + l.days, 0);
  const fuelT = round(
    legs.reduce((s, l) => s + l.fuelT, 0),
    1,
  );
  const candidates = list.filter((p) => p.hfoPrice > 0);
  let best: Port | null = null;
  let bestAdj = Number.POSITIVE_INFINITY;
  for (const p of candidates) {
    const s = bunkerScore(p, suppliers);
    if (s.adjusted < bestAdj) {
      bestAdj = s.adjusted;
      best = p;
    }
  }
  const fuelPrice = best?.hfoPrice ?? 0;
  const portCost = list.reduce((s, p) => s + (p.berthPerDay * daysInPort + p.pilotage + p.agency + p.canal), 0);
  const warnings: string[] = [];
  if (list.length < 2) warnings.push('اختَر ميناءين على الأقل.');
  if (!best) warnings.push('لا يوجد ميناء تزويد بسعر وقود معروف على هذا المسار.');
  return {
    portIds,
    names: list.map((p) => p.name),
    nm,
    days: round(days + daysInPort * Math.max(0, list.length - 1), 1),
    fuelT,
    bestBunkerPort: best,
    fuelPrice,
    fuelCost: Math.round(fuelT * fuelPrice),
    portCost: Math.round(portCost),
    total: Math.round(fuelT * fuelPrice + portCost),
    legs,
    warnings,
  };
}

/* ───────────── مساعدات للعرض ───────────── */

export function productById(products: Product[], id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
