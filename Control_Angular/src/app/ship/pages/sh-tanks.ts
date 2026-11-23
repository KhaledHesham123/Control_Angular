import { Component, computed, inject } from '@angular/core';
import { gaugeOf, kindGauge, num, round, today, voyageFuelOutlook } from '../core/ship-calc';
import { dateLabel, fmt, usd } from '../core/ship-format';
import { ShipStore } from '../core/ship-store';
import { Tank, TANK_KIND_LABEL, TANK_SINGLE_NAME, TankKind } from '../core/ship.types';

const KINDS: TankKind[] = ['hfo', 'mgo', 'lube', 'water'];

interface BunkerForm {
  tankId: string;
  qty: number;
  price: number;
  supplier: string;
  port: string;
  invoice: string;
  date: string;
}

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
              الإجمالي <b class="num">{{ fmt(k.g.current, 1) }}</b> من {{ fmt(k.g.max, 0) }} طن
              @if (k.outlook.lasts !== null) { · يكفي ~{{ fmt(k.outlook.lasts, 0) }} يوم }
            </span>
          </div>
          <div class="card-body">
            @if (k.tank; as t) {
              <div class="tank-card">
                <div class="between row">
                  <b>{{ t.name }}</b>
                  <span class="badge" [class]="'badge ' + gauge(t).tone">{{ fmt(gauge(t).percent, 0) }}%</span>
                </div>
                <div class="value"><span class="num">{{ fmt(t.current, 2) }}</span> <small class="muted">/ {{ fmt(t.max, 0) }} طن</small></div>
                <div class="gauge" [class]="'gauge ' + gauge(t).tone"><i [style.width.%]="gauge(t).percent"></i></div>
                @if (k.outlook.expected !== null) {
                  <p class="muted small">
                    الرحلة {{ s.activeVoyage()?.number }} تستهلك <b class="num">{{ fmt(k.outlook.expected, 1) }}</b> طن من أولها لآخرها
                    ({{ fmt(k.outlook.spanDays, 0) }} يوم) · المعدل <b class="num">{{ fmt(k.outlook.rate, 2) }}</b> طن/يوم
                    @if (k.outlook.lasts !== null) { · الكمية تكفي <b class="num">{{ fmt(k.outlook.lasts, 0) }}</b> يوم }
                  </p>
                }
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
            } @else {
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
        <div class="card-head"><h2>سجل التزويد</h2><span class="muted small">الإجمالي {{ usd(bunkerTotal()) }}</span></div>
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead><tr><th>التاريخ</th><th>الخزان</th><th>الكمية</th><th>السعر/طن</th><th>الإجمالي</th><th>المورد</th><th>الميناء</th><th>الفاتورة</th></tr></thead>
            <tbody>
              @for (b of s.data().bunkers; track b.id) {
                <tr>
                  <td>{{ dateLabel(b.date) }}</td>
                  <td>{{ tankName(b.tankId) }}</td>
                  <td class="num">{{ fmt(b.qty, 1) }} طن</td>
                  <td class="num">{{ usd(b.pricePerTon) }}</td>
                  <td class="num"><b>{{ usd(b.qty * b.pricePerTon) }}</b></td>
                  <td>{{ b.supplier }}</td>
                  <td>{{ b.port }}</td>
                  <td class="small">{{ b.invoice || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
          @if (!s.data().bunkers.length) {
            <div class="empty">لا توجد عمليات تزويد.</div>
          }
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
              <label class="field"><span>الكمية (طن)</span><input type="number" min="0" step="any" [(ngModel)]="bunker.qty" /></label>
              <label class="field"><span>سعر الطن (USD)</span><input type="number" min="0" step="any" [(ngModel)]="bunker.price" /></label>
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
              <label class="field"><span>التاريخ</span><input type="date" [(ngModel)]="bunker.date" /></label>
            </div>
            <div class="alert"><sc-icon name="info" /> {{ afterBunker() }}</div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="bunker = null">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="saveBunker()"><sc-icon name="check" /> حفظ وزيادة رصيد الخزان</button>
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
  readonly fmt = fmt;
  readonly usd = usd;
  readonly dateLabel = dateLabel;
  bunker: BunkerForm | null = null;
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
      const tank = this.s.tanks().find((item) => item.kind === kind) ?? null;
      return {
        kind,
        label: TANK_KIND_LABEL[kind],
        g,
        tank,
        outlook: voyageFuelOutlook(kind, g.current, voyage, config, crew),
      };
    });
  });

  readonly bunkerTotal = computed(() => this.s.data().bunkers.reduce((sum, b) => sum + b.qty * b.pricePerTon, 0));

  label(k: TankKind): string {
    return TANK_KIND_LABEL[k];
  }

  gauge(t: Tank) {
    return gaugeOf(t.current, t.max);
  }

  tankName(id: string): string {
    return this.s.tanks().find((t) => t.id === id)?.name ?? id;
  }

  openBunker(tankId?: string): void {
    const t = this.s.tanks().find((x) => x.id === tankId) ?? this.s.tanks().find((x) => x.kind === 'hfo') ?? this.s.tanks()[0];
    this.bunker = { tankId: t?.id ?? '', qty: 0, price: 0, supplier: '', port: '', invoice: '', date: today() };
    this.onTank();
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

  saveBunker(): void {
    const b = this.bunker;
    if (!b) return;
    const err = this.s.bunker(b.tankId, b.qty, b.price, b.supplier, b.port, b.invoice, b.date);
    if (err) this.s.notify(err, 'bad');
    else this.bunker = null;
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
