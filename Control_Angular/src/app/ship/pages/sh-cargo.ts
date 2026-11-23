import { Component, computed, inject } from '@angular/core';
import { gaugeOf, num } from '../core/ship-calc';
import { fmt } from '../core/ship-format';
import { ShipStore } from '../core/ship-store';

@Component({
  selector: 'sh-cargo',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>سعة العنابر</h1>
          <p>سعة كل عنبر والمحمّل فيه حالياً. التحميل بيتحدّث تلقائياً من شحنات الرحلة الجارية، ويمكنك التصحيح يدوياً.</p>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi"><label>السعة الكلية</label><strong>{{ fmt(totalCap(), 0) }} طن</strong></div>
        <div class="kpi ok"><label>المحمّل</label><strong>{{ fmt(totalLoaded(), 0) }} طن</strong></div>
        <div class="kpi gold"><label>المتاح</label><strong>{{ fmt(totalCap() - totalLoaded(), 0) }} طن</strong></div>
      </div>

      <div class="grid g2">
        @for (h of s.data().holds; track h.id) {
          <section class="card">
            <div class="card-head"><h2>{{ h.name }}</h2><span class="badge info">{{ fmt(g(h).percent, 0) }}%</span></div>
            <div class="card-body stack">
              <div class="value" style="font-size:1.4rem;font-weight:800"><span class="num">{{ fmt(h.loaded, 0) }}</span> <small class="muted">/ {{ fmt(h.capacity, 0) }} طن</small></div>
              <div class="gauge" [class]="'gauge ' + (g(h).percent > 90 ? 'bad' : 'ok')"><i [style.width.%]="g(h).percent"></i></div>
              <div class="muted small">المتاح {{ fmt(h.capacity - h.loaded, 0) }} طن</div>
              @if (s.can('voyages')) {
                <div class="row">
                  <input type="number" min="0" style="width:140px" [value]="h.loaded" #inp />
                  <button type="button" class="btn btn-sm" (click)="s.setHoldLoad(h.id, num(inp.value))">تحديث يدوي</button>
                </div>
              }
              <div>
                <b class="small">الشحنات في هذا العنبر</b>
                @for (x of shipmentsIn(h.name); track x.id) {
                  <div class="between row small" style="padding:4px 0;border-bottom:1px dashed var(--line)">
                    <span>{{ x.ref }} · {{ x.commodity }}</span><b class="num">{{ fmt(x.tons, 0) }} طن</b>
                  </div>
                }
                @if (!shipmentsIn(h.name).length) { <div class="muted small">لا شحنات.</div> }
              </div>
            </div>
          </section>
        }
      </div>
      @if (!s.data().holds.length) {
        <div class="card"><div class="empty">لا توجد عنابر لهذه السفينة.</div></div>
      }
    </div>
  `,
})
export class ShCargo {
  readonly s = inject(ShipStore);
  readonly fmt = fmt;
  readonly num = num;
  readonly totalCap = computed(() => this.s.data().holds.reduce((a, h) => a + h.capacity, 0));
  readonly totalLoaded = computed(() => this.s.data().holds.reduce((a, h) => a + h.loaded, 0));

  g(h: { loaded: number; capacity: number }) {
    return gaugeOf(h.loaded, h.capacity);
  }

  shipmentsIn(holdName: string) {
    const active = this.s.activeVoyage()?.id;
    return this.s.data().shipments.filter((x) => x.voyageId === active && !x.status.includes('التفريغ') && (x.hold === holdName || x.hold === 'العنبران'));
  }
}
