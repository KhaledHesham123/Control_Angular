import { Component, computed, effect, inject, untracked } from '@angular/core';
import { kindGauge, today } from '../core/ship-calc';
import { dateLabel, fmt } from '../core/ship-format';
import { DailyInput, ShipStore } from '../core/ship-store';
import { TANK_KIND_LABEL, TankKind } from '../core/ship.types';

@Component({
  selector: 'sh-daily',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>التقرير اليومي</h1>
          <p>سجّل ساعات التشغيل ليوم واحد، والنظام يحسب استهلاك الوقود والزيت والمياه ويخصمها من الخزانات تلقائياً ويضيفها لسجل الحركة.</p>
        </div>
      </div>

      @if (!s.can('daily')) {
        <div class="readonly-note"><sc-icon name="lock" /> تسجيل التقرير اليومي متاح للقبطان وكبير المهندسين والإدارة.</div>
      }

      <div class="grid g-main" style="align-items:start">
        <section class="card">
          <div class="card-head"><h2>بيانات اليوم</h2></div>
          <div class="card-body stack">
            <div class="form-grid">
              <label class="field"><span>التاريخ</span><input type="date" [(ngModel)]="form.date" [max]="todayIso" /></label>
              <label class="field">
                <span>وضع السفينة</span>
                <select [(ngModel)]="form.mode" (ngModelChange)="onMode()">
                  <option value="sea">في البحر (إبحار)</option>
                  <option value="port">في الميناء / مناورة</option>
                </select>
              </label>
              <label class="field wide"><span>الموقع / الميناء</span><input type="text" [(ngModel)]="form.location" /></label>
              <label class="field">
                <span>{{ form.mode === 'sea' ? 'ساعات تشغيل المحرك الرئيسي (HFO)' : 'ساعات مناورة المحرك (MGO)' }}</span>
                <input type="number" min="0" max="24" step="0.5" [(ngModel)]="form.hoursMain" />
              </label>
              <label class="field"><span>ساعات تشغيل الغلاية</span><input type="number" min="0" max="24" step="0.5" [(ngModel)]="form.hoursBoiler" /></label>
              @for (g of s.data().config.generators; track g.id; let i = $index) {
                <label class="field"><span>ساعات {{ g.name }}</span><input type="number" min="0" max="24" step="0.5" [(ngModel)]="form.genHours[i]" /></label>
              }
            </div>

            @if (exists()) {
              <div class="alert warn"><sc-icon name="alert" /> يوجد تقرير مسجل بالفعل لهذا التاريخ. غيّر التاريخ.</div>
            }
            @if (shortage().length) {
              <div class="alert bad"><sc-icon name="alert" /> الرصيد لا يكفي في: {{ shortage().join('، ') }} — سيُخصم المتاح فقط.</div>
            }

            <div class="actions">
              <button type="button" class="btn btn-primary" [disabled]="!s.can('daily') || exists()" (click)="save()"><sc-icon name="check" /> حفظ التقرير وخصم الاستهلاك</button>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>الاستهلاك المحسوب</h2></div>
          <div class="card-body stack">
            @for (r of preview(); track r.kind) {
              <div class="gauge-row">
                <div class="top"><span>{{ r.label }}</span><b class="num">{{ fmt(r.use, 2) }} طن</b></div>
                <div class="muted small">المتبقي بعد التقرير: <b class="num">{{ fmt(r.after, 1) }}</b> من {{ fmt(r.max, 0) }} طن</div>
                <div class="gauge" [class]="'gauge ' + r.tone"><i [style.width.%]="r.pct"></i></div>
              </div>
            }
            <div class="hint">الحسابات من «أرقام التشغيل» (استهلاك المحرك والمولدات والغلاية ومعدل المياه للفرد). عدّلها من صفحة الإعدادات لو الأرقام الفعلية مختلفة.</div>
          </div>
        </section>
      </div>

      <section class="card">
        <div class="card-head"><h2>التقارير السابقة</h2></div>
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead><tr><th>التاريخ</th><th>الوضع</th><th>الموقع</th><th>HFO</th><th>MGO</th><th>زيوت</th><th>مياه</th><th>سجّله</th></tr></thead>
            <tbody>
              @for (l of history(); track l.id) {
                <tr>
                  <td>{{ dateLabel(l.date) }}</td>
                  <td><span class="badge" [class]="'badge ' + (l.mode === 'sea' ? 'info' : 'muted')">{{ l.mode === 'sea' ? 'إبحار' : 'ميناء' }}</span></td>
                  <td>{{ l.location }}</td>
                  <td class="num">{{ fmt(l.hfo, 2) }}</td>
                  <td class="num">{{ fmt(l.mgo, 2) }}</td>
                  <td class="num">{{ fmt(l.lube, 3) }}</td>
                  <td class="num">{{ fmt(l.water, 2) }}</td>
                  <td>{{ l.by }}</td>
                </tr>
              }
            </tbody>
          </table>
          @if (!s.data().logs.length) {
            <div class="empty">لا توجد تقارير.</div>
          }
        </div>
      </section>
    </div>
  `,
})
export class ShDaily {
  readonly s = inject(ShipStore);
  readonly fmt = fmt;
  readonly dateLabel = dateLabel;
  readonly todayIso = today();
  readonly history = computed(() => [...this.s.data().logs].sort((a, b) => b.date.localeCompare(a.date)));

  form: DailyInput = this.fresh('sea');

  private fresh(mode: 'sea' | 'port'): DailyInput {
    const cfg = this.s.data().config;
    return {
      date: today(),
      location: this.s.vessel().location,
      mode,
      hoursMain: mode === 'sea' ? 24 : 4,
      hoursBoiler: mode === 'sea' ? 6 : 18,
      genHours: cfg.generators.map((g) => g.defaultHours),
    };
  }

  constructor() {
    effect(() => {
      const id = this.s.vessel().id;
      untracked(() => {
        void id;
        this.form = this.fresh(this.s.data().config.mode);
      });
    });
  }

  onMode(): void {
    const fresh = this.fresh(this.form.mode);
    this.form.hoursMain = fresh.hoursMain;
    this.form.hoursBoiler = fresh.hoursBoiler;
  }

  exists(): boolean {
    return this.s.data().logs.some((l) => l.date === this.form.date);
  }

  readonly kinds: TankKind[] = ['hfo', 'mgo', 'lube', 'water'];

  preview() {
    const use = this.s.calcDaily(this.form);
    return this.kinds.map((kind) => {
      const g = kindGauge(this.s.tanks(), kind);
      const u = use[kind];
      const after = Math.max(0, g.current - u);
      const pct = g.max > 0 ? (after / g.max) * 100 : 0;
      return { kind, label: TANK_KIND_LABEL[kind], use: u, after, max: g.max, pct, tone: pct >= 45 ? 'ok' : pct >= 22 ? 'warn' : 'bad', short: g.current < u };
    });
  }

  shortage(): string[] {
    return this.preview().filter((r) => r.short).map((r) => r.label);
  }

  save(): void {
    const err = this.s.submitDaily(this.form);
    if (err) {
      this.s.notify(err, 'bad');
    } else {
      this.form = this.fresh(this.form.mode);
    }
  }
}
