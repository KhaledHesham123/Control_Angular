import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { API_BASE_URL } from '../../core/api.config';
import { Result } from '../../core/api.model';
import { ShipFiles } from './ship-files';
import {
  activeLines,
  addDays,
  collapseTanks,
  groupsOf,
  num,
  round,
  suggestVoyageConsumption,
  today,
  uid,
} from './ship-calc';
import { buildCertRegister } from './ship-certs';
import { AMANY_CERTS } from './ship-certs-amany';
import { amanyNoonReports } from './ship-amany-noon';
import { amanyTradePorts, amanyTradeVoyages } from './ship-amany-voyages';
import { amanyCrew } from './ship-amany-crew';
import { amanyBunkers, amanyExpenses, amanyTanks } from './ship-amany-ops';
import { amanyConfig, amanyHolds, amanyQueen, emptyVessel, emptyVesselData, STATE_VERSION } from './ship-seed';
import { AMANY_CATEGORIES, AMANY_PRODUCTS, AMANY_STOCK } from './ship-stores-amany';
import {
  BunkerRecord,
  CargoClient,
  Category,
  Certificate,
  ConsumptionKind,
  CrewCert,
  CrewMember,
  DailyLog,
  DailyRate,
  Expense,
  GroupApproval,
  MoveKind,
  Movement,
  Offer,
  Port,
  Product,
  ReqEvent,
  ReqLine,
  ReqStatus,
  Requisition,
  ROLE_PERMS,
  Shipment,
  ShipConfig,
  ShipPerm,
  ShipRole,
  ShipState,
  ShipUser,
  StatusLogEntry,
  Supplier,
  Tank,
  TankKind,
  VesselData,
  VesselProfile,
  Voyage,
} from './ship.types';

const SHIP_API = `${API_BASE_URL}/Ship`;

export interface DailyInput {
  date: string;
  location: string;
  mode: 'sea' | 'port';
  hoursMain: number;
  hoursBoiler: number;
  genHours: number[];
}

export interface Toast {
  text: string;
  tone: 'ok' | 'warn' | 'bad';
}

