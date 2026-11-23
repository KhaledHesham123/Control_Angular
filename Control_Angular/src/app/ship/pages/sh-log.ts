import { Component, computed, inject, signal } from '@angular/core';
import { categoryPath } from '../core/ship-calc';
import { dateLabel, downloadCsv, fmt } from '../core/ship-format';
import { ShipStore } from '../core/ship-store';
import { MOVE_LABEL, MoveKind } from '../core/ship.types';

const TONE: Record<MoveKind, string> = { in: 'ok', out: 'warn', adjust: 'violet', consume: 'info', bunker: 'gold' };

@Component({
  selector: 'sh-log',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>سجل الحركة</h1>
          <p>كل ما دخل أو خرج: استلام من الموردين، صرف للأقسام، استهلاك الوقود اليومي، تزويد الخزانات، وتسويات الجرد.</p>
        </div>
        <button type="button" class="btn" (click)="exportCsv()"><sc-icon name="down" /> تصدير CSV</button>
      </div>

      <div class="card">
        <div class="card-body stack">
          <div class="chips">
            <button type="button" class="chip" [class.on]="kind() === 'all'" (click)="kind.set('all')">الكل</button>
            @for (k of kinds; track k) {
              <button type="button" class="chip" [class.on]="kind() === k" (click)="kind.set(k)">{{ label(k) }}</button>
            }
          </div>
          <div class="form-grid">
            <label class="field"><span>بحث</span><input type="search" placeholder="صنف / شخص / ملاحظة" [value]="q()" (input)="q.set($any($event.target).value)" /></label>
            <label class="field">
              <span>النوع</span>
              <select [value]="source()" (change)="source.set($any($event.target).value)">
                <option value="all">أصناف وخزانات</option>
                <option value="item">أصناف المخزن فقط</option>
                <option value="tank">الخزانات فقط</option>
              </select>
            </label>
            <label class="field"><span>من تاريخ</span><input type="date" [value]="from()" (input)="from.set($any($event.target).value)" /></label>
            <label class="field"><span>إلى تاريخ</span><input type="date" [value]="to()" (input)="to.set($any($event.target).value)" /></label>
          </div>
        </div>
      </div>

      <section class="card">
        <div class="card-head"><h2>{{ rows().length }} حركة</h2></div>
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead><tr><th>اليوم</th><th>الحركة</th><th>البند</th><th>الكمية</th><th>الرصيد بعد</th><th>القسم</th><th>بواسطة</th><th>ملاحظة</th></tr></thead>
            <tbody>
              @for (m of rows(); track m.id) {
                <tr>
                  <td>{{ dateLabel(m.date) }}</td>
                  <td><span class="badge" [class]="'badge ' + tone(m.kind)">{{ label(m.kind) }}</span></td>
                  <td><b>{{ m.name }}</b>@if (m.categoryId) { <div class="muted small">{{ path(m.categoryId) }}</div> }</td>
                  <td class="num">{{ m.kind === 'out' || m.kind === 'consume' ? '−' : '+' }}{{ fmt(m.qty, 2) }} {{ m.unit }}</td>
                  <td class="num">{{ fmt(m.balanceAfter, 2) }}</td>
                  <td class="small">{{ m.department }}</td>
                  <td class="small">{{ m.by }}</td>
                  <td class="small">{{ m.note || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
          @if (!rows().length) {
            <div class="empty">لا توجد حركات بهذه الفلاتر.</div>
          }
        </div>
      </section>
    </div>
  `,
})
export class ShLog {
  readonly s = inject(ShipStore);
  readonly fmt = fmt;
  readonly dateLabel = dateLabel;
  readonly kinds: MoveKind[] = ['in', 'out', 'consume', 'bunker', 'adjust'];
  readonly kind = signal<MoveKind | 'all'>('all');
  readonly source = signal<'all' | 'item' | 'tank'>('all');
  readonly q = signal('');
  readonly from = signal('');
  readonly to = signal('');

  readonly rows = computed(() => {
    const term = this.q().trim().toLowerCase();
    const k = this.kind();
    const src = this.source();
    const from = this.from();
    const to = this.to();
    return this.s
      .movements()
      .filter(
        (m) =>
          (k === 'all' || m.kind === k) &&
          (src === 'all' || m.source === src) &&
          (!from || m.date >= from) &&
          (!to || m.date <= to) &&
          (!term || m.name.toLowerCase().includes(term) || m.by.toLowerCase().includes(term) || m.note.toLowerCase().includes(term)),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  label(k: MoveKind): string {
    return MOVE_LABEL[k];
  }

  tone(k: MoveKind): string {
    return TONE[k];
  }

  path(id: string): string {
    return categoryPath(id, this.s.categories());
  }

  exportCsv(): void {
    downloadCsv('movements.csv', [
      ['اليوم', 'الحركة', 'البند', 'الكمية', 'الوحدة', 'الرصيد بعد', 'القسم', 'بواسطة', 'ملاحظة'],
      ...this.rows().map((m) => [m.date, MOVE_LABEL[m.kind], m.name, m.qty, m.unit, m.balanceAfter, m.department, m.by, m.note]),
    ]);
  }
}
