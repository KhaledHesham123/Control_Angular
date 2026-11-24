import { Component, computed, inject } from '@angular/core';
import { bunkerTotal, bunkerUnitPrice, fuelStock, gaugeOf, kindGauge, num, round, today, voyageFuelOutlook } from '../core/ship-calc';
import { AMANY_VOYAGE_ID } from '../core/ship-amany-ops';
import { dateLabel, fmt, usd } from '../core/ship-format';
import { ShipFiles } from '../core/ship-files';
import { ShipStore } from '../core/ship-store';
import { BunkerRecord, Tank, TANK_KIND_LABEL, TANK_SINGLE_NAME, TankKind } from '../core/ship.types';

const KINDS: TankKind[] = ['hfo', 'mgo', 'lube', 'water'];

interface BunkerForm {
  tankId: string;
  qty: number;
  price: number;
  supplier: string;
  port: string;
  invoice: string;
  date: string;
  taxAmount: number;
  transportFee: number;
  fireFightingFee: number;
  bankFee: number;
  otherFee: number;
  dueDate: string;
  paymentStatus: string;
  paidBy: string;
  note: string;
}

const PAYMENT_STATES = ['مستحقة', 'مدفوعة', 'من ضمن حساب المركب', 'مؤجلة'];

@Component({
  selector: 'sh-tanks',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>الخزانات والوقود</h1>
          <p>خزان واحد لكل نوع. استهلاك الوقود والديزل والزيوت محسوب على الرحلة من أولها لآخرها، والكمية الحالية تتقاس على هذا المعدل.</p>
        </div>
        <div class="actions">
          @if (s.can('bunker')) {
            <button type="button" class="btn btn-primary" (click)="openBunker()"><sc-icon name="fuel" /> تسجيل تزويد (Bunkering)</button>
          }
        </div>
      </div>

      @for (k of kinds(); track k.kind) {
        <section class="card">
          <div class="card-head">
            <h2>{{ k.label }}</h2>
            <span class="muted small">
              @if (k.tanks.length) {
                {{ k.tanks.length }} خزان
                @if (k.outlook.lasts !== null) { · يكفي ~{{ fmt(k.outlook.lasts, 0) }} يوم }
              }
            </span>
          </div>
          <div class="card-body">
            @for (t of k.tanks; track t.id) {
              <div class="tank-card">
                <div class="between row">
                  <b>{{ t.name }}</b>
                  <span class="badge" [class]="'badge ' + gauge(t).tone">{{ fmt(gauge(t).percent, 0) }}%</span>
                </div>
                <div class="value"><span class="num">{{ fmt(t.current, 2) }}</span> <small class="muted">{{ t.unit || 'طن' }}</small></div>
                <div class="gauge" [class]="'gauge ' + gauge(t).tone"><i [style.width.%]="gauge(t).percent"></i></div>
                <dl class="kv" style="grid-template-columns: 140px 1fr">
                  @if (t.peak != null) {
                    <dt>أعلى رصيد</dt><dd class="num">{{ fmt(t.peak, 1) }} {{ t.unit || 'طن' }}</dd>
                  }
                  @for (b of bunkersOf(t.id); track b.id) {
                    <dt>التاريخ</dt><dd>{{ dateLabel(b.date) }}</dd>
                    <dt>الميناء</dt><dd>{{ b.port || '—' }}</dd>
                    <dt>المورد</dt><dd>{{ b.supplier || '—' }}</dd>
                    <dt>الكمية</dt><dd class="num">{{ fmt(b.qty, 1) }} {{ t.unit || 'طن' }}</dd>
                    <dt>الفاتورة</dt><dd class="num">{{ b.invoice || '—' }}</dd>
                    @if (b.sameDayUse != null) {
                      <dt>استهلاك يوم التموين</dt><dd class="num">{{ fmt(b.sameDayUse, 1) }} {{ t.unit || 'طن' }}</dd>
                    }
                  }
                  @if (k.voyage && k.outlook.expected !== null && (t.unit || 'طن') === 'طن') {
                    <dt>الرحلة</dt><dd>{{ k.voyage.number }}</dd>
                    <dt>الاستهلاك</dt><dd class="num">{{ fmt(k.outlook.expected, 1) }} طن</dd>
                    <dt>أيام الرحلة</dt><dd class="num">{{ fmt(k.outlook.spanDays, 0) }}</dd>
                    <dt>المعدل</dt><dd class="num">{{ fmt(k.outlook.rate, 2) }} طن/يوم</dd>
                    @if (k.outlook.lasts !== null) {
                      <dt>يكفي</dt><dd class="num">{{ fmt(k.outlook.lasts, 0) }} يوم</dd>
                    }
                  }
                </dl>
                <div class="row">
                  @if (s.can('bunker')) {
                    <button type="button" class="btn btn-sm btn-primary" (click)="openBunker(t.id)"><sc-icon name="plus" /> تزويد</button>
                  }
                  @if (s.can('bunker') || s.can('daily')) {
                    <button type="button" class="btn btn-sm" (click)="openSound(t)"><sc-icon name="edit" /> قياس فعلي</button>
                  }
                  @if (s.can('fleet')) {
                    <button type="button" class="btn btn-sm btn-ghost" (click)="openTank(t)" title="تعديل"><sc-icon name="cog" /></button>
                  }
                </div>
              </div>
            } @empty {
              <div class="empty">
                لا يوجد خزان لهذا النوع.
                @if (s.can('fleet')) {
                  <button type="button" class="btn btn-sm" (click)="createKind(k.kind)">إنشاء {{ label(k.kind) }}</button>
                }
              </div>
            }
          </div>
        </section>
      }

      <section class="card">
        <div class="card-head">
          <h2>أرصدة الرحلة</h2>
          @if (ledgerVoyage(); as voyage) {
            <span class="muted small">{{ voyage.number }} · من {{ dateLabel(voyage.startDate) }} إلى {{ dateLabel(voyage.endDate) }}</span>
          }
        </div>
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead>
              <tr><th>الصنف</th><th>الوحدة</th><th>استلام المركب</th><th>بداية الرحلة</th><th>المضاف</th><th>المستهلك</th><th>نهاية الرحلة</th></tr>
            </thead>
            <tbody>
              @for (t of ledger(); track t.id) {
                <tr>
                  <td>{{ t.name }}</td>
                  <td>{{ t.unit || 'طن' }}</td>
                  <td class="num">{{ fmt(t.bob ?? 0, 1) }}</td>
                  <td class="num">{{ fmt(t.opening ?? 0, 1) }}</td>
                  <td class="num">{{ fmt(t.added ?? 0, 1) }}</td>
                  <td class="num">{{ fmt(t.consumed ?? 0, 1) }}</td>
                  <td class="num"><b>{{ fmt(t.current, 1) }}</b></td>
                </tr>
              }
            </tbody>
          </table>
          @if (!ledger().length) { <div class="empty">لا توجد أرصدة مسجلة للرحلة.</div> }
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>فواتير التعبئة</h2>
          <span class="muted small">المدفوع {{ usd(paidTotal(), 2) }} · ده خروج نقدية مش مصروف على الرحلة</span>
        </div>
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>التاريخ</th><th>الخزان</th><th>الكمية</th><th>السعر الأساسي</th><th>الضرايب والرسوم</th>
                <th>إجمالي الفاتورة</th><th>سعر الوحدة النهائي</th><th>المورد</th><th>الفاتورة</th><th>الاستحقاق</th><th>السداد</th>
              </tr>
            </thead>
            <tbody>
              @for (b of s.data().bunkers; track b.id) {
                <tr>
                  <td>{{ dateLabel(b.date) }}</td>
                  <td>{{ tankName(b.tankId) }}</td>
                  <td class="num">{{ fmt(b.qty, 1) }} {{ b.unit || tankUnit(b.tankId) }}</td>
                  <td class="num">{{ usd(b.pricePerTon, 2) }}</td>
                  <td class="num">{{ usd(extras(b), 2) }}</td>
                  <td class="num"><b>{{ usd(total(b), 2) }}</b></td>
                  <td class="num"><b>{{ usd(unitPrice(b), 2) }}</b></td>
                  <td>{{ b.supplier }}</td>
                  <td class="small">{{ b.invoice || '—' }}</td>
                  <td class="small">{{ b.dueDate ? dateLabel(b.dueDate) : '—' }}</td>
                  <td class="small">{{ b.paymentStatus || '—' }}{{ b.paidBy ? ' — ' + b.paidBy : '' }}</td>
                </tr>
              }
            </tbody>
          </table>
          @if (!s.data().bunkers.length) {
            <div class="empty">لا توجد فواتير تعبئة.</div>
          }
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>قيمة المخزون في التانكات</h2>
          <span class="muted small">المتبقي أصل مش مصروف · القيمة {{ usd(stockValue(), 2) }}</span>
        </div>
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead>
              <tr><th>الصنف</th><th>المتبقي</th><th>المستهلك على الرحلة</th><th>المستلم</th><th>سعر آخر فاتورة</th><th>تكلفة الاستهلاك</th><th>قيمة المتبقي</th></tr>
            </thead>
            <tbody>
              @for (line of stock(); track line.tankId) {
                <tr>
                  <td>{{ line.label }}</td>
                  <td class="num">{{ fmt(line.rob ?? 0, 1) }} {{ line.unit }}</td>
                  <td class="num">{{ fmt(line.consumed, 1) }} {{ line.unit }}</td>
                  <td class="num">{{ fmt(line.received, 1) }} {{ line.unit }}</td>
                  <td class="num">{{ usd(line.unitPrice, 2) }}</td>
                  <td class="num"><b>{{ usd(line.cost, 2) }}</b></td>
                  <td class="num"><b>{{ usd(line.stockValue, 2) }}</b></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>

    @if (bunker) {
      <div class="modal-back" (click)="bunker = null">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head"><h3>تسجيل تزويد وقود / زيوت / مياه</h3><button type="button" class="btn btn-sm btn-ghost" (click)="bunker = null"><sc-icon name="x" /></button></div>
          <div class="modal-body">
            <div class="form-grid">
              <label class="field wide">
                <span>الخزان المستلم</span>
                <select [(ngModel)]="bunker.tankId" (ngModelChange)="onTank()">
                  @for (t of s.tanks(); track t.id) {
                    <option [value]="t.id">{{ t.name }} — فاضي {{ fmt(t.max - t.current, 1) }} طن</option>
                  }
                </select>
              </label>
              <label class="field"><span>الكمية ({{ tankUnit(bunker.tankId) }})</span><input type="number" min="0" step="any" [(ngModel)]="bunker.qty" /></label>
              <label class="field"><span>السعر الأساسي للوحدة (USD)</span><input type="number" min="0" step="any" [(ngModel)]="bunker.price" /></label>
              <label class="field"><span>الضريبة (USD)</span><input type="number" min="0" step="any" [(ngModel)]="bunker.taxAmount" /></label>
              <label class="field"><span>رسوم النقل</span><input type="number" min="0" step="any" [(ngModel)]="bunker.transportFee" /></label>
              <label class="field"><span>رسوم الإطفاء</span><input type="number" min="0" step="any" [(ngModel)]="bunker.fireFightingFee" /></label>
              <label class="field"><span>مصاريف البنك</span><input type="number" min="0" step="any" [(ngModel)]="bunker.bankFee" /></label>
              <label class="field"><span>رسوم أخرى</span><input type="number" min="0" step="any" [(ngModel)]="bunker.otherFee" /></label>
              <label class="field">
                <span>ميناء التزويد</span>
                <select [(ngModel)]="bunker.port" (ngModelChange)="onPort()">
                  <option value="">—</option>
                  @for (p of s.ports(); track p.id) {
                    <option [value]="p.name">{{ p.name }}</option>
                  }
                </select>
              </label>
              <label class="field">
                <span>المورد</span>
                <input type="text" list="bk-suppliers" [(ngModel)]="bunker.supplier" placeholder="اختر أو اكتب" />
                <datalist id="bk-suppliers">
                  @for (x of s.suppliers(); track x.id) {
                    <option [value]="x.company"></option>
                  }
                </datalist>
              </label>
              <label class="field"><span>رقم الفاتورة</span><input type="text" [(ngModel)]="bunker.invoice" /></label>
              <label class="field wide"><span>صورة الفاتورة</span><input type="file" accept="application/pdf,image/*" (change)="onInvoice($event)" /></label>
              <label class="field"><span>تاريخ التعبئة</span><input type="date" [(ngModel)]="bunker.date" /></label>
              <label class="field"><span>تاريخ الاستحقاق</span><input type="date" [(ngModel)]="bunker.dueDate" /></label>
              <label class="field">
                <span>حالة السداد</span>
                <select [(ngModel)]="bunker.paymentStatus">
                  <option value="">—</option>
                  @for (state of states; track state) {
                    <option [value]="state">{{ state }}</option>
                  }
                </select>
              </label>
              <label class="field"><span>اللي سدد</span><input type="text" [(ngModel)]="bunker.paidBy" /></label>
              <label class="field wide"><span>ملاحظة على الفاتورة</span><input type="text" [(ngModel)]="bunker.note" /></label>
            </div>
            <div class="alert"><sc-icon name="info" /> {{ afterBunker() }}</div>
            <div class="alert"><sc-icon name="info" /> {{ priceNote() }}</div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="bunker = null">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="saveBunker()"><sc-icon name="check" /> حفظ الفاتورة وزيادة رصيد الخزان</button>
          </div>
        </div>
      </div>
    }

    @if (sound) {
      <div class="modal-back" (click)="sound = null">
        <div class="modal narrow" (click)="$event.stopPropagation()">
          <div class="modal-head"><h3>قياس فعلي — {{ sound.name }}</h3></div>
          <div class="modal-body">
            <label class="field"><span>المستوى الفعلي (طن)</span><input type="number" min="0" step="any" [(ngModel)]="soundLevel" /></label>
            <label class="field"><span>ملاحظة</span><input type="text" [(ngModel)]="soundNote" placeholder="مثال: Sounding صباحي" /></label>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="sound = null">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="saveSound()">حفظ</button>
          </div>
        </div>
      </div>
    }

    @if (tankForm) {
      <div class="modal-back" (click)="tankForm = null">
        <div class="modal narrow" (click)="$event.stopPropagation()">
          <div class="modal-head"><h3>تعديل الخزان</h3></div>
          <div class="modal-body">
            <label class="field"><span>الاسم</span><input type="text" [(ngModel)]="tankForm.name" /></label>
            <label class="field"><span>النوع</span><input type="text" [value]="label(tankForm.kind)" disabled /></label>
            <label class="field"><span>السعة القصوى (طن)</span><input type="number" min="0" [(ngModel)]="tankForm.max" /></label>
            <label class="field"><span>المستوى الحالي (طن)</span><input type="number" min="0" [(ngModel)]="tankForm.current" /></label>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="tankForm = null">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="saveTank()">حفظ</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ShTanks {
  readonly s = inject(ShipStore);
  private readonly files = inject(ShipFiles);
  readonly fmt = fmt;
  readonly usd = usd;
  readonly dateLabel = dateLabel;
  readonly states = PAYMENT_STATES;
  bunker: BunkerForm | null = null;
  private invoiceFile: File | null = null;
  sound: Tank | null = null;
  soundLevel = 0;
  soundNote = '';
  tankForm: Tank | null = null;

  readonly kinds = computed(() => {
    const voyage = this.s.activeVoyage();
    const config = this.s.data().config;
    const crew = this.s.crewOnBoard().length;
    return KINDS.map((kind) => {
      const g = kindGauge(this.s.tanks(), kind);
      const tanks = this.s.tanks().filter((item) => item.kind === kind);
      return {
        kind,
        label: TANK_KIND_LABEL[kind],
        g,
        tanks,
        voyage,
        outlook: voyageFuelOutlook(kind, g.current, voyage, config, crew),
      };
    });
  });

  readonly paidTotal = computed(() => this.s.data().bunkers.reduce((sum, b) => sum + bunkerTotal(b), 0));
  readonly stock = computed(() => fuelStock(this.s.data(), this.s.activeVoyage()?.id ?? null));
  readonly stockValue = computed(() => this.stock().reduce((sum, line) => sum + line.stockValue, 0));
  readonly ledger = computed(() => this.s.tanks().filter((tank) => tank.opening != null));
  readonly ledgerVoyage = computed(() => this.s.voyages().find((voyage) => voyage.id === AMANY_VOYAGE_ID) ?? null);

  total(b: BunkerRecord): number {
    return bunkerTotal(b);
  }

  unitPrice(b: BunkerRecord): number {
    return bunkerUnitPrice(b);
  }

  extras(b: BunkerRecord): number {
    return bunkerTotal(b) - num(b.qty) * num(b.pricePerTon);
  }

  label(k: TankKind): string {
    return TANK_KIND_LABEL[k];
  }

  gauge(t: Tank) {
    return gaugeOf(t.current, t.peak ?? t.max);
  }

  bunkersOf(tankId: string): BunkerRecord[] {
    return this.s.data().bunkers.filter((record) => record.tankId === tankId);
  }

  tankUnit(id: string): string {
    return this.s.tanks().find((tank) => tank.id === id)?.unit || 'طن';
  }

  tankName(id: string): string {
    return this.s.tanks().find((t) => t.id === id)?.name ?? id;
  }

  openBunker(tankId?: string): void {
    const t = this.s.tanks().find((x) => x.id === tankId) ?? this.s.tanks().find((x) => x.kind === 'hfo') ?? this.s.tanks()[0];
    this.bunker = {
      tankId: t?.id ?? '',
      qty: 0,
      price: 0,
      supplier: '',
      port: '',
      invoice: '',
      date: today(),
      taxAmount: 0,
      transportFee: 0,
      fireFightingFee: 0,
      bankFee: 0,
      otherFee: 0,
      dueDate: '',
      paymentStatus: '',
      paidBy: '',
      note: '',
    };
    this.onTank();
    this.invoiceFile = null;
  }

  /** السعر اللي الاستهلاك هيتسعّر بيه بعد حفظ الفاتورة دي. */
  priceNote(): string {
    const b = this.bunker;
    if (!b || num(b.qty) <= 0) return 'أدخل الكمية عشان يتحسب سعر الوحدة النهائي.';
    const gross = num(b.qty) * num(b.price);
    const extras = num(b.taxAmount) + num(b.transportFee) + num(b.fireFightingFee) + num(b.bankFee) + num(b.otherFee);
    const final = (gross + extras) / num(b.qty);
    return `إجمالي الفاتورة ${usd(gross + extras, 2)} · سعر الوحدة النهائي ${usd(final, 2)}. ده السعر اللي استهلاك الأيام الجاية هيتحسب بيه.`;
  }

  onTank(): void {
    const b = this.bunker;
    const t = this.s.tanks().find((x) => x.id === b?.tankId);
    if (b && t && !b.qty) {
      b.qty = Math.max(0, round(Math.min(t.max - t.current, t.max * 0.5), 0));
    }
    this.onPort();
  }

  onPort(): void {
    const b = this.bunker;
    if (!b) return;
    const port = this.s.ports().find((p) => p.name === b.port);
    const kind = this.s.tanks().find((x) => x.id === b.tankId)?.kind;
    if (port && kind === 'hfo' && port.hfoPrice) b.price = port.hfoPrice;
    if (port && kind === 'mgo' && port.mgoPrice) b.price = port.mgoPrice;
  }

  afterBunker(): string {
    const b = this.bunker;
    const t = this.s.tanks().find((x) => x.id === b?.tankId);
    if (!b || !t) return '';
    const after = t.current + num(b.qty);
    return `الرصيد بعد التزويد: ${fmt(Math.min(after, t.max), 1)} من ${fmt(t.max, 0)} طن · التكلفة ${usd(num(b.qty) * num(b.price))}`;
  }

  onInvoice(ev: Event): void {
    this.invoiceFile = (ev.target as HTMLInputElement).files?.[0] ?? null;
  }

  async saveBunker(): Promise<void> {
    const b = this.bunker;
    if (!b) return;
    let invoiceFile = '';
    if (this.invoiceFile) {
      invoiceFile = `bunker-${Date.now().toString(36)}`;
      await this.files.put(invoiceFile, this.invoiceFile);
    }
    const err = this.s.bunker(b.tankId, b.qty, b.price, b.supplier, b.port, b.invoice, b.date, {
      taxAmount: num(b.taxAmount),
      transportFee: num(b.transportFee),
      fireFightingFee: num(b.fireFightingFee),
      bankFee: num(b.bankFee),
      otherFee: num(b.otherFee),
      dueDate: b.dueDate,
      paymentStatus: b.paymentStatus,
      paidBy: b.paidBy,
      note: b.note,
      invoiceFile,
    });
    if (err) this.s.notify(err, 'bad');
    else {
      this.bunker = null;
      this.invoiceFile = null;
    }
  }

  openSound(t: Tank): void {
    this.sound = t;
    this.soundLevel = t.current;
    this.soundNote = '';
  }

  saveSound(): void {
    if (!this.sound) return;
    const err = this.s.sounding(this.sound.id, this.soundLevel, this.soundNote);
    if (err) this.s.notify(err, 'bad');
    else this.sound = null;
  }

  openTank(t: Tank): void {
    this.tankForm = { ...t };
  }

  createKind(kind: TankKind): void {
    this.s.saveTank({
      id: kind,
      name: TANK_SINGLE_NAME[kind],
      kind,
      current: 0,
      max: kind === 'hfo' ? 1150 : kind === 'mgo' ? 360 : kind === 'lube' ? 95 : 420,
    });
  }

  saveTank(): void {
    const t = this.tankForm;
    if (!t || !t.name.trim()) {
      this.s.notify('اكتب اسم الخزان.', 'warn');
      return;
    }
    this.s.saveTank({ ...t, max: num(t.max), current: Math.min(num(t.current), num(t.max)) });
    this.tankForm = null;
  }
}
