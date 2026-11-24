import { Component, computed, effect, inject, untracked } from '@angular/core';
import { fuelLedger, num, today } from '../core/ship-calc';
import { dateLabel, fmt, usd } from '../core/ship-format';
import { ShipStore } from '../core/ship-store';
import { NoonReport } from '../core/ship.types';

const STATUSES = [
  { id: 'At sea', label: 'في البحر' },
  { id: 'Anchor', label: 'مخطاف' },
  { id: 'Loading', label: 'تحميل' },
  { id: 'Discharge', label: 'تفريغ' },
];

@Component({
  selector: 'sh-noon',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>تكلفة الرحلة</h1>
          <p>{{ s.vessel().name }} — تقرير الظهيرة اليومي، والتكلفة حسب البند وحالة السفينة. المبالغ بالدولار.</p>
        </div>
        <button type="button" class="btn btn-primary" [disabled]="!canEdit()" (click)="open()"><sc-icon name="plus" /> يوم جديد</button>
      </div>

      <div class="kpis">
        <div class="kpi gold"><label>إجمالي المصروف</label><strong>{{ usd(gross()) }}</strong></div>
        <div class="kpi"><label>أيام الرحلة</label><strong>{{ rows().length }}</strong></div>
        <div class="kpi"><label>متوسط الصرف اليومي</label><strong>{{ usd(rows().length ? gross() / rows().length : 0) }}</strong></div>
        <div class="kpi"><label>سعر طن الديزل</label><strong>{{ usd(dieselPrice(), 2) }}</strong></div>
      </div>
      <p class="muted small">الفترة {{ period() }} · الوجهة {{ routeName() }}</p>

      <section class="card">
        <div class="card-head"><h2>التكلفة حسب البند</h2></div>
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead><tr><th>البند</th><th>التكلفة</th><th>من الإجمالي</th><th>متوسط اليوم</th></tr></thead>
            <tbody>
              @for (row of categories(); track row.label) {
                <tr>
                  <td>{{ row.label }}</td>
                  <td class="num">{{ usd(row.amount, 2) }}</td>
                  <td class="num">{{ fmt(share(row.amount), 1) }}%</td>
                  <td class="num">{{ usd(perDay(row.amount), 2) }}</td>
                </tr>
              }
              <tr>
                <td><b>الإجمالي</b></td>
                <td class="num"><b>{{ usd(gross(), 2) }}</b></td>
                <td class="num">100%</td>
                <td class="num"><b>{{ usd(perDay(gross()), 2) }}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="grid g2">
        <section class="card">
          <div class="card-head"><h2>حسب مرحلة الرحلة</h2></div>
          <div class="card-body flush table-wrap">
            <table class="tbl">
              <thead><tr><th>المسار</th><th>الأيام</th><th>ديزل</th><th>مياه</th><th>المصروف</th><th>اليوم</th></tr></thead>
              <tbody>
                @for (row of legs(); track row.route) {
                  <tr>
                    <td>{{ row.route }}</td>
                    <td class="num">{{ row.days }}</td>
                    <td class="num">{{ usd(row.diesel, 0) }}</td>
                    <td class="num">{{ usd(row.water, 0) }}</td>
                    <td class="num">{{ usd(row.total, 0) }}</td>
                    <td class="num">{{ usd(row.days ? row.total / row.days : 0, 0) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
        <section class="card">
          <div class="card-head"><h2>حسب حالة السفينة</h2></div>
          <div class="card-body flush table-wrap">
            <table class="tbl">
              <thead><tr><th>الحالة</th><th>الأيام</th><th>المصروف</th><th>متوسط اليوم</th></tr></thead>
              <tbody>
                @for (row of byStatus(); track row.status) {
                  <tr>
                    <td>{{ statusLabel(row.status) }}</td>
                    <td class="num">{{ row.days }}</td>
                    <td class="num">{{ usd(row.total, 0) }}</td>
                    <td class="num">{{ usd(row.days ? row.total / row.days : 0, 0) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section class="card">
        <div class="card-head"><h2>الكميات</h2></div>
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead><tr><th>البند</th><th>الوحدة</th><th>رصيد الاستلام</th><th>البداية</th><th>الاستهلاك</th><th>التعبئة</th><th>النهاية</th><th>إبحار / يوم</th><th>وقوف / يوم</th></tr></thead>
            <tbody>
              @for (row of quantities(); track row.label) {
                <tr>
                  <td>{{ row.label }}</td>
                  <td>{{ row.unit }}</td>
                  <td class="num">{{ fmt(row.bob, 1) }}</td>
                  <td class="num">{{ fmt(row.opening, 1) }}</td>
                  <td class="num">{{ fmt(row.consumed, 1) }}</td>
                  <td class="num">{{ fmt(row.received, 1) }}</td>
                  <td class="num">{{ fmt(row.ending, 1) }}</td>
                  <td class="num">{{ fmt(row.sailing, 2) }}</td>
                  <td class="num">{{ fmt(row.stopped, 2) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>تكلفة الوقود يوم بيوم</h2>
          <span class="muted small">
            الاستهلاك من فرق الرصيد في تقرير الظهيرة × سعر آخر فاتورة · إجمالي {{ usd(fuelTotal(), 2) }}
          </span>
        </div>
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>اليوم</th><th>الحالة</th><th>البند</th>
                <th>الرصيد قبل اليوم</th><th>المتبقي (R.O.B)</th><th>المستهلك (CONS)</th><th>المستلم</th>
                <th>سعر الوحدة</th><th>تكلفة اليوم</th>
              </tr>
            </thead>
            <tbody>
              @for (day of fuelDays(); track day.report.id) {
                @for (line of day.lines; track line.tankId) {
                  @if (line.consumed > 0 || line.received > 0) {
                    <tr>
                      <td>{{ dateLabel(day.report.date) }}</td>
                      <td class="small">{{ statusLabel(day.report.status) }}</td>
                      <td>{{ line.label }}</td>
                      <td class="num">{{ line.opening === null ? '—' : fmt(line.opening, 2) }}</td>
                      <td class="num">{{ line.rob === null ? '—' : fmt(line.rob, 2) }}</td>
                      <td class="num">{{ fmt(line.consumed, 2) }} {{ line.unit }}</td>
                      <td class="num">{{ line.received ? fmt(line.received, 2) + ' ' + line.unit : '—' }}</td>
                      <td class="num">{{ usd(line.unitPrice, 2) }}</td>
                      <td class="num"><b>{{ line.cost ? usd(line.cost, 2) : 'تعبئة — مش مصروف' }}</b></td>
                    </tr>
                  }
                }
              }
            </tbody>
          </table>
          @if (!fuelDays().length) { <div class="empty">لا توجد تقارير ظهيرة.</div> }
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>تقارير الظهيرة</h2></div>
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead><tr><th>التاريخ</th><th>الحالة</th><th>الموقع</th><th>السرعة</th><th>ديزل</th><th>مياه</th><th>زيوت</th><th>رواتب</th><th>وكلاء</th><th></th></tr></thead>
            <tbody>
              @for (row of rows(); track row.id) {
                <tr>
                  <td>{{ dateLabel(row.date) }}</td>
                  <td>{{ statusLabel(row.status) }}</td>
                  <td>{{ row.position || '—' }}</td>
                  <td class="num">{{ row.avgSpeed == null ? '—' : fmt(row.avgSpeed, 2) }}</td>
                  <td class="num">{{ fmt(Math.abs(row.dieselQty), 2) }}</td>
                  <td class="num">{{ fmt(Math.abs(row.waterQty), 2) }}</td>
                  <td class="num">{{ usd(Math.abs(row.oilCost), 0) }}</td>
                  <td class="num">{{ usd(Math.abs(row.salaryCost), 0) }}</td>
                  <td class="num">{{ usd(Math.abs(row.agencyCost), 0) }}</td>
                  <td class="end">
                    <button type="button" class="btn btn-sm" [disabled]="!canEdit()" (click)="open(row)">تعديل</button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="10"><div class="empty">لا توجد تقارير ظهيرة.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>

    @if (form) {
      <div class="modal-back" (click)="form = null">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>{{ editing ? 'تعديل تقرير الظهيرة' : 'تقرير ظهيرة جديد' }}</h3>
            <button type="button" class="btn btn-sm btn-ghost" (click)="form = null"><sc-icon name="x" /></button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <label class="field"><span>التاريخ</span><input type="date" [(ngModel)]="form.date" /></label>
              <label class="field">
                <span>الحالة</span>
                <select [(ngModel)]="form.status">
                  @for (st of statuses; track st.id) { <option [value]="st.id">{{ st.label }}</option> }
                </select>
              </label>
              <label class="field"><span>الموقع</span><input type="text" [(ngModel)]="form.position" /></label>
              <label class="field"><span>المسار</span><input type="text" [(ngModel)]="form.route" /></label>
              <label class="field"><span>السرعة (عقدة)</span><input type="number" step="any" [(ngModel)]="form.avgSpeed" /></label>
              <label class="field"><span>المسافة المقطوعة (ميل)</span><input type="number" step="any" [(ngModel)]="form.distanceCovered" /></label>
              <label class="field"><span>المسافة المتبقية (ميل)</span><input type="number" step="any" [(ngModel)]="form.distanceToNext" /></label>
              <label class="field"><span>زمن الإبحار</span><input type="text" [(ngModel)]="form.passageTime" placeholder="14 H 30 M" /></label>
              <label class="field"><span>موعد الوصول</span><input type="text" [(ngModel)]="form.eta" /></label>
              <label class="field"><span>عدد اللفات</span><input type="number" step="any" [(ngModel)]="form.avgRpm" /></label>
              <label class="field"><span>الرياح</span><input type="text" [(ngModel)]="form.wind" /></label>
              <label class="field"><span>رصيد الديزل (R.O.B)</span><input type="number" step="any" [(ngModel)]="form.dieselRob" /></label>
              <label class="field"><span>رصيد المياه (R.O.B)</span><input type="number" step="any" [(ngModel)]="form.freshWaterRob" /></label>
              <label class="field"><span>رصيد زيت الماكينة</span><input type="number" step="any" [(ngModel)]="form.meLubeRob" /></label>
              <label class="field"><span>رصيد زيت السلندرات</span><input type="number" step="any" [(ngModel)]="form.cylLubeRob" /></label>
              <label class="field"><span>رصيد زيت الهيدروليك</span><input type="number" step="any" [(ngModel)]="form.hydOilRob" /></label>
              <label class="field"><span>رواتب اليوم</span><input type="number" step="any" [(ngModel)]="form.salaryCost" /></label>
              <label class="field"><span>المطبخ</span><input type="number" step="any" [(ngModel)]="form.kitchenCost" /></label>
              <label class="field"><span>وكلاء الموانئ</span><input type="number" step="any" [(ngModel)]="form.agencyCost" /></label>
            </div>
            <div class="alert"><sc-icon name="info" /> الاستهلاك = فرق الرصيد عن تقرير امبارح، والتكلفة = الاستهلاك × سعر آخر فاتورة. يوم جديد مش بيمسح الأيام القديمة.</div>
          </div>
          <div class="modal-foot">
            @if (editing) {
              <button type="button" class="btn btn-danger" (click)="remove()">حذف</button>
            }
            <button type="button" class="btn btn-primary" (click)="save()"><sc-icon name="check" /> حفظ</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ShNoon {
  readonly s = inject(ShipStore);
  readonly statuses = STATUSES;
  readonly Math = Math;
  readonly fmt = fmt;
  readonly usd = usd;
  readonly dateLabel = dateLabel;
  form: NoonReport | null = null;
  editing = false;

  readonly rows = computed(() => [...(this.s.data().noonReports ?? [])].sort((a, b) => a.date.localeCompare(b.date)));
  readonly fuelDays = computed(() => fuelLedger(this.s.data()));
  readonly fuelTotal = computed(() => this.fuelDays().reduce((sum, day) => sum + day.cost, 0));

  constructor() {
    effect(() => {
      const id = this.s.vessel().id;
      untracked(() => {
        this.s.noonReports().subscribe((rows) => {
          if (this.s.vessel().id === id && rows.length) this.s.applyNoonReports(rows);
        });
      });
    });
  }

  canEdit(): boolean {
    return this.s.can('voyages') || this.s.can('daily') || this.s.can('costs');
  }

  statusLabel(status: string): string {
    return STATUSES.find((item) => item.id === status)?.label ?? status;
  }

  period(): string {
    const rows = this.rows();
    if (!rows.length) return '—';
    return `${dateLabel(rows[0].date)} ← ${dateLabel(rows[rows.length - 1].date)}`;
  }

  routeName(): string {
    return this.rows().find((row) => row.route)?.route || '—';
  }

  categories() {
    const rows = this.rows();
    const fuel = (tankId: string) =>
      this.fuelDays().reduce((total, day) => total + (day.lines.find((line) => line.tankId === tankId)?.cost ?? 0), 0);
    const sum = (pick: (row: NoonReport) => number) => Math.abs(rows.reduce((total, row) => total + pick(row), 0));
    const lumps = ['exp-management', 'exp-dock', 'exp-maint']
      .map((id) => this.s.data().expenses.find((item) => item.id === id))
      .filter((item) => item && item.amount)
      .map((item) => ({ label: item!.label, amount: Math.abs(item!.amount) }));
    return [
      { label: 'ديزل', amount: fuel('mgo') },
      { label: 'مياه عذبة', amount: fuel('water') },
      { label: 'زيوت', amount: fuel('me') + fuel('cyl') + fuel('hyd') },
      { label: 'رواتب الطاقم', amount: sum((row) => row.salaryCost) },
      { label: 'المطبخ', amount: sum((row) => row.kitchenCost) },
      { label: 'وكلاء الموانئ', amount: sum((row) => row.agencyCost) },
      ...lumps,
    ];
  }

  gross(): number {
    return this.categories().reduce((total, row) => total + row.amount, 0);
  }

  share(amount: number): number {
    const total = this.gross();
    return total ? (amount / total) * 100 : 0;
  }

  perDay(amount: number): number {
    return this.rows().length ? amount / this.rows().length : 0;
  }

  dieselPrice(): number {
    const lines = this.fuelDays().flatMap((day) => day.lines).filter((line) => line.tankId === 'mgo');
    const qty = lines.reduce((total, line) => total + line.consumed, 0);
    const cost = lines.reduce((total, line) => total + line.cost, 0);
    return qty ? cost / qty : 0;
  }

  legs() {
    const map = new Map<string, { route: string; days: number; diesel: number; water: number; total: number }>();
    for (const day of this.fuelDays()) {
      const key = day.report.route || '—';
      const current = map.get(key) ?? { route: key, days: 0, diesel: 0, water: 0, total: 0 };
      current.days += 1;
      current.diesel += day.lines.find((line) => line.tankId === 'mgo')?.cost ?? 0;
      current.water += day.lines.find((line) => line.tankId === 'water')?.cost ?? 0;
      current.total += this.dayTotal(day.report);
      map.set(key, current);
    }
    return [...map.values()];
  }

  byStatus() {
    const map = new Map<string, { status: string; days: number; total: number }>();
    for (const day of this.fuelDays()) {
      const current = map.get(day.report.status) ?? { status: day.report.status, days: 0, total: 0 };
      current.days += 1;
      current.total += this.dayTotal(day.report);
      map.set(day.report.status, current);
    }
    return [...map.values()];
  }

  quantities() {
    const days = this.fuelDays();
    const line = (label: string, unit: string, tankId: string) => {
      const tank = this.s.tanks().find((item) => item.id === tankId);
      const picked = days.map((day) => ({ status: day.report.status, line: day.lines.find((item) => item.tankId === tankId) }));
      const consumed = picked.reduce((total, row) => total + (row.line?.consumed ?? 0), 0);
      const received = picked.reduce((total, row) => total + (row.line?.received ?? 0), 0);
      const average = (status: 'At sea' | 'stop') => {
        const used = picked.filter((row) => (status === 'At sea' ? row.status === 'At sea' : row.status !== 'At sea') && (row.line?.consumed ?? 0) > 0);
        return used.length ? used.reduce((total, row) => total + (row.line?.consumed ?? 0), 0) / used.length : null;
      };
      return {
        label,
        unit,
        bob: tank?.bob ?? null,
        opening: picked[0]?.line?.opening ?? tank?.opening ?? null,
        consumed,
        received,
        ending: picked[picked.length - 1]?.line?.rob ?? tank?.current ?? null,
        sailing: average('At sea'),
        stopped: average('stop'),
      };
    };
    return [
      line('مياه عذبة', 'طن', 'water'),
      line('ديزل', 'طن', 'mgo'),
      line('زيت الماكينة', 'لتر', 'me'),
      line('زيت السلندرات', 'لتر', 'cyl'),
      line('زيت الهيدروليك', 'لتر', 'hyd'),
    ];
  }

  open(row?: NoonReport): void {
    this.editing = !!row;
    const date = today();
    this.form = row
      ? { ...row }
      : {
          id: `noon-${date}`,
          date,
          localTime: '',
          position: '',
          status: 'At sea',
          route: this.routeName() === '—' ? '' : this.routeName(),
          avgSpeed: null,
          avgRpm: null,
          wind: '',
          seaSwell: '',
          distanceToNext: null,
          eta: '',
          distanceCovered: null,
          passageTime: '',
          portTime: '',
          freshWaterRob: null,
          dieselRob: null,
          meLubeRob: null,
          cylLubeRob: null,
          hydOilRob: null,
          waterQty: 0,
          waterCost: 0,
          dieselQty: 0,
          dieselCost: 0,
          meQty: 0,
          meCost: 0,
          cylQty: 0,
          cylCost: 0,
          hydQty: 0,
          hydCost: 0,
          oilCost: 0,
          salaryCost: 0,
          kitchenCost: 0,
          agencyCost: 0,
          voyageId: this.s.activeVoyage()?.id ?? this.rows()[0]?.voyageId ?? null,
        };
  }

  save(): void {
    const form = this.form;
    if (!form?.date) return;
    const saved: NoonReport = {
      ...form,
      id: form.id || `noon-${form.date}`,
      avgSpeed: form.avgSpeed == null ? null : num(form.avgSpeed),
      avgRpm: form.avgRpm == null ? null : num(form.avgRpm),
      waterQty: num(form.waterQty),
      waterCost: num(form.waterCost),
      dieselQty: num(form.dieselQty),
      dieselCost: num(form.dieselCost),
      oilCost: num(form.oilCost),
      salaryCost: num(form.salaryCost),
      kitchenCost: num(form.kitchenCost),
      agencyCost: num(form.agencyCost),
      freshWaterRob: form.freshWaterRob == null ? null : num(form.freshWaterRob),
      dieselRob: form.dieselRob == null ? null : num(form.dieselRob),
      meLubeRob: form.meLubeRob == null ? null : num(form.meLubeRob),
      cylLubeRob: form.cylLubeRob == null ? null : num(form.cylLubeRob),
      hydOilRob: form.hydOilRob == null ? null : num(form.hydOilRob),
      distanceCovered: form.distanceCovered == null ? null : num(form.distanceCovered),
      distanceToNext: form.distanceToNext == null ? null : num(form.distanceToNext),
    };
    this.s.saveNoonReport(saved);
    this.form = null;
  }

  remove(): void {
    if (!this.form) return;
    this.s.deleteNoonReport(this.form.id);
    this.form = null;
  }

  private dayTotal(row: NoonReport): number {
    const fuel = this.fuelDays().find((day) => day.report.id === row.id)?.cost ?? 0;
    return fuel + Math.abs(row.salaryCost) + Math.abs(row.kitchenCost) + Math.abs(row.agencyCost);
  }
}
