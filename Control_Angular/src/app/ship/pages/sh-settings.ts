import { Component, effect, inject, untracked } from '@angular/core';
import { num, uid } from '../core/ship-calc';
import { usd } from '../core/ship-format';
import { ShipStore } from '../core/ship-store';
import { DailyKind, DailyMotion, DailyRate, FixedCost, ShipConfig, StatusLogEntry } from '../core/ship.types';

@Component({
  selector: 'sh-settings',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>أرقام التشغيل</h1>
          <p>المعدلات دي ثابتة للسفينة نفسها: كم بنزين وديزل وزيوت ومياه وهي ماشية، وكم وهي واقفة. استهلاك رحلة بعينها يتسجل داخل الرحلة.</p>
        </div>
        <button type="button" class="btn btn-primary" [disabled]="!s.can('fleet') && !s.can('daily')" (click)="save()"><sc-icon name="check" /> حفظ</button>
      </div>

      <section class="card">
        <div class="card-head"><h2>المحرك والغلاية والطاقم</h2></div>
        <div class="card-body form-grid">
          <div class="field wide">
            <span>حالة السفينة الحالية</span>
            <div class="row">
              <button type="button" class="btn btn-sm" [class.btn-primary]="c.mode === 'sea'" [disabled]="!canEdit()" (click)="setMotion('sea')">شغالة وبتمشي</button>
              <button type="button" class="btn btn-sm" [class.btn-primary]="c.mode === 'port'" [disabled]="!canEdit()" (click)="setMotion('port')">واقفة في مكانها</button>
            </div>
          </div>
          <label class="field">
            <span>مصدر الكهرباء</span>
            <select [(ngModel)]="c.power">
              <option value="aux_gen">مولدات الديزل</option>
              <option value="shaft_gen">مولد العمود</option>
              <option value="shore_power">كهرباء الرصيف</option>
            </select>
          </label>
          <label class="field"><span>استهلاك HFO في الإبحار (طن/يوم)</span><input type="number" min="0" step="any" [(ngModel)]="c.hfoTonsPerDaySea" /></label>
          <label class="field"><span>استهلاك MGO في الميناء (طن/يوم)</span><input type="number" min="0" step="any" [(ngModel)]="c.mgoTonsPerDayPort" /></label>
          <label class="field"><span>الغلاية (طن/ساعة)</span><input type="number" min="0" step="any" [(ngModel)]="c.boilerTonsPerHour" /></label>
          <label class="field"><span>زيت التزييت (طن/ساعة محرك)</span><input type="number" min="0" step="any" [(ngModel)]="c.lubeTonsPerHour" /></label>
          <label class="field"><span>طعام للفرد (كجم/يوم)</span><input type="number" min="0" step="any" [(ngModel)]="c.foodKgPerPersonDay" /></label>
          <label class="field"><span>مياه للفرد (لتر/يوم)</span><input type="number" min="0" step="any" [(ngModel)]="c.waterLitersPerPersonDay" /></label>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>استهلاك السفينة الثابت</h2><small>معدلات السفينة نفسها، والحساب مش مربوط برحلة واحدة</small></div>
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>النوع</th>
                <th>وهي ماشية</th>
                <th>وهي واقفة</th>
                <th>سعر الوحدة $</th>
                <th>تكلفة اليوم ماشية</th>
                <th>تكلفة اليوم واقفة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (kind of kinds; track kind.id) {
                <tr>
                  <td>{{ kind.label }} <span class="muted small">{{ kind.unit }}</span><div class="muted small">{{ rateNote(kind.id) }}</div></td>
                  <td><input type="number" min="0" step="any" [ngModel]="rateValue(kind.id, 'Sailing')" (ngModelChange)="editRate(kind.id, 'Sailing', $event)" /></td>
                  <td><input type="number" min="0" step="any" [ngModel]="rateValue(kind.id, 'Stopped')" (ngModelChange)="editRate(kind.id, 'Stopped', $event)" /></td>
                  <td><input type="number" min="0" step="any" [ngModel]="ratePrice(kind.id)" (ngModelChange)="editPrice(kind.id, $event)" /></td>
                  <td class="num">{{ usd(dayCost(kind.id, 'Sailing'), 2) }}</td>
                  <td class="num">{{ usd(dayCost(kind.id, 'Stopped'), 2) }}</td>
                  <td class="end"><button type="button" class="btn btn-sm btn-primary" [disabled]="!canEdit()" (click)="saveKind(kind.id)">حفظ</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>التكاليف الثابتة في اليوم</h2><small>تتحملها السفينة وهي ماشية أو واقفة</small></div>
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead><tr><th>البند</th><th>دولار / يوم</th><th>الأساس</th></tr></thead>
            <tbody>
              @for (row of fixedCosts; track row.code) {
                <tr>
                  <td>{{ row.label }}</td>
                  <td><input type="number" min="0" step="any" [(ngModel)]="row.amountPerDay" /></td>
                  <td class="small">{{ row.note }}</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr><td>طاقم + مطبخ</td><td class="num">{{ usd(fixedSum(['crew', 'kitchen']), 2) }}</td><td></td></tr>
              <tr><td>المخصصات</td><td class="num">{{ usd(fixedSum(['maintenance', 'insurance', 'certificates', 'management']), 2) }}</td><td></td></tr>
              <tr><td>الإجمالي الثابت</td><td class="num">{{ usd(fixedSum(), 2) }}</td><td></td></tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>السفينة بتكلف كام في اليوم</h2></div>
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead><tr><th>الحالة</th><th>محروقات وزيوت ومياه</th><th>طاقم وإعاشة</th><th>الصرف المباشر</th><th>مع المخصصات</th><th>في الساعة</th></tr></thead>
            <tbody>
              <tr>
                <td>وهي واقفة (0.30 طن ديزل)</td>
                <td class="num">{{ usd(fuelDay('Stopped'), 2) }}</td>
                <td class="num">{{ usd(fixedSum(['crew', 'kitchen']), 2) }}</td>
                <td class="num">{{ usd(fuelDay('Stopped') + fixedSum(['crew', 'kitchen']), 2) }}</td>
                <td class="num">{{ usd(fuelDay('Stopped') + fixedSum(), 2) }}</td>
                <td class="num">{{ usd((fuelDay('Stopped') + fixedSum(['crew', 'kitchen'])) / 24, 2) }} – {{ usd((fuelDay('Stopped') + fixedSum()) / 24, 2) }}</td>
              </tr>
              <tr>
                <td>وهي ماشية (6.025 طن ديزل)</td>
                <td class="num">{{ usd(fuelDay('Sailing'), 2) }}</td>
                <td class="num">{{ usd(fixedSum(['crew', 'kitchen']), 2) }}</td>
                <td class="num">{{ usd(fuelDay('Sailing') + fixedSum(['crew', 'kitchen']), 2) }}</td>
                <td class="num">{{ usd(fuelDay('Sailing') + fixedSum(), 2) }}</td>
                <td class="num">{{ usd((fuelDay('Sailing') + fixedSum(['crew', 'kitchen'])) / 24, 2) }} – {{ usd((fuelDay('Sailing') + fixedSum()) / 24, 2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>سجل تغيير الحالة</h2></div>
        <div class="card-body flush table-wrap">
          @if (!logs.length) {
            <div class="empty">لم تتغير حالة السفينة بعد.</div>
          } @else {
            <table class="tbl">
              <thead><tr><th>من</th><th>إلى</th><th>الشخص</th><th>الوقت</th></tr></thead>
              <tbody>
                @for (row of logs; track row.id) {
                  <tr>
                    <td>{{ motionLabel(row.fromMode) }}</td>
                    <td>{{ motionLabel(row.toMode) }}</td>
                    <td>{{ row.actorName || '—' }}</td>
                    <td>{{ when(row.createdAt) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>المولدات</h2>
          <button type="button" class="btn btn-sm" (click)="addGen()"><sc-icon name="plus" /> مولد</button>
        </div>
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead><tr><th>الاسم</th><th>استهلاك (طن/ساعة)</th><th>ساعات التشغيل الافتراضية/يوم</th><th></th></tr></thead>
            <tbody>
              @for (g of c.generators; track g.id; let i = $index) {
                <tr>
                  <td><input type="text" [(ngModel)]="g.name" /></td>
                  <td><input type="number" min="0" step="any" [(ngModel)]="g.tonsPerHour" /></td>
                  <td><input type="number" min="0" max="24" step="0.5" [(ngModel)]="g.defaultHours" /></td>
                  <td class="end"><button type="button" class="btn btn-sm btn-danger" (click)="c.generators.splice(i, 1)"><sc-icon name="trash" /></button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>البيانات</h2></div>
        <div class="card-body stack">
          <div class="alert"><sc-icon name="info" /> حالة السفينة ومعدلات المياه والبنزين والديزل تتحفظ على الخادم، وسجل التغيير يفضل موجود.</div>
          <div><button type="button" class="btn btn-danger" (click)="reset()"><sc-icon name="refresh" /> مسح بيانات اللوحة</button></div>
        </div>
      </section>
    </div>
  `,
})
export class ShSettings {
  readonly s = inject(ShipStore);
  c: ShipConfig = this.copy();
  rates: DailyRate[] = [];
  logs: StatusLogEntry[] = [];
  readonly usd = usd;
  fixedCosts: FixedCost[] = [];
  readonly kinds: { id: DailyKind; label: string; unit: string }[] = [
    { id: 'Diesel', label: 'ديزل MGO', unit: 'طن/يوم' },
    { id: 'Water', label: 'مياه عذبة', unit: 'طن/يوم' },
    { id: 'CylinderOil', label: 'زيت السلندرات', unit: 'لتر/يوم' },
    { id: 'EngineOil', label: 'زيت الماكينة', unit: 'لتر/يوم' },
    { id: 'HydraulicOil', label: 'زيت الهيدروليك', unit: 'لتر/يوم' },
  ];

  constructor() {
    effect(() => {
      const id = this.s.vessel().id;
      untracked(() => {
        this.c = this.copy();
        this.fixedCosts = (this.c.fixedCosts ?? []).map((row) => ({ ...row }));
        this.rates = this.c.dailyRates ?? [];
        this.load(id);
      });
    });
  }

  private load(id: string): void {
    this.s.dailyRates().subscribe((rows) => {
      if (this.s.vessel().id !== id) return;
      const local = this.s.data().config.dailyRates ?? [];
      const rates = this.mergeRates(local, rows);
      this.rates = rates;
      this.c = { ...this.c, dailyRates: rates };
      if (rows.length) this.s.applyDailyRates(rows);
    });
    this.s.statusLog().subscribe((rows) => {
      if (this.s.vessel().id === id) this.logs = rows;
    });
  }

  private copy(): ShipConfig {
    const cfg = this.s.data().config;
    return { ...cfg, generators: cfg.generators.map((g) => ({ ...g })) };
  }

  canEdit(): boolean {
    return this.s.can('fleet') || this.s.can('daily');
  }

  private mergeRates(local: DailyRate[], server: DailyRate[]): DailyRate[] {
    if (!server.length) return local;
    const merged = new Map(local.map((row) => [`${row.kind}|${row.motion}`, row]));
    for (const row of server) {
      const key = `${row.kind}|${row.motion}`;
      const prev = merged.get(key);
      if (prev && row.unitPrice == null && prev.unitPrice != null) continue;
      merged.set(key, {
        ...prev,
        ...row,
        unit: row.unit || prev?.unit,
        note: row.note || prev?.note,
        unitPrice: row.unitPrice ?? prev?.unitPrice,
        dailyCost: row.dailyCost ?? prev?.dailyCost,
      });
    }
    return [...merged.values()];
  }

  private rate(kind: DailyKind, motion: DailyMotion): DailyRate | undefined {
    return this.rates.find((item) => item.kind === kind && item.motion === motion);
  }

  rateValue(kind: DailyKind, motion: DailyMotion): number {
    return this.rate(kind, motion)?.tonsPerDay ?? 0;
  }

  ratePrice(kind: DailyKind): number {
    return this.rate(kind, 'Sailing')?.unitPrice ?? this.rate(kind, 'Stopped')?.unitPrice ?? 0;
  }

  rateNote(kind: DailyKind): string {
    return this.rate(kind, 'Sailing')?.note || this.rate(kind, 'Stopped')?.note || '';
  }

  dayCost(kind: DailyKind, motion: DailyMotion): number {
    const row = this.rate(kind, motion);
    if (!row) return 0;
    if (row.dailyCost != null) return row.dailyCost;
    return num(row.tonsPerDay) * num(row.unitPrice);
  }

  fuelDay(motion: DailyMotion): number {
    return this.kinds.reduce((sum, kind) => sum + this.dayCost(kind.id, motion), 0);
  }

  fixedSum(codes?: string[]): number {
    return this.fixedCosts.filter((row) => !codes || codes.includes(row.code)).reduce((sum, row) => sum + num(row.amountPerDay), 0);
  }

  editRate(kind: DailyKind, motion: DailyMotion, value: number): void {
    const tonsPerDay = num(value);
    const current = this.rates.find((item) => item.kind === kind && item.motion === motion);
    this.rates = current
      ? this.rates.map((item) => (item.kind === kind && item.motion === motion ? { ...item, tonsPerDay, dailyCost: undefined } : item))
      : [...this.rates, { kind, motion, tonsPerDay }];
  }

  editPrice(kind: DailyKind, value: number): void {
    const unitPrice = num(value);
    this.rates = this.rates.map((item) => (item.kind === kind ? { ...item, unitPrice, dailyCost: undefined } : item));
  }

  saveKind(kind: DailyKind): void {
    for (const motion of ['Sailing', 'Stopped'] as DailyMotion[]) {
      const row = this.rate(kind, motion) ?? { kind, motion, tonsPerDay: 0 };
      this.s.saveDailyRate({ ...row, tonsPerDay: num(row.tonsPerDay), unitPrice: num(row.unitPrice) }, motion === 'Sailing');
    }
  }

  setMotion(mode: 'sea' | 'port'): void {
    if (this.c.mode === mode) return;
    this.c = { ...this.c, mode };
    this.s.changeShipStatus(mode).subscribe((ok) => {
      if (ok) this.s.statusLog().subscribe((rows) => (this.logs = rows));
      else this.c = { ...this.c, mode: this.s.data().config.mode };
    });
  }

  motionLabel(mode: string): string {
    if (mode === 'sea' || mode === 'Sailing') return 'شغالة وبتمشي';
    if (mode === 'port' || mode === 'Stopped') return 'واقفة في مكانها';
    return 'بدون حالة';
  }

  when(value: string): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ar-EG');
  }

  addGen(): void {
    this.c.generators.push({ id: uid('gen'), name: `مولد ${this.c.generators.length + 1}`, tonsPerHour: 0.03, defaultHours: 12 });
  }

  save(): void {
    const c = this.c;
    this.s.saveConfig({
      ...c,
      hfoTonsPerDaySea: num(c.hfoTonsPerDaySea),
      mgoTonsPerDayPort: num(c.mgoTonsPerDayPort),
      boilerTonsPerHour: num(c.boilerTonsPerHour),
      lubeTonsPerHour: num(c.lubeTonsPerHour),
      foodKgPerPersonDay: num(c.foodKgPerPersonDay),
      waterLitersPerPersonDay: num(c.waterLitersPerPersonDay),
      generators: c.generators.map((g) => ({ ...g, tonsPerHour: num(g.tonsPerHour), defaultHours: num(g.defaultHours) })),
      dailyRates: this.rates.map((row) => ({ ...row })),
      fixedCosts: this.fixedCosts.map((row) => ({ ...row, amountPerDay: num(row.amountPerDay) })),
    });
    for (const row of this.fixedCosts) this.s.saveFixedCost({ ...row, amountPerDay: num(row.amountPerDay) }, true);
  }

  reset(): void {
    if (window.confirm('سيتم مسح بيانات اللوحة من الشاشة ومن قاعدة البيانات. متأكد؟')) {
      this.s.resetDemo();
      this.c = this.copy();
    }
  }
}
