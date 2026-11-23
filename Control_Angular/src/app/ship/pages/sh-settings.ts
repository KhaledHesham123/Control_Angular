import { Component, effect, inject, untracked } from '@angular/core';
import { num, uid } from '../core/ship-calc';
import { ShipStore } from '../core/ship-store';
import { ShipConfig } from '../core/ship.types';

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
          <label class="field">
            <span>وضع السفينة الحالي</span>
            <select [(ngModel)]="c.mode">
              <option value="sea">في البحر</option>
              <option value="port">في الميناء</option>
            </select>
          </label>
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
          <div class="alert"><sc-icon name="info" /> بيانات مساحة عمل السفن محفوظة محلياً على هذا المتصفح (بيانات تجريبية). لا تؤثر على بيانات المنتجات والـ RFQ على الخادم.</div>
          <div><button type="button" class="btn btn-danger" (click)="reset()"><sc-icon name="refresh" /> إعادة البيانات التجريبية</button></div>
        </div>
      </section>
    </div>
  `,
})
export class ShSettings {
  readonly s = inject(ShipStore);
  c: ShipConfig = this.copy();

  constructor() {
    effect(() => {
      void this.s.vessel().id;
      untracked(() => (this.c = this.copy()));
    });
  }

  private copy(): ShipConfig {
    const cfg = this.s.data().config;
    return { ...cfg, generators: cfg.generators.map((g) => ({ ...g })) };
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