export interface NewRequestLine {
  productId: string;
  qty: number;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class ShipStore {
  private readonly files = inject(ShipFiles);
  private readonly http = inject(HttpClient);
  private loaded = true;
  readonly state = signal<ShipState>(ShipStore.display());
  readonly vesselId = signal('11');
  readonly role = signal<ShipRole>('Admin');
  readonly toast = signal<Toast | null>(null);

  readonly vessels = computed(() => this.state().vessels);
  readonly categories = computed(() => this.state().categories);
  readonly products = computed(() => this.state().products);
  readonly suppliers = computed(() => this.state().suppliers);
  readonly ports = computed(() => this.state().ports);
  readonly users = computed(() => this.state().users);

  readonly vessel = computed<VesselProfile>(() => {
    const s = this.state();
    return s.vessels.find((v) => v.id === this.vesselId()) ?? s.vessels[0] ?? emptyVessel('', '…');
  });
  readonly data = computed<VesselData>(() => {
    const id = this.vessel().id;
    if (!id) return { ...emptyVesselData(), certificates: [] };
    return this.state().data[id] ?? emptyVesselData();
  });

  readonly tanks = computed(() => this.data().tanks);
  readonly crew = computed(() => this.data().crew);
  readonly crewOnBoard = computed(() => this.data().crew.filter((c) => c.status === 'OnBoard'));
  readonly voyages = computed(() => this.data().voyages);
  readonly requests = computed(() => this.data().requests);
  readonly movements = computed(() => this.data().movements);

  readonly activeVoyage = computed<Voyage | null>(() => this.data().voyages.find((v) => v.status === 'active') ?? null);

  readonly actor = computed(() => {
    const crew = this.data().crew.filter((c) => c.status === 'OnBoard');
    switch (this.role()) {
      case 'Admin':
        return 'إدارة الشركة';
      case 'Captain':
        return crew.find((c) => c.rank === 'ربان' || c.rank === 'قبطان')?.name ?? 'الربان';
      case 'ChiefEngineer':
        return crew.find((c) => c.rank === 'كبير مهندسين')?.name ?? 'كبير المهندسين';
      default:
        return 'مراقب';
    }
  });

  /* ───────────── تحميل وحفظ ───────────── */

  private static blank(): ShipState {
    return {
      version: STATE_VERSION,
      vessels: [],
      categories: [],
      products: [],
      suppliers: [],
      ports: [],
      users: [],
      data: {},
    };
  }

  /** بيانات العرض المحلية. مش بتتبعت للباك. */
  private static display(): ShipState {
    const ship = amanyQueen();
    return {
      ...ShipStore.blank(),
      vessels: [ship],
      categories: AMANY_CATEGORIES,
      products: AMANY_PRODUCTS,
      ports: amanyTradePorts(),
      data: {
        [ship.id]: {
          ...emptyVesselData(),
          holds: amanyHolds(),
          tanks: amanyTanks(),
          voyages: amanyTradeVoyages(),
          crew: amanyCrew(),
          expenses: amanyExpenses(),
          bunkers: amanyBunkers(),
          logs: amanyNoonReports(),
          stock: AMANY_STOCK,
          config: amanyConfig(),
          certificates: buildCertRegister(ship.id, AMANY_CERTS),
        },
      },
    };
  }

  private send(method: 'put' | 'post' | 'delete', path: string, body?: unknown, query?: Record<string, string | number>): void {
    let params = new HttpParams();
    const vesselCode = this.vessel().id;
    const fleetWide = path.startsWith('Catalog/') || path.startsWith('Suppliers') || path.startsWith('Ports') || path === 'Fleet/Particulars' || path.startsWith('Fleet/Users');
    if (!fleetWide && vesselCode) {
      params = params.set('vesselCode', vesselCode);
    }
    for (const [key, value] of Object.entries(query ?? {})) {
      params = params.set(key, String(value));
    }
    const url = `${SHIP_API}/${path}`;
    const request =
      method === 'delete'
        ? this.http.delete<Result<boolean>>(url, { params })
        : method === 'post'
          ? this.http.post<Result<boolean>>(url, body ?? {}, { params })
          : this.http.put<Result<boolean>>(url, body ?? {}, { params });
    request.subscribe({
      next: (result) => {
        if (!result?.succeeded) {
          this.notify(result?.messages?.join(' ') || 'الخادم لم يحفظ العملية.', 'bad');
        }
      },
      error: () => this.notify('تعذر الاتصال بالخادم لحفظ العملية.', 'bad'),
    });
  }

  private applyServerState(result: Result<ShipState>, fallback = ''): void {
    if (!result.succeeded || !result.data) {
      this.loaded = true;
      if (fallback) {
        this.notify(result.messages?.join(' ') || fallback, 'bad');
      }
      return;
    }
    const normalized = this.normalizeBoard(result.data);
    this.loaded = false;
    this.state.set(normalized.board);
    if (!normalized.board.vessels.some((vessel) => vessel.id === this.vesselId())) {
      this.vesselId.set(normalized.board.vessels[0]?.id ?? '');
    }
    this.loaded = true;
  }

  private normalizeBoard(board: ShipState): { board: ShipState; changed: boolean } {
    let changed = false;
    const data: ShipState['data'] = {};
    for (const [key, vesselData] of Object.entries(board.data ?? {})) {
      const tanks = collapseTanks(vesselData.tanks ?? []);
      const kindById = new Map((vesselData.tanks ?? []).map((tank) => [tank.id, tank.kind]));
      const bunkers = (vesselData.bunkers ?? []).map((record) => {
        const kind = kindById.get(record.tankId);
        return kind && kind !== record.tankId ? { ...record, tankId: kind } : record;
      });
      const crew = (vesselData.crew ?? []).filter((member) => member.status === 'OnBoard').length || 1;
      const voyages = (vesselData.voyages ?? []).map((voyage) => {
        const rows = voyage.consumptions ?? [];
        if (rows.length) {
          const qty = (kind: ConsumptionKind) => num(rows.find((row) => row.kind === kind)?.quantity);
          return {
            ...voyage,
            consumptions: rows.map((row) => ({ kind: row.kind, quantity: num(row.quantity) })),
            expectedHfo: qty('HeavyFuel'),
            expectedMgo: qty('Diesel'),
            expectedLube: qty('Lubricant'),
            expectedWater: qty('Water'),
          };
        }
        const hasRate = num(voyage.expectedHfo) > 0 || num(voyage.expectedMgo) > 0 || num(voyage.expectedLube) > 0 || num(voyage.expectedWater) > 0;
        if (hasRate) {
          return {
            ...voyage,
            expectedHfo: num(voyage.expectedHfo),
            expectedMgo: num(voyage.expectedMgo),
            expectedLube: num(voyage.expectedLube),
            expectedWater: num(voyage.expectedWater),
          };
        }
        const burn = suggestVoyageConsumption(voyage, vesselData.config, crew);
        return { ...voyage, expectedHfo: burn.hfo, expectedMgo: burn.mgo, expectedLube: burn.lube };
      });
      if (
        tanks.length !== (vesselData.tanks ?? []).length ||
        bunkers.some((record, index) => record.tankId !== vesselData.bunkers[index]?.tankId) ||
        voyages.some((voyage, index) => voyage.expectedHfo !== vesselData.voyages[index]?.expectedHfo)
      ) {
        changed = true;
      }
      data[key] = { ...vesselData, tanks, bunkers, voyages };
    }
    return { board: { ...board, data }, changed };
  }

  resetDemo(): void {
    this.http.post<Result<ShipState>>(`${SHIP_API}/Reset`, {}).subscribe({
      next: (result) => {
        if (result.succeeded && result.data) this.applyServerState(result);
        else {
          this.state.set(ShipStore.blank());
          this.vesselId.set('');
          this.loaded = true;
        }
        this.notify('تم مسح بيانات اللوحة.');
      },
      error: () => this.notify('تعذر مسح بيانات السيرفر.', 'bad'),
    });
  }

  /* ───────────── أدوات عامة ───────────── */

  can(perm: ShipPerm): boolean {
    return ROLE_PERMS[this.role()].includes(perm);
  }

  setRole(role: ShipRole): void {
    this.role.set(role);
  }

  selectVessel(id: string): void {
    if (this.state().vessels.some((v) => v.id === id)) {
      this.vesselId.set(id);
    }
  }

  notify(text: string, tone: Toast['tone'] = 'ok'): void {
    const toast = { text, tone };
    this.toast.set(toast);
    window.setTimeout(() => {
      if (this.toast() === toast) {
        this.toast.set(null);
      }
    }, 4200);
  }

  private patch(fn: (d: VesselData) => VesselData): void {
    if (!this.loaded) {
      return;
    }
    const id = this.vessel().id;
    if (!id) {
      return;
    }
    this.state.update((s) => ({ ...s, data: { ...s.data, [id]: fn(s.data[id] ?? emptyVesselData()) } }));
  }

  private patchRoot(fn: (s: ShipState) => ShipState): void {
    if (!this.loaded) {
      return;
    }
    this.state.update(fn);
  }

  /* ───────────── الأسطول ───────────── */

  saveVessel(profile: VesselProfile): void {
    this.patchRoot((s) => ({ ...s, vessels: s.vessels.map((v) => (v.id === profile.id ? { ...profile } : v)) }));
    this.send('put', 'Fleet/Particulars', profile);
    this.notify('تم حفظ مواصفات السفينة.');
  }

  getParticulars(id: string): Observable<VesselProfile | null> {
    return this.http.get<Result<VesselProfile>>(`${SHIP_API}/Fleet/Particulars/${encodeURIComponent(id)}`).pipe(
      map((result) => (result.succeeded && result.data ? { ...result.data, id: result.data.id || id } : null)),
      catchError(() => of(null)),
    );
  }

  createParticulars(profile: VesselProfile): Observable<boolean> {
    this.rememberVessel(profile);
    return this.http.post<Result<boolean>>(`${SHIP_API}/Fleet/Particulars`, profile).pipe(
      map((result) => this.done(result, 'تم إنشاء مواصفات السفينة.')),
      catchError(() => this.failed()),
    );
  }

  updateParticulars(profile: VesselProfile): Observable<boolean> {
    this.rememberVessel(profile);
    return this.http.put<Result<boolean>>(`${SHIP_API}/Fleet/Particulars/${encodeURIComponent(profile.id)}`, profile).pipe(
      map((result) => this.done(result, 'تم تعديل مواصفات السفينة.')),
      catchError(() => this.failed()),
    );
  }

  deleteParticulars(id: string): Observable<boolean> {
    return this.http.delete<Result<boolean>>(`${SHIP_API}/Fleet/Particulars/${encodeURIComponent(id)}`).pipe(
      map((result) => {
        if (!result?.succeeded) {
          this.notify(result?.messages?.join(' ') || 'الخادم لم يحذف المواصفات.', 'bad');
          return false;
        }
        this.patchRoot((s) => {
          const data = { ...s.data };
          delete data[id];
          return { ...s, vessels: s.vessels.filter((vessel) => vessel.id !== id), data };
        });
        if (this.vesselId() === id) this.vesselId.set(this.state().vessels[0]?.id ?? '');
        this.notify('تم حذف مواصفات السفينة.', 'warn');
        return true;
      }),
      catchError(() => this.failed()),
    );
  }

  private rememberVessel(profile: VesselProfile): void {
    this.patchRoot((s) => ({
      ...s,
      vessels: s.vessels.some((vessel) => vessel.id === profile.id)
        ? s.vessels.map((vessel) => (vessel.id === profile.id ? { ...profile } : vessel))
        : [...s.vessels, profile],
      data: s.data[profile.id] ? s.data : { ...s.data, [profile.id]: emptyVesselData() },
    }));
  }

  private done(result: Result<boolean>, message: string): boolean {
    if (!result?.succeeded) {
      this.notify(result?.messages?.join(' ') || 'الخادم لم يحفظ العملية.', 'bad');
      return false;
    }
    this.notify(message);
    return true;
  }

  private failed(): Observable<boolean> {
    this.notify('تعذر الاتصال بالخادم لحفظ العملية.', 'bad');
    return of(false);
  }

  addVessel(name: string): string {
    const id = String(Math.max(0, ...this.state().vessels.map((v) => Number(v.id) || 0)) + 1);
    this.patchRoot((s) => ({
      ...s,
      vessels: [...s.vessels, emptyVessel(id, name.trim() || `سفينة ${id}`)],
      data: { ...s.data, [id]: emptyVesselData() },
    }));
    this.vesselId.set(id);
    return id;
  }

  /* ───────────── الكتالوج ───────────── */

  saveCategory(cat: Category): void {
    const exists = this.categories().some((c) => c.id === cat.id);
    this.patchRoot((s) => ({
      ...s,
      categories: exists ? s.categories.map((c) => (c.id === cat.id ? cat : c)) : [...s.categories, cat],
    }));
    this.send('put', 'Catalog/Categories', cat);
    this.notify('تم حفظ القسم.');
  }

  deleteCategory(id: string): string | null {
    const s = this.state();
    if (s.categories.some((c) => c.parentId === id)) {
      return 'القسم له أقسام فرعية. احذفها أو انقلها أولاً.';
    }
    if (s.products.some((p) => p.categoryId === id)) {
      return 'القسم يحتوي أصنافاً. انقلها أو احذفها أولاً.';
    }
    this.patchRoot((st) => ({ ...st, categories: st.categories.filter((c) => c.id !== id) }));
    this.send('delete', `Catalog/Categories/${id}`);
    this.notify('تم حذف القسم.');
    return null;
  }

  saveProduct(product: Product): void {
    const exists = this.products().some((p) => p.id === product.id);
    this.patchRoot((s) => ({
      ...s,
      products: exists ? s.products.map((p) => (p.id === product.id ? product : p)) : [...s.products, product],
    }));
    this.send('put', 'Catalog/Products', product);
    this.notify(exists ? 'تم تحديث الصنف.' : 'تمت إضافة الصنف — سيظهر للسفن عند إنشاء الطلبات.');
  }

  deleteProduct(id: string): void {
    this.patchRoot((s) => ({ ...s, products: s.products.map((p) => (p.id === id ? { ...p, active: false } : p)) }));
    this.send('delete', `Catalog/Products/${id}`);
    this.notify('تم إيقاف الصنف (يبقى في السجلات السابقة).');
  }

  /* ───────────── الموردون والموانئ ───────────── */

  saveSupplier(supplier: Supplier): void {
    this.patchRoot((s) => {
      const exists = s.suppliers.some((x) => x.id === supplier.id);
      const suppliers = exists ? s.suppliers.map((x) => (x.id === supplier.id ? supplier : x)) : [...s.suppliers, supplier];
      return { ...s, suppliers, ports: s.ports.map((p) => ({ ...p, supplierIds: suppliers.filter((x) => x.portIds.includes(p.id)).map((x) => x.id) })) };
    });
    this.send('put', 'Suppliers', supplier);
    this.notify('تم حفظ المورد.');
  }

  deleteSupplier(id: string): void {
    this.patchRoot((s) => ({
      ...s,
      suppliers: s.suppliers.filter((x) => x.id !== id),
      ports: s.ports.map((p) => ({ ...p, supplierIds: p.supplierIds.filter((x) => x !== id) })),
    }));
    this.send('delete', `Suppliers/${id}`);
    this.notify('تم حذف المورد.');
  }

  addReview(supplierId: string, stars: number, comment: string): void {
    this.patchRoot((s) => ({
      ...s,
      suppliers: s.suppliers.map((x) =>
        x.id === supplierId
          ? { ...x, reviews: [{ id: uid('rv'), date: today(), stars, comment, by: this.actor() }, ...x.reviews] }
          : x,
      ),
    }));
    const review = this.suppliers().find((item) => item.id === supplierId)?.reviews[0];
    if (review) this.send('post', `Suppliers/${supplierId}/Reviews`, review);
    this.notify('تمت إضافة التقييم.');
  }

  savePort(port: Port): void {
    this.patchRoot((s) => {
      const exists = s.ports.some((x) => x.id === port.id);
      const ports = exists ? s.ports.map((x) => (x.id === port.id ? port : x)) : [...s.ports, port];
      return {
        ...s,
        ports,
        suppliers: s.suppliers.map((x) => {
          const linked = port.supplierIds.includes(x.id);
          const has = x.portIds.includes(port.id);
          if (linked && !has) return { ...x, portIds: [...x.portIds, port.id] };
          if (!linked && has) return { ...x, portIds: x.portIds.filter((p) => p !== port.id) };
          return x;
        }),
      };
    });
    this.send('put', 'Ports', port);
    this.notify('تم حفظ الميناء.');
  }

  deletePort(id: string): void {
    this.patchRoot((s) => ({
      ...s,
      ports: s.ports.filter((p) => p.id !== id),
      suppliers: s.suppliers.map((x) => ({ ...x, portIds: x.portIds.filter((p) => p !== id) })),
    }));
    this.send('delete', `Ports/${id}`);
    this.notify('تم حذف الميناء.');
  }

  /* ───────────── المخزن والحركة ───────────── */

  private movement(partial: Omit<Movement, 'id' | 'voyageId'> & { voyageId?: number | null }): Movement {
    return { id: uid('mv'), voyageId: partial.voyageId ?? this.activeVoyage()?.id ?? null, ...partial };
  }

  stockOf(productId: string): number {
    return this.data().stock[productId] ?? 0;
  }

  issueItem(productId: string, qty: number, takenBy: string, department: string, note: string, date: string): string | null {
    const product = this.products().find((p) => p.id === productId);
    const amount = num(qty);
    if (!product) return 'الصنف غير موجود.';
    if (amount <= 0) return 'أدخل كمية أكبر من صفر.';
    const available = this.stockOf(productId);
    if (amount > available) return `الرصيد المتاح ${available} ${product.unit} فقط.`;
    const balance = round(available - amount, 3);
    this.patch((d) => ({
      ...d,
      stock: { ...d.stock, [productId]: balance },
      movements: [
        this.movement({
          date,
          kind: 'out',
          source: 'item',
          refId: productId,
          name: product.name,
          categoryId: product.categoryId,
          unit: product.unit,
          qty: amount,
          balanceAfter: balance,
          by: takenBy || this.actor(),
          department,
          note,
          requestId: null,
        }),
        ...d.movements,
      ],
    }));
    this.send('put', 'Inventory/Stock', undefined, { productCode: productId, quantity: balance });
    this.send('post', 'Inventory/Movements', this.movements()[0]);
    this.notify(`تم صرف ${amount} ${product.unit} من «${product.name}» — الرصيد ${balance}.`);
    return null;
  }

  receiveItem(productId: string, qty: number, note: string, date: string, requestId: string | null = null, silent = false): string | null {
    const product = this.products().find((p) => p.id === productId);
    const amount = num(qty);
    if (!product) return 'الصنف غير موجود.';
    if (amount <= 0) return 'أدخل كمية أكبر من صفر.';
    const balance = round(this.stockOf(productId) + amount, 3);
    this.patch((d) => ({
      ...d,
      stock: { ...d.stock, [productId]: balance },
      movements: [
        this.movement({
          date,
          kind: 'in',
          source: 'item',
          refId: productId,
          name: product.name,
          categoryId: product.categoryId,
          unit: product.unit,
          qty: amount,
          balanceAfter: balance,
          by: this.actor(),
          department: '—',
          note,
          requestId,
        }),
        ...d.movements,
      ],
    }));
    this.send('put', 'Inventory/Stock', undefined, { productCode: productId, quantity: balance });
    this.send('post', 'Inventory/Movements', this.movements()[0]);
    if (!silent) {
      this.notify(`تم استلام ${amount} ${product.unit} في «${product.name}» — الرصيد ${balance}.`);
    }
    return null;
  }

  adjustItem(productId: string, counted: number, note: string): string | null {
    const product = this.products().find((p) => p.id === productId);
    const value = num(counted);
    if (!product) return 'الصنف غير موجود.';
    if (value < 0) return 'الكمية لا يمكن أن تكون سالبة.';
    const before = this.stockOf(productId);
    this.patch((d) => ({
      ...d,
      stock: { ...d.stock, [productId]: value },
      movements: [
        this.movement({
          date: today(),
          kind: 'adjust',
          source: 'item',
          refId: productId,
          name: product.name,
          categoryId: product.categoryId,
          unit: product.unit,
          qty: Math.abs(round(value - before, 3)),
          balanceAfter: value,
          by: this.actor(),
          department: '—',
          note: note || `جرد: من ${before} إلى ${value}`,
          requestId: null,
        }),
        ...d.movements,
      ],
    }));
    this.send('put', 'Inventory/Stock', undefined, { productCode: productId, quantity: value });
    this.send('post', 'Inventory/Movements', this.movements()[0]);
    this.notify('تم تحديث الرصيد بعد الجرد.');
    return null;
  }

  /* ───────────── الخزانات والوقود ───────────── */

  private tankMove(tank: Tank, kind: MoveKind, qty: number, balance: number, note: string, date: string, department = 'غرفة المحركات'): Movement {
    return this.movement({
      date,
      kind,
      source: 'tank',
      refId: tank.id,
      name: tank.name,
      categoryId: null,
      unit: 'طن',
      qty: round(qty, 3),
      balanceAfter: round(balance, 2),
      by: this.actor(),
      department,
      note,
      requestId: null,
    });
  }

  bunker(tankId: string, qty: number, price: number, supplier: string, port: string, invoice: string, date: string): string | null {
    const tank = this.tanks().find((t) => t.id === tankId);
    const amount = num(qty);
    if (!tank) return 'اختر الخزان.';
    if (amount <= 0) return 'أدخل كمية التزويد.';
    const room = tank.max - tank.current;
    if (amount > room + 0.001) return `المساحة الفارغة في الخزان ${round(room, 1)} طن فقط.`;
    const balance = tank.current + amount;
    const record: BunkerRecord = {
      id: uid('bk'),
      date,
      tankId,
      qty: amount,
      pricePerTon: num(price),
      supplier,
      port,
      invoice,
      voyageId: this.activeVoyage()?.id ?? null,
    };
    this.patch((d) => ({
      ...d,
      tanks: d.tanks.map((t) => (t.id === tankId ? { ...t, current: round(balance, 2) } : t)),
      bunkers: [record, ...d.bunkers],
      movements: [this.tankMove(tank, 'bunker', amount, balance, `${supplier} — ${port} (فاتورة ${invoice || '—'})`, date), ...d.movements],
    }));
    this.send('put', 'Tanks', { ...tank, current: round(balance, 2) });
    this.send('post', 'Tanks/Bunker', record);
    this.send('post', 'Inventory/Movements', this.movements()[0]);
    this.notify(`تم تزويد ${amount} طن في «${tank.name}» بتكلفة $${Math.round(amount * num(price)).toLocaleString('en-US')}.`);
    return null;
  }

  sounding(tankId: string, level: number, note: string): string | null {
    const tank = this.tanks().find((t) => t.id === tankId);
    const value = num(level);
    if (!tank) return 'الخزان غير موجود.';
    if (value < 0 || value > tank.max) return `القيمة يجب أن تكون بين 0 و ${tank.max}.`;
    this.patch((d) => ({
      ...d,
      tanks: d.tanks.map((t) => (t.id === tankId ? { ...t, current: value } : t)),
      movements: [this.tankMove(tank, 'adjust', Math.abs(value - tank.current), value, note || 'قياس فعلي للخزان (Sounding)', today()), ...d.movements],
    }));
    this.send('put', 'Tanks', { ...tank, current: value });
    this.send('post', 'Inventory/Movements', this.movements()[0]);
    this.notify('تم تحديث مستوى الخزان.');
    return null;
  }

  saveTank(tank: Tank): void {
    const saved = { ...tank, id: tank.kind };
    this.patch((d) => ({
      ...d,
      tanks: d.tanks.some((t) => t.kind === tank.kind)
        ? d.tanks.map((t) => (t.kind === tank.kind ? saved : t))
        : [...d.tanks, saved],
    }));
    this.send('put', 'Tanks', saved);
    this.notify('تم حفظ الخزان.');
  }

  deleteTank(id: string): void {
    this.patch((d) => ({ ...d, tanks: d.tanks.filter((t) => t.id !== id) }));
    this.send('delete', `Tanks/${id}`);
    this.notify('تم حذف الخزان.');
  }

  /* ───────────── التقرير اليومي ───────────── */

  calcDaily(input: DailyInput): { hfo: number; mgo: number; lube: number; water: number } {
    const cfg = this.data().config;
    const crew = Math.max(1, this.crewOnBoard().length);
    const hfo = input.mode === 'sea' ? (num(input.hoursMain) / 24) * cfg.hfoTonsPerDaySea : 0;
    const gens = input.genHours.reduce((s, h, i) => s + num(h) * (cfg.generators[i]?.tonsPerHour ?? 0), 0);
    const mgo =
      (input.mode === 'port' ? (num(input.hoursMain) / 24) * cfg.mgoTonsPerDayPort : 0) + gens + num(input.hoursBoiler) * cfg.boilerTonsPerHour;
    const lube = num(input.hoursMain) * cfg.lubeTonsPerHour;
    const water = (crew * cfg.waterLitersPerPersonDay) / 1000 + num(input.hoursBoiler) * 0.03;
    return { hfo: round(hfo, 2), mgo: round(mgo, 2), lube: round(lube, 3), water: round(water, 2) };
  }

  submitDaily(input: DailyInput): string | null {
    if (this.data().logs.some((l) => l.date === input.date)) {
      return 'يوجد تقرير مسجل لهذا اليوم بالفعل.';
    }
    const use = this.calcDaily(input);
    const voyageId = this.activeVoyage()?.id ?? null;
    const moves: Movement[] = [];
    let tanks = this.tanks().map((t) => ({ ...t }));
    const deduct = (kind: TankKind, amount: number, label: string) => {
      let left = amount;
      tanks = tanks.map((t) => {
        if (t.kind !== kind || left <= 0 || t.current <= 0) return t;
        const used = Math.min(t.current, left);
        left -= used;
        const after = round(t.current - used, 3);
        moves.push(this.tankMove(t, 'consume', used, after, `استهلاك يومي — ${label}`, input.date));
        return { ...t, current: after };
      });
    };
    deduct('hfo', use.hfo, 'وقود المحرك الرئيسي');
    deduct('mgo', use.mgo, 'مولدات وغلاية');
    deduct('lube', use.lube, 'زيوت');
    deduct('water', use.water, 'مياه الطاقم');

    const log: DailyLog = {
      id: uid('log'),
      date: input.date,
      location: input.location,
      mode: input.mode,
      by: this.actor(),
      hfo: use.hfo,
      mgo: use.mgo,
      lube: use.lube,
      water: use.water,
      hours: { mainEngine: num(input.hoursMain), boiler: num(input.hoursBoiler), gens: input.genHours.map(num) },
      voyageId,
    };
    this.patch((d) => ({
      ...d,
      tanks,
      logs: [log, ...d.logs].sort((a, b) => b.date.localeCompare(a.date)),
      config: { ...d.config, mode: input.mode },
      movements: [...moves, ...d.movements],
    }));
    this.send('post', 'Operations/Daily', log);
    for (const tank of tanks) this.send('put', 'Tanks', tank);
    this.notify('تم حفظ التقرير اليومي وخصم الاستهلاك من الخزانات.');
    return null;
  }

  saveConfig(config: ShipConfig): void {
    const current = this.data().config.mode;
    this.patch((d) => ({ ...d, config: { ...config, mode: current, generators: config.generators.map((g) => ({ ...g })) } }));
    this.send('put', 'Operations/Config', { ...config, mode: current });
    this.notify('تم حفظ أرقام التشغيل.');
  }

  applyDailyRates(rates: DailyRate[]): void {
    this.patch((d) => ({ ...d, config: { ...d.config, dailyRates: rates.map((item) => ({ ...item })) } }));
  }

  dailyRates(): Observable<DailyRate[]> {
    const vesselCode = this.vessel().id;
    return this.http.get<Result<DailyRate[]>>(`${SHIP_API}/Operations/DailyRates`, { params: new HttpParams().set('vesselCode', vesselCode) }).pipe(
      map((result) => (result.succeeded && result.data ? result.data : [])),
      catchError(() => of([])),
    );
  }

  saveFixedCost(cost: { code: string; label: string; amountPerDay: number; note: string }, silent = false): void {
    const current = this.data().config.fixedCosts ?? [];
    const next = current.some((item) => item.code === cost.code)
      ? current.map((item) => (item.code === cost.code ? { ...cost } : item))
      : [...current, { ...cost }];
    this.patch((d) => ({ ...d, config: { ...d.config, fixedCosts: next } }));
    this.send('put', 'Operations/FixedCosts', cost);
    if (!silent) this.notify('تم حفظ التكلفة الثابتة.');
  }

  saveDailyRate(rate: DailyRate, silent = false): void {
    const rates = this.data().config.dailyRates ?? [];
    const next = rates.some((item) => item.kind === rate.kind && item.motion === rate.motion)
      ? rates.map((item) => (item.kind === rate.kind && item.motion === rate.motion ? { ...rate } : item))
      : [...rates, { ...rate }];
    this.patch((d) => ({ ...d, config: { ...d.config, dailyRates: next } }));
    this.send('put', 'Operations/DailyRates', rate);
    if (!silent) this.notify('تم حفظ المعدل اليومي.');
  }

  deleteDailyRate(kind: string, motion: string): void {
    this.patch((d) => ({
      ...d,
      config: { ...d.config, dailyRates: (d.config.dailyRates ?? []).filter((item) => item.kind !== kind || item.motion !== motion) },
    }));
    this.send('delete', 'Operations/DailyRates', undefined, { kind, motion });
  }

  statusLog(): Observable<StatusLogEntry[]> {
    const vesselCode = this.vessel().id;
    return this.http.get<Result<StatusLogEntry[]>>(`${SHIP_API}/Operations/StatusLog`, { params: new HttpParams().set('vesselCode', vesselCode) }).pipe(
      map((result) => (result.succeeded && result.data ? result.data : [])),
      catchError(() => of([])),
    );
  }

  changeShipStatus(mode: 'sea' | 'port'): Observable<boolean> {
    const previous = this.data().config.mode;
    if (previous === mode) return of(true);
    this.patch((d) => ({ ...d, config: { ...d.config, mode } }));
    const params = new HttpParams().set('vesselCode', this.vessel().id).set('mode', mode);
    return this.http.put<Result<boolean>>(`${SHIP_API}/Operations/Status`, {}, { params }).pipe(
      map((result) => this.done(result, 'تم تسجيل حالة السفينة.')),
      catchError(() => {
        this.patch((d) => ({ ...d, config: { ...d.config, mode: previous } }));
        return this.failed();
      }),
    );
  }

  /* ───────────── طلبات الشراء ───────────── */

  private nextRequestNo(): string {
    const all = Object.values(this.state().data).flatMap((d) => d.requests);
    const max = all.reduce((m, r) => Math.max(m, Number(r.no.split('-').pop()) || 0), 0);
    return `PR-${new Date().getFullYear()}-${String(max + 1).padStart(3, '0')}`;
  }

  private root(categoryId: string): string {
    const cats = this.categories();
    let cur = cats.find((c) => c.id === categoryId);
    const guard = new Set<string>();
    while (cur?.parentId && !guard.has(cur.id)) {
      guard.add(cur.id);
      cur = cats.find((c) => c.id === cur!.parentId);
    }
    return cur?.id ?? categoryId;
  }

  createRequest(lines: NewRequestLine[], notes: string, priority: 'normal' | 'urgent', submit: boolean): string | null {
    const valid = lines.filter((l) => num(l.qty) > 0);
    if (!valid.length) return null;
    const id = uid('req');
    const no = this.nextRequestNo();
    const products = this.products();
    const reqLines: ReqLine[] = valid.map((l, i) => {
      const p = products.find((x) => x.id === l.productId)!;
      return {
        id: `${id}-L${i + 1}`,
        productId: p.id,
        name: p.name,
        unit: p.unit,
        categoryId: p.categoryId,
        groupId: this.root(p.categoryId),
        qty: num(l.qty),
        description: l.description.trim(),
        removed: false,
        received: null,
      };
    });
    const status: ReqStatus = submit ? 'submitted' : 'draft';
    const req: Requisition = {
      id,
      no,
      vesselId: this.vessel().id,
      voyageId: this.activeVoyage()?.id ?? null,
      createdAt: today(),
      createdBy: this.actor(),
      status,
      priority,
      notes: notes.trim(),
      lines: reqLines,
      sends: [],
      offers: [],
      approvals: [],
      events: [{ at: today(), by: this.actor(), text: submit ? 'تم إنشاء الطلب وإرساله للإدارة' : 'تم حفظ الطلب كمسودة' }],
    };
    this.patch((d) => ({ ...d, requests: [req, ...d.requests] }));
    this.send('put', 'Requests', { ...req, vesselId: this.vessel().id });
    this.notify(submit ? `تم إرسال الطلب ${no} للإدارة.` : `تم حفظ المسودة ${no}.`);
    return id;
  }

  private mutateRequest(id: string, fn: (r: Requisition) => Requisition, event?: string, path = 'Requests/Lines'): void {
    this.patch((d) => ({
      ...d,
      requests: d.requests.map((r) => {
        if (r.id !== id) return r;
        const next = fn(r);
        const ev: ReqEvent[] = event ? [...next.events, { at: today(), by: this.actor(), text: event }] : next.events;
        return { ...next, events: ev, status: this.derive({ ...next, events: ev }) };
      }),
    }));
    const request = this.requests().find((item) => item.id === id);
    if (request) {
      this.send('post', path, { ...request, vesselId: this.vessel().id });
    }
  }

  /** حالة الطلب بعد العمليات اللاحقة للإرسال. */
  private derive(r: Requisition): ReqStatus {
    if (r.status === 'cancelled' || r.status === 'draft' || r.status === 'submitted' || r.status === 'ready') {
      return r.status;
    }
    const groups = groupsOf(r);
    if (!groups.length) return 'cancelled';
    const allApproved = groups.every((g) => r.approvals.some((a) => a.groupId === g));
    if (allApproved) {
      const allReceived = groups.every((g) => activeLines(r, g).every((l) => l.received != null));
      return allReceived ? 'received' : 'approved';
    }
    if (r.offers.length) return 'offers';
    if (r.sends.length) return 'sent';
    return 'ready';
  }

  submitRequest(id: string): void {
    this.mutateRequest(id, (r) => ({ ...r, status: 'submitted' }), 'تم إرسال الطلب للإدارة', 'Requests/Submit');
    this.notify('تم إرسال الطلب للإدارة.');
  }

  cancelRequest(id: string): void {
    this.mutateRequest(id, (r) => ({ ...r, status: 'cancelled' }), 'تم إلغاء الطلب', 'Requests/Cancel');
    this.notify('تم إلغاء الطلب.', 'warn');
  }

  markReady(id: string): void {
    const request = this.requests().find((item) => item.id === id);
    if (!request?.ownerSign) {
      this.notify('ارفع نسخة الطلب الممضاة من صاحب المركب قبل الاعتماد.', 'warn');
      return;
    }
    this.mutateRequest(id, (r) => ({ ...r, status: r.sends.length || r.offers.length ? this.derive({ ...r, status: 'sent' }) : 'ready' }), 'اعتمدت الإدارة الطلب بعد رفع النسخة الممضاة — جاهز للإرسال للموردين', 'Requests/Ready');
    this.notify('الطلب جاهز للإرسال للموردين.');
  }

  async attachOwnerSign(id: string, file: File): Promise<boolean> {
    const max = 25 * 1024 * 1024;
    if (file.size > max) {
      this.notify('الملف أكبر من 25 ميجا.', 'bad');
      return false;
    }
    const okType = file.type === 'application/pdf' || file.type.startsWith('image/') || /\.(pdf|png|jpe?g|webp)$/i.test(file.name);
    if (!okType) {
      this.notify('الملف لازم يكون PDF أو صورة للنسخة الممضاة.', 'bad');
      return false;
    }
    try {
      await this.files.putLocal(`owner-sign:${id}`, file);
    } catch {
      this.notify('تعذّر حفظ النسخة الممضاة على الجهاز.', 'bad');
      return false;
    }
    const meta = { name: file.name, size: file.size, type: file.type || 'application/pdf', uploadedAt: today() };
    this.mutateRequest(id, (request) => ({ ...request, ownerSign: meta }), `رُفعت نسخة موقعة: ${file.name}`);
    this.notify('تم رفع النسخة الممضاة. تقدر تعتمد الطلب.');
    return true;
  }

  ownerSignFile(id: string): Promise<Blob | null> {
    return this.files.getLocal(`owner-sign:${id}`).catch(() => null);
  }

  returnToDraft(id: string): void {
    this.mutateRequest(id, (r) => ({ ...r, status: 'submitted' }), 'أُعيد الطلب لمراجعة الإدارة', 'Requests/Draft');
  }

  setLineQty(reqId: string, lineId: string, qty: number): void {
    this.mutateRequest(reqId, (r) => ({ ...r, lines: r.lines.map((l) => (l.id === lineId ? { ...l, qty: Math.max(0, num(qty)) } : l)) }));
  }

  setLineDescription(reqId: string, lineId: string, description: string): void {
    this.mutateRequest(reqId, (r) => ({ ...r, lines: r.lines.map((l) => (l.id === lineId ? { ...l, description } : l)) }));
  }

  removeLine(reqId: string, lineId: string, removed: boolean): void {
    this.mutateRequest(reqId, (r) => ({ ...r, lines: r.lines.map((l) => (l.id === lineId ? { ...l, removed } : l)) }), removed ? 'تم حذف بند من الطلب' : 'تمت استعادة بند');
  }

  addLine(reqId: string, productId: string, qty: number, description = ''): void {
    const p = this.products().find((x) => x.id === productId);
    if (!p || num(qty) <= 0) return;
    this.mutateRequest(
      reqId,
      (r) => ({
        ...r,
        lines: [
          ...r.lines,
          {
            id: `${r.id}-L${r.lines.length + 1}-${Math.random().toString(36).slice(2, 5)}`,
            productId: p.id,
            name: p.name,
            unit: p.unit,
            categoryId: p.categoryId,
            groupId: this.root(p.categoryId),
            qty: num(qty),
            description,
            removed: false,
            received: null,
          },
        ],
      }),
      `أضيف بند: ${p.name}`,
    );
  }

  recordSend(reqId: string, groupId: string, supplier: Supplier): void {
    this.mutateRequest(
      reqId,
      (r) => ({
        ...r,
        status: r.status === 'ready' || r.status === 'submitted' ? 'sent' : r.status,
        sends: [
          ...r.sends.filter((s) => !(s.groupId === groupId && s.supplierId === supplier.id)),
          { groupId, supplierId: supplier.id, supplierName: supplier.company, email: supplier.email, sentAt: today() },
        ],
      }),
      `تم إرسال طلب عرض سعر إلى ${supplier.company}`,
      'Requests/Send',
    );
  }

  saveOffer(reqId: string, offer: Offer): void {
    this.mutateRequest(
      reqId,
      (r) => {
        const exists = r.offers.some((o) => o.id === offer.id);
        return {
          ...r,
          status: r.status === 'ready' || r.status === 'submitted' || r.status === 'sent' ? 'sent' : r.status,
          offers: exists ? r.offers.map((o) => (o.id === offer.id ? offer : o)) : [...r.offers, offer],
        };
      },
      `سُجّل عرض من ${offer.supplierName}`,
      'Requests/Offer',
    );
    this.notify('تم تسجيل العرض.');
  }

  deleteOffer(reqId: string, offerId: string): void {
    this.mutateRequest(
      reqId,
      (r) => ({ ...r, offers: r.offers.filter((o) => o.id !== offerId), approvals: r.approvals.filter((a) => a.offerId !== offerId) }),
      'تم حذف عرض',
      'Requests/Offer',
    );
  }

  approveOffer(reqId: string, groupId: string, offerId: string, expectedDate: string): void {
    const approval: GroupApproval = { groupId, offerId, expectedDate, approvedAt: today(), approvedBy: this.actor() };
    this.mutateRequest(
      reqId,
      (r) => ({ ...r, status: r.status === 'ready' || r.status === 'submitted' ? 'sent' : r.status, approvals: [...r.approvals.filter((a) => a.groupId !== groupId), approval] }),
      `تمت الموافقة على عرض — توريد متوقع ${expectedDate}`,
      'Requests/Approve',
    );
    this.notify('تمت الموافقة على العرض. سيظهر للسفينة موعد التوريد.');
  }

  revokeApproval(reqId: string, groupId: string): void {
    this.mutateRequest(reqId, (r) => ({ ...r, approvals: r.approvals.filter((a) => a.groupId !== groupId) }), 'تم سحب الموافقة على عرض', 'Requests/Revoke');
  }

  receiveGroup(reqId: string, groupId: string, received: Record<string, number>, note: string): void {
    const req = this.requests().find((r) => r.id === reqId);
    if (!req) return;
    for (const line of activeLines(req, groupId)) {
      const qty = Math.max(0, num(received[line.id] ?? line.qty));
      if (qty > 0) {
        this.receiveItem(line.productId, qty, note || `استلام ${req.no}`, today(), reqId, true);
      }
    }
    this.mutateRequest(
      reqId,
      (r) => ({
        ...r,
        lines: r.lines.map((l) => (l.groupId === groupId && !l.removed ? { ...l, received: Math.max(0, num(received[l.id] ?? l.qty)) } : l)),
      }),
      'تأكيد استلام الأصناف وتحديث المخزن',
      'Requests/Receive',
    );
    this.notify('تم تأكيد الاستلام وتحديث المخزن.');
  }

  /* ───────────── الطاقم ───────────── */

  saveCrew(member: CrewMember): void {
    this.patch((d) => ({
      ...d,
      crew: d.crew.some((c) => c.id === member.id) ? d.crew.map((c) => (c.id === member.id ? member : c)) : [member, ...d.crew],
    }));
    this.send('put', 'Crew', member);
    this.notify('تم حفظ بيانات الفرد.');
  }

  private crewEvent(id: string, type: 'sign-on' | 'sign-off' | 'leave' | 'return', date: string, note: string, status: CrewMember['status']): void {
    this.patch((d) => ({
      ...d,
      crew: d.crew.map((c) => (c.id === id ? { ...c, status, events: [...c.events, { id: uid('ev'), date, type, note }] } : c)),
    }));
  }

  signOff(id: string, date: string, note: string): void {
    this.crewEvent(id, 'sign-off', date, note || 'نزول من السفينة', 'Former');
    this.send('post', 'Crew/SignOff', this.crew().find((member) => member.id === id));
    this.notify('تم تسجيل خروج الفرد من السفينة.');
  }

  signOn(id: string, date: string, note: string): void {
    this.crewEvent(id, 'sign-on', date, note || 'عودة للخدمة', 'OnBoard');
    this.send('post', 'Crew/SignOn', this.crew().find((member) => member.id === id));
    this.notify('تم تسجيل صعود الفرد للسفينة.');
  }

  startLeave(id: string, date: string, note: string): void {
    this.crewEvent(id, 'leave', date, note || 'إجازة', 'OnLeave');
    this.send('post', 'Crew/Leave', this.crew().find((member) => member.id === id));
    this.notify('تم تسجيل الإجازة.');
  }

  endLeave(id: string, date: string, note: string): void {
    this.crewEvent(id, 'return', date, note || 'عودة من الإجازة', 'OnBoard');
    this.send('post', 'Crew/Return', this.crew().find((member) => member.id === id));
    this.notify('تم تسجيل العودة من الإجازة.');
  }

  deleteCrew(id: string): void {
    this.patch((d) => ({ ...d, crew: d.crew.filter((c) => c.id !== id) }));
    this.send('delete', `Crew/${id}`);
    this.notify('تم حذف السجل.', 'warn');
  }

  addCrewCert(memberId: string, cert: Omit<CrewCert, 'id'>): void {
    this.patch((d) => ({
      ...d,
      crew: d.crew.map((c) => (c.id === memberId ? { ...c, certs: [...c.certs, { ...cert, id: uid('cc') }] } : c)),
    }));
    const member = this.crew().find((item) => item.id === memberId);
    if (member) this.send('post', 'Crew/Certificates', member);
  }

  removeCrewCert(memberId: string, certId: string): void {
    this.patch((d) => ({ ...d, crew: d.crew.map((c) => (c.id === memberId ? { ...c, certs: c.certs.filter((x) => x.id !== certId) } : c)) }));
    const member = this.crew().find((item) => item.id === memberId);
    if (member) this.send('post', 'Crew/Certificates', member);
  }

  /* ───────────── الرحلات ───────────── */

  nextVoyageId(): number {
    return Math.max(0, ...Object.values(this.state().data).flatMap((d) => d.voyages.map((v) => v.id))) + 1;
  }

  saveVoyage(voyage: Voyage): void {
    this.patch((d) => ({
      ...d,
      voyages: d.voyages.some((v) => v.id === voyage.id) ? d.voyages.map((v) => (v.id === voyage.id ? voyage : v)) : [voyage, ...d.voyages],
    }));
    this.send('put', 'Voyages', voyage);
    this.notify('تم حفظ الرحلة ومسارها.');
  }

  saveConsumption(voyageId: number, kind: ConsumptionKind, quantity: number): void {
    this.patch((d) => ({
      ...d,
      voyages: d.voyages.map((voyage) => (voyage.id === voyageId ? this.withConsumption(voyage, kind, quantity) : voyage)),
    }));
    this.send('put', 'Voyages/Consumption', { voyageId, kind, quantity: num(quantity) });
  }

  deleteConsumption(voyageId: number, kind: ConsumptionKind): void {
    this.patch((d) => ({
      ...d,
      voyages: d.voyages.map((voyage) => (voyage.id === voyageId ? this.withConsumption(voyage, kind, 0) : voyage)),
    }));
    this.send('delete', `Voyages/${voyageId}/Consumption/${kind}`);
  }

  private withConsumption(voyage: Voyage, kind: ConsumptionKind, quantity: number) {
    const amount = num(quantity);
    const rows = (voyage.consumptions ?? []).filter((row) => row.kind !== kind);
    const consumptions = amount > 0 ? [...rows, { kind, quantity: amount }] : rows;
    const qty = (name: ConsumptionKind) => num(consumptions.find((row) => row.kind === name)?.quantity);
    return {
      ...voyage,
      consumptions,
      expectedHfo: qty('HeavyFuel'),
      expectedMgo: qty('Diesel'),
      expectedLube: qty('Lubricant'),
      expectedWater: qty('Water'),
    };
  }

  deleteVoyage(id: number): void {
    this.patch((d) => ({ ...d, voyages: d.voyages.filter((v) => v.id !== id) }));
    this.send('delete', `Voyages/${id}`);
    this.notify('تم حذف الرحلة.', 'warn');
  }

  setVoyageStatus(id: number, status: Voyage['status']): void {
    this.patch((d) => ({
      ...d,
      voyages: d.voyages.map((v) => {
        if (v.id === id) {
          return { ...v, status, endDate: status === 'completed' ? today() : v.endDate };
        }
        return status === 'active' && v.status === 'active' ? { ...v, status: 'completed', endDate: v.endDate || today() } : v;
      }),
    }));
    const voyage = this.voyages().find((item) => item.id === id);
    if (voyage) this.send('post', 'Voyages/Status', voyage);
    this.notify(status === 'active' ? 'بدأت الرحلة — ستُسجل المشتريات والتزويد عليها.' : 'تم تحديث حالة الرحلة.');
  }

  addExpense(expense: Omit<Expense, 'id'>): void {
    this.patch((d) => ({ ...d, expenses: [{ ...expense, id: uid('ex') }, ...d.expenses] }));
    this.send('put', 'Expenses', this.data().expenses[0]);
    this.notify('تم تسجيل المصروف.');
  }

  deleteExpense(id: string): void {
    this.patch((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) }));
    this.send('delete', `Expenses/${id}`);
  }

  /* ───────────── الشهادات والعملاء والشحنات ───────────── */

  saveCertificate(cert: Certificate): void {
    this.patch((d) => ({
      ...d,
      certificates: d.certificates.some((c) => c.id === cert.id) ? d.certificates.map((c) => (c.id === cert.id ? cert : c)) : [...d.certificates, cert],
    }));
    this.send('put', 'Certificates', cert);
    this.notify('تم حفظ الشهادة.');
  }

  /** حذف نوع الشهادة نفسه من السجل (والملف المرفوع عليه). */
  deleteCertificate(id: string): void {
    this.patch((d) => ({ ...d, certificates: d.certificates.filter((c) => c.id !== id) }));
    void this.files.delete(id).catch(() => undefined);
    this.send('delete', `Certificates/${id}`);
    this.notify('تم حذف نوع الشهادة من السجل.', 'warn');
  }

  /** رفع ملف الشهادة (PDF أو صورة) وربطه بالسطر. */
  async attachCertFile(certId: string, file: File): Promise<boolean> {
    const MAX = 25 * 1024 * 1024;
    if (file.size > MAX) {
      this.notify('الملف أكبر من 25 ميجا.', 'bad');
      return false;
    }
    const okType = file.type === 'application/pdf' || file.type.startsWith('image/') || /\.(pdf|png|jpe?g|webp)$/i.test(file.name);
    if (!okType) {
      this.notify('الملف لازم يكون PDF أو صورة.', 'bad');
      return false;
    }
    try {
      await this.files.put(certId, file);
    } catch (e) {
      this.notify(e instanceof Error ? e.message : 'تعذّر حفظ الملف.', 'bad');
      return false;
    }
    const meta = { name: file.name, size: file.size, type: file.type || 'application/octet-stream', uploadedAt: today() };
    this.patch((d) => ({ ...d, certificates: d.certificates.map((c) => (c.id === certId ? { ...c, file: meta } : c)) }));
    this.notify('تم رفع الملف.');
    return true;
  }

  async removeCertFile(certId: string): Promise<void> {
    try {
      await this.files.delete(certId);
    } catch {
      /* نكمل ونشيل البيانات حتى لو المخزن مش متاح */
    }
    this.patch((d) => ({ ...d, certificates: d.certificates.map((c) => (c.id === certId ? { ...c, file: null } : c)) }));
    this.notify('تم حذف الملف.', 'warn');
  }

  /** بيرجّع الملف المخزن (أو null لو مش موجود على الجهاز ده). */
  getCertFile(certId: string): Promise<Blob | null> {
    return this.files.get(certId).catch(() => null);
  }

  saveClient(client: CargoClient): void {
    this.patch((d) => {
      const exists = d.clients.some((c) => c.id === client.id);
      const id = exists ? client.id : Math.max(0, ...d.clients.map((c) => c.id)) + 1;
      const saved = { ...client, id };
      return { ...d, clients: exists ? d.clients.map((c) => (c.id === id ? saved : c)) : [...d.clients, saved] };
    });
    const saved = this.data().clients.at(-1) ?? client;
    this.send('put', 'Cargo/Clients', this.data().clients.find((item) => item.company === client.company) ?? saved);
    this.notify('تم حفظ العميل.');
  }

  saveShipment(shipment: Shipment): void {
    this.patch((d) => {
      const exists = d.shipments.some((s) => s.id === shipment.id);
      const id = exists ? shipment.id : Math.max(0, ...d.shipments.map((s) => s.id)) + 1;
      const saved = { ...shipment, id };
      const shipments = exists ? d.shipments.map((s) => (s.id === id ? saved : s)) : [saved, ...d.shipments];
      return { ...d, shipments, holds: this.recalcHolds(d, shipments) };
    });
    this.send('put', 'Cargo/Shipments', this.data().shipments[0]);
    for (const hold of this.data().holds) this.send('put', 'Holds', hold);
    this.notify('تم حفظ الشحنة وتحديث تحميل العنابر.');
  }

  deleteShipment(id: number): void {
    this.patch((d) => {
      const shipments = d.shipments.filter((s) => s.id !== id);
      return { ...d, shipments, holds: this.recalcHolds(d, shipments) };
    });
    this.send('delete', `Cargo/Shipments/${id}`);
    for (const hold of this.data().holds) this.send('put', 'Holds', hold);
    this.notify('تم حذف الشحنة.', 'warn');
  }

  private recalcHolds(d: VesselData, shipments: Shipment[]): VesselData['holds'] {
    const active = d.voyages.find((v) => v.status === 'active')?.id;
    const loading = shipments.filter((s) => s.voyageId === active && !s.status.includes('التفريغ'));
    const loaded: Record<string, number> = {};
    for (const s of loading) {
      if (s.hold === 'العنبران') {
        d.holds.forEach((h) => (loaded[h.id] = (loaded[h.id] ?? 0) + s.tons / d.holds.length));
      } else {
        const hold = d.holds.find((h) => h.name === s.hold) ?? d.holds[0];
        if (hold) loaded[hold.id] = (loaded[hold.id] ?? 0) + s.tons;
      }
    }
    return d.holds.map((h) => ({ ...h, loaded: Math.round(loaded[h.id] ?? 0) }));
  }

  setHoldLoad(holdId: string, loaded: number): void {
    this.patch((d) => ({ ...d, holds: d.holds.map((h) => (h.id === holdId ? { ...h, loaded: Math.max(0, Math.min(h.capacity, num(loaded))) } : h)) }));
    const hold = this.data().holds.find((item) => item.id === holdId);
    if (hold) this.send('put', 'Holds', hold);
    this.notify('تم تحديث تحميل العنبر.');
  }

  /* ───────────── المستخدمون ───────────── */

  saveUser(user: ShipUser): void {
    this.patchRoot((s) => ({
      ...s,
      users: s.users.some((u) => u.id === user.id) ? s.users.map((u) => (u.id === user.id ? user : u)) : [...s.users, user],
    }));
    this.send('put', 'Fleet/Users', user);
    this.notify('تم حفظ المستخدم.');
  }

  deleteUser(id: string): void {
    this.patchRoot((s) => ({ ...s, users: s.users.filter((u) => u.id !== id) }));
    this.send('delete', `Fleet/Users/${id}`);
  }

  addDays = addDays;
}
