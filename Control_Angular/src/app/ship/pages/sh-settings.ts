import { Component, effect, inject, untracked } from '@angular/core';
import { num, uid } from '../core/ship-calc';
import { ShipStore } from '../core/ship-store';
import { DailyKind, DailyMotion, DailyRate, ShipConfig, StatusLogEntry } from '../core/ship.types';

@Component({
  selector: 'sh-settings',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>أرقام التشغيل</h1>
          <p>معدلات الاستهلاك اللي بيحسب بيها التقرير اليومي ومخطط الرحلات. عدّلها لتطابق السفينة الفعلية.</p>
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
        <div class="card-head"><h2>الاستهلاك اليومي الثابت</h2></div>
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead><tr><th>النوع</th><th>وهي ماشية (طن/يوم)</th><th>وهي واقفة (طن/يوم)</th><th></th></tr></thead>
            <tbody>
              @for (kind of kinds; track kind.id) {
                <tr>
                  <td>{{ kind.label }}</td>
                  <td><input type="number" min="0" step="any" [ngModel]="rateValue(kind.id, 'Sailing')" (ngModelChange)="editRate(kind.id, 'Sailing', $event)" /></td>
                  <td><input type="number" min="0" step="any" [ngModel]="rateValue(kind.id, 'Stopped')" (ngModelChange)="editRate(kind.id, 'Stopped', $event)" /></td>
                  <td class="end"><button type="button" class="btn btn-sm btn-primary" [disabled]="!canEdit()" (click)="saveKind(kind.id)">حفظ</button></td>
                </tr>
              }
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
          <div><button type="button" class="btn btn-danger" (click)="reset()"><sc-icon name="refresh" /> إعادة البيانات التجريبية</button></div>
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
  readonly kinds: { id: DailyKind; label: string }[] = [
    { id: 'Water', label: 'مياه' },
    { id: 'Gasoline', label: 'بنزين' },
    { id: 'Diesel', label: 'ديزل' },
  ];

  constructor() {
    effect(() => {
      const id = this.s.vessel().id;
      untracked(() => {
        this.c = this.copy();
        this.load(id);
      });
    });
  }

  private load(id: string): void {
    this.s.dailyRates().subscribe((rows) => {
      if (this.s.vessel().id !== id) return;
      this.rates = rows;
      this.c = { ...this.c, dailyRates: rows };
      this.s.applyDailyRates(rows);
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

  rateValue(kind: DailyKind, motion: DailyMotion): number {
    return this.rates.find((item) => item.kind === kind && item.motion === motion)?.tonsPerDay ?? 0;
  }

  editRate(kind: DailyKind, motion: DailyMotion, value: number): void {
    const tonsPerDay = num(value);
    const current = this.rates.find((item) => item.kind === kind && item.motion === motion);
    this.rates = current
      ? this.rates.map((item) => (item.kind === kind && item.motion === motion ? { ...item, tonsPerDay } : item))
      : [...this.rates, { kind, motion, tonsPerDay }];
  }

  saveKind(kind: DailyKind): void {
    for (const motion of ['Sailing', 'Stopped'] as DailyMotion[]) {
      this.s.saveDailyRate({ kind, motion, tonsPerDay: this.rateValue(kind, motion) }, motion === 'Sailing');
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
    });
  }

  reset(): void {
    if (window.confirm('سيتم حذف كل التعديلات المحلية والرجوع للبيانات التجريبية. متأكد؟')) {
      this.s.resetDemo();
      this.c = this.copy();
    }
  }
}
