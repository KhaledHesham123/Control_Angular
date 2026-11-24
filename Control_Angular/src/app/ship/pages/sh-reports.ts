import { Component, computed, inject, signal } from '@angular/core';
import { groupsOf, purchaseValue, voyageCost, voyageRevenue } from '../core/ship-calc';
import { dateLabel, downloadCsv, fmt, usd } from '../core/ship-format';
import { ShipStore } from '../core/ship-store';
import { DailyLog, VOYAGE_STATUS_LABEL } from '../core/ship.types';

const COLORS = ['#167a82', '#d4a857', '#2b6cb0', '#6b4fb3', '#1b8a5a', '#c0392b', '#9aa7b0'];

@Component({
  selector: 'sh-reports',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>التكاليف والتقارير</h1>
          <p>تكلفة كل رحلة مقسمة على الأقسام الرئيسية (مطبخ، سطح، قطع غيار…) والوقود والموانئ والرواتب، مع الإيراد والصافي.</p>
        </div>
        <button type="button" class="btn" (click)="exportCsv()"><sc-icon name="down" /> تصدير CSV</button>
      </div>

      @if (!s.can('costs')) {
        <div class="readonly-note"><sc-icon name="lock" /> التكاليف المالية متاحة لمدير الشركة فقط.</div>
      } @else {
        <div class="kpis">
          <div class="kpi gold"><label>إجمالي تكلفة الرحلات</label><strong>{{ usd(totals().total) }}</strong></div>
          <div class="kpi ok"><label>إجمالي الإيراد</label><strong>{{ usd(totals().revenue) }}</strong></div>
          <div class="kpi" [class.bad]="totals().revenue - totals().total < 0" [class.ok]="totals().revenue - totals().total >= 0"><label>الصافي</label><strong>{{ usd(totals().revenue - totals().total) }}</strong></div>
          <div class="kpi"><label>متوسط تكلفة اليوم</label><strong>{{ usd(totals().days ? totals().total / totals().days : 0) }}</strong></div>
        </div>

        <section class="card">
          <div class="card-head"><h2>تكلفة الرحلات</h2></div>
          <div class="card-body flush table-wrap">
            <table class="tbl">
              <thead>
                <tr><th>الرحلة</th><th>الحالة</th><th>الأيام</th><th>مشتريات</th><th>وقود</th><th>موانئ</th><th>رواتب</th><th>أخرى</th><th>الإجمالي</th><th>الإيراد</th><th>الصافي</th></tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.v.id) {
                  <tr>
                    <td><b>{{ r.v.number }}</b><div class="muted small">{{ r.v.title }}</div></td>
                    <td><span class="badge" [class]="'badge ' + (r.v.status === 'active' ? 'ok' : r.v.status === 'planned' ? 'info' : 'muted')">{{ label(r.v.status) }}</span></td>
                    <td class="num">{{ r.c.days }}</td>
                    <td class="num">{{ usd(r.c.purchases) }}</td>
                    <td class="num">{{ usd(r.c.bunker) }}</td>
                    <td class="num">{{ usd(r.c.port) }}</td>
                    <td class="num">{{ usd(r.c.crew) }}</td>
                    <td class="num">{{ usd(r.c.other) }}</td>
                    <td class="num"><b>{{ usd(r.c.total) }}</b></td>
                    <td class="num">{{ usd(r.revenue) }}</td>
                    <td class="num"><b [style.color]="r.revenue - r.c.total < 0 ? '#c0392b' : '#1b8a5a'">{{ usd(r.revenue - r.c.total) }}</b></td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3">الإجمالي</td>
                  <td class="num">{{ usd(totals().purchases) }}</td>
                  <td class="num">{{ usd(totals().bunker) }}</td>
                  <td class="num">{{ usd(totals().port) }}</td>
                  <td class="num">{{ usd(totals().crew) }}</td>
                  <td class="num">{{ usd(totals().other) }}</td>
                  <td class="num">{{ usd(totals().total) }}</td>
                  <td class="num">{{ usd(totals().revenue) }}</td>
                  <td class="num">{{ usd(totals().revenue - totals().total) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <div class="grid g2" style="align-items:start">
          <section class="card">
            <div class="card-head"><h2>المشتريات حسب القسم الرئيسي</h2></div>
            <div class="card-body stack">
              @for (c of byCategory(); track c.id) {
                <div class="gauge-row">
                  <div class="top"><span>{{ c.name }}</span><b class="num">{{ usd(c.value) }}</b></div>
                  <div class="gauge"><i [style.width.%]="c.pct" [style.background]="c.color"></i></div>
                </div>
              }
              @if (!byCategory().length) { <div class="empty small">لا توجد مشتريات معتمدة.</div> }
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h2>الموردون حسب قيمة التعامل</h2></div>
            <div class="card-body flush table-wrap">
              <table class="tbl">
                <tbody>
                  @for (x of bySupplier(); track x.name) {
                    <tr><td>{{ x.name }}</td><td class="end num"><b>{{ usd(x.value) }}</b></td></tr>
                  }
                </tbody>
              </table>
              @if (!bySupplier().length) { <div class="empty small">لا توجد بيانات.</div> }
            </div>
          </section>
        </div>
      }

      <section class="card">
        <div class="card-head"><h2>استهلاك الوقود اليومي ({{ recent().length }} تقرير ظهيرة)</h2></div>
        <div class="card-body">
          @if (recent().length) {
            <p class="muted small">
              {{ fuelStats().sea }} إبحار · {{ fuelStats().anchor }} مخطاف
              · الفعلي {{ fmt(fuelStats().total, 2) }} طن
              · المتوسط {{ fmt(fuelStats().mean, 2) }}
              · الوسيط {{ fmt(fuelStats().median, 2) }}
              · الأدنى {{ fmt(fuelStats().min, 2) }}
              · الأقصى {{ fmt(fuelStats().max, 2) }}
              · آخر 7 تقارير {{ fmt(fuelStats().last7, 2) }} طن
              · آخر 10 تقارير {{ fmt(fuelStats().last10, 2) }} طن
            </p>
            <div style="display:flex;align-items:flex-end;gap:6px;height:180px;overflow-x:auto;margin-top:12px">
              @for (l of recent(); track l.id) {
                <div style="flex:1;min-width:28px;display:grid;gap:4px;justify-items:center" [title]="barTitle(l)">
                  <div style="display:flex;align-items:flex-end;gap:2px;height:130px">
                    @if (l.hfo > 0) {
                      <i style="display:block;width:10px;border-radius:4px 4px 0 0;background:#167a82" [style.height.px]="(l.hfo / maxFuel()) * 128"></i>
                    }
                    <i style="display:block;width:14px;border-radius:4px 4px 0 0" [style.height.px]="Math.max(2, (l.mgo / maxFuel()) * 128)" [style.background]="l.mode === 'sea' ? '#c0392b' : '#d4a857'"></i>
                  </div>
                  <small class="muted">{{ l.date.slice(5) }}</small>
                </div>
              }
            </div>
            <div class="legend" style="margin-top:8px"><span><b style="background:#c0392b"></b>إبحار</span><span><b style="background:#d4a857"></b>مخطاف</span><span>ديزل فعلي {{ fmt(sumFuel('mgo'), 2) }} طن</span></div>
          } @else {
            <div class="empty small">لا توجد تقارير يومية.</div>
          }
        </div>
      </section>
    </div>
  `,
})
export class ShReports {
  readonly s = inject(ShipStore);
  readonly Math = Math;
  readonly usd = usd;
  readonly fmt = fmt;
  readonly dateLabel = dateLabel;
  readonly filter = signal('all');

  readonly rows = computed(() =>
    this.s
      .voyages()
      .filter((v) => v.status !== 'planned' || this.filter() === 'all')
      .map((v) => ({ v, c: voyageCost(v, this.s.data(), this.s.categories()), revenue: voyageRevenue(v, this.s.data()) }))
      .sort((a, b) => b.v.startDate.localeCompare(a.v.startDate)),
  );

  readonly totals = computed(() => {
    const t = { purchases: 0, bunker: 0, port: 0, crew: 0, other: 0, total: 0, revenue: 0, days: 0 };
    for (const r of this.rows()) {
      t.purchases += r.c.purchases;
      t.bunker += r.c.bunker;
      t.port += r.c.port;
      t.crew += r.c.crew;
      t.other += r.c.other;
      t.total += r.c.total;
      t.revenue += r.revenue;
      t.days += r.c.days;
    }
    return t;
  });

  readonly byCategory = computed(() => {
    const sums: Record<string, number> = {};
    for (const r of this.rows()) {
      for (const [id, v] of Object.entries(r.c.purchasesByGroup)) sums[id] = (sums[id] ?? 0) + v;
    }
    const max = Math.max(1, ...Object.values(sums));
    return Object.entries(sums)
      .map(([id, value], i) => ({ id, value, name: this.s.categories().find((c) => c.id === id)?.name ?? id, pct: (value / max) * 100, color: COLORS[i % COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  });

  readonly bySupplier = computed(() => {
    const sums: Record<string, number> = {};
    for (const req of this.s.requests()) {
      if (req.status === 'cancelled') continue;
      for (const g of groupsOf(req)) {
        const a = req.approvals.find((x) => x.groupId === g);
        const offer = a ? req.offers.find((o) => o.id === a.offerId) : undefined;
        if (!offer) continue;
        const v = purchaseValue(req, g);
        sums[offer.supplierName] = (sums[offer.supplierName] ?? 0) + v.actual + v.committed;
      }
    }
    return Object.entries(sums)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  });

  readonly recent = computed(() => [...this.s.data().logs].sort((a, b) => a.date.localeCompare(b.date)));
  readonly maxFuel = computed(() => Math.max(1, ...this.recent().flatMap((l) => [l.hfo, l.mgo])));
  readonly fuelStats = computed(() => {
    const rows = this.recent();
    const used = rows.map((row) => row.mgo);
    const sorted = [...used].sort((a, b) => a - b);
    const total = used.reduce((sum, value) => sum + value, 0);
    const mid = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 0;
    const tail = (count: number) => used.slice(-count).reduce((sum, value) => sum + value, 0);
    return {
      sea: rows.filter((row) => row.mode === 'sea').length,
      anchor: rows.filter((row) => row.mode !== 'sea').length,
      total,
      mean: rows.length ? total / rows.length : 0,
      median: mid,
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      last7: tail(7),
      last10: tail(10),
    };
  });

  label(st: keyof typeof VOYAGE_STATUS_LABEL): string {
    return VOYAGE_STATUS_LABEL[st];
  }

  barTitle(log: DailyLog): string {
    const speed = log.speedKn == null ? '' : ` · ${log.speedKn} عقدة`;
    const rob = log.dieselRob == null ? '' : ` · رصيد ${log.dieselRob} طن`;
    return `${this.dateLabel(log.date)} — ${log.mode === 'sea' ? 'إبحار' : 'مخطاف'} ${log.mgo} طن${speed}${rob}${log.note ? ' · ' + log.note : ''}`;
  }

  sumFuel(k: 'hfo' | 'mgo'): number {
    return this.recent().reduce((a, l) => a + l[k], 0);
  }

  exportCsv(): void {
    downloadCsv('voyage-costs.csv', [
      ['الرحلة', 'العنوان', 'الأيام', 'مشتريات', 'وقود', 'موانئ', 'رواتب', 'أخرى', 'الإجمالي', 'الإيراد', 'الصافي'],
      ...this.rows().map((r) => [r.v.number, r.v.title, r.c.days, Math.round(r.c.purchases), Math.round(r.c.bunker), Math.round(r.c.port), Math.round(r.c.crew), Math.round(r.c.other), Math.round(r.c.total), Math.round(r.revenue), Math.round(r.revenue - r.c.total)]),
    ]);
  }
}
