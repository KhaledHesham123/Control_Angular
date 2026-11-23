import { Component, computed, inject, signal } from '@angular/core';
import { groupsOf, purchaseValue, rootOf } from '../core/ship-calc';
import { dateLabel, downloadCsv, usd } from '../core/ship-format';
import { ShipStore } from '../core/ship-store';
import { REQ_STATUS, ReqStatus, Requisition } from '../core/ship.types';

type Tab = 'requests' | 'lines';

@Component({
  selector: 'sh-requests',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>طلبات الشراء</h1>
          <p>
            كل طلب بيمر بمراحل: إنشاء من السفينة ← مراجعة الإدارة ← إرسال للموردين ← عروض وترسية ← توريد واستلام وتحديث المخزن.
          </p>
        </div>
        @if (s.can('request')) {
          <a class="btn btn-primary" routerLink="/ship/requests/new"><sc-icon name="plus" /> طلب جديد</a>
        }
      </div>

      <div class="kpis">
        <div class="kpi" [class.warn]="count('submitted') > 0"><label>بانتظار مراجعة الإدارة</label><strong>{{ count('submitted') }}</strong></div>
        <div class="kpi"><label>عند الموردين / عروض</label><strong>{{ count('ready') + count('sent') + count('offers') }}</strong></div>
        <div class="kpi ok"><label>معتمدة بانتظار التوريد</label><strong>{{ count('approved') }}</strong></div>
        <div class="kpi gold"><label>قيمة المعتمد غير المستلم</label><strong>{{ usd(openValue()) }}</strong></div>
      </div>

      <div class="row between">
        <div class="tabs">
          <button type="button" class="tab" [class.on]="tab() === 'requests'" (click)="tab.set('requests')">الطلبات</button>
          <button type="button" class="tab" [class.on]="tab() === 'lines'" (click)="tab.set('lines')">سجل الأصناف المطلوبة (من طلب ماذا)</button>
        </div>
        <input class="search" type="search" placeholder="بحث برقم الطلب أو الصنف أو الشخص" [value]="q()" (input)="q.set($any($event.target).value)" />
      </div>

      @if (tab() === 'requests') {
        <div class="chips">
          <button type="button" class="chip" [class.on]="status() === 'all'" (click)="status.set('all')">الكل ({{ s.requests().length }})</button>
          @for (st of statuses; track st) {
            <button type="button" class="chip" [class.on]="status() === st" (click)="status.set(st)">{{ meta(st).label }} ({{ count(st) }})</button>
          }
        </div>

        <section class="card">
          <div class="card-body flush table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>رقم الطلب</th>
                  <th>التاريخ</th>
                  <th>مقدّم الطلب</th>
                  <th>الأقسام</th>
                  <th>الأصناف</th>
                  <th>الحالة</th>
                  <th>التوريد المتوقع</th>
                  <th>القيمة المعتمدة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.id) {
                  <tr>
                    <td>
                      <a [routerLink]="['/ship/requests', r.id]"><b>{{ r.no }}</b></a>
                      @if (r.priority === 'urgent') {
                        <span class="badge bad">عاجل</span>
                      }
                    </td>
                    <td>{{ dateLabel(r.createdAt) }}</td>
                    <td>{{ r.createdBy }}</td>
                    <td>
                      <div class="chips">
                        @for (g of groups(r); track g) {
                          <span class="badge muted">{{ catName(g) }}</span>
                        }
                      </div>
                    </td>
                    <td class="num">{{ liveCount(r) }}</td>
                    <td><span class="badge" [class]="'badge ' + meta(r.status).tone">{{ meta(r.status).label }}</span></td>
                    <td>{{ expected(r) }}</td>
                    <td class="num">{{ approvedValue(r) ? usd(approvedValue(r)) : '—' }}</td>
                    <td class="end"><a class="btn btn-sm" [routerLink]="['/ship/requests', r.id]">فتح</a></td>
                  </tr>
                }
              </tbody>
            </table>
            @if (!rows().length) {
              <div class="empty"><sc-icon name="cart" /> مفيش طلبات بالفلتر ده.</div>
            }
          </div>
        </section>
      } @else {
        <section class="card">
          <div class="card-head">
            <h3>كل الأصناف المطلوبة عبر الطلبات</h3>
            <div class="row">
              <select [value]="rootFilter()" (change)="rootFilter.set($any($event.target).value)">
                <option value="">كل الأقسام</option>
                @for (c of roots(); track c.id) {
                  <option [value]="c.id">{{ c.name }}</option>
                }
              </select>
              <button type="button" class="btn btn-sm" (click)="exportLines()"><sc-icon name="down" /> تصدير CSV</button>
            </div>
          </div>
          <div class="card-body flush table-wrap">
            <table class="tbl">
              <thead>
                <tr><th>التاريخ</th><th>الطلب</th><th>طلبها</th><th>الصنف</th><th>الوصف</th><th>الكمية</th><th>حالة الطلب</th></tr>
              </thead>
              <tbody>
                @for (l of lineRows(); track l.key) {
                  <tr [class.dim]="l.removed">
                    <td>{{ dateLabel(l.date) }}</td>
                    <td><a [routerLink]="['/ship/requests', l.reqId]">{{ l.no }}</a></td>
                    <td>{{ l.by }}</td>
                    <td><b>{{ l.name }}</b><div class="muted small">{{ l.group }}</div></td>
                    <td>{{ l.description || '—' }}</td>
                    <td class="num">{{ l.qty }} {{ l.unit }}</td>
                    <td><span class="badge" [class]="'badge ' + meta(l.status).tone">{{ meta(l.status).label }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
            @if (!lineRows().length) {
              <div class="empty">لا توجد أصناف.</div>
            }
          </div>
        </section>
      }
    </div>
  `,
})
export class ShRequests {
  readonly s = inject(ShipStore);
  readonly usd = usd;
  readonly dateLabel = dateLabel;
  readonly statuses: ReqStatus[] = ['draft', 'submitted', 'ready', 'sent', 'offers', 'approved', 'received', 'cancelled'];
  readonly tab = signal<Tab>('requests');
  readonly status = signal<ReqStatus | 'all'>('all');
  readonly q = signal('');
  readonly rootFilter = signal('');

  readonly roots = computed(() => this.s.categories().filter((c) => !c.parentId));

  meta(st: ReqStatus) {
    return REQ_STATUS[st];
  }

  count(st: ReqStatus): number {
    return this.s.requests().filter((r) => r.status === st).length;
  }

  readonly openValue = computed(() =>
    this.s
      .requests()
      .filter((r) => r.status === 'approved')
      .reduce((sum, r) => sum + groupsOf(r).reduce((x, g) => x + purchaseValue(r, g).committed, 0), 0),
  );

  readonly rows = computed(() => {
    const term = this.q().trim().toLowerCase();
    const st = this.status();
    return this.s
      .requests()
      .filter((r) => st === 'all' || r.status === st)
      .filter((r) => !term || r.no.toLowerCase().includes(term) || r.createdBy.toLowerCase().includes(term) || r.lines.some((l) => l.name.toLowerCase().includes(term)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.no.localeCompare(a.no));
  });

  readonly lineRows = computed(() => {
    const term = this.q().trim().toLowerCase();
    const root = this.rootFilter();
    const cats = this.s.categories();
    const out: { key: string; reqId: string; no: string; date: string; by: string; name: string; unit: string; qty: number; description: string; group: string; status: ReqStatus; removed: boolean }[] = [];
    for (const r of this.s.requests()) {
      for (const l of r.lines) {
        const rootId = rootOf(l.categoryId, cats)?.id ?? l.groupId;
        if (root && rootId !== root) continue;
        if (term && !l.name.toLowerCase().includes(term) && !r.createdBy.toLowerCase().includes(term) && !r.no.toLowerCase().includes(term)) continue;
        out.push({ key: l.id, reqId: r.id, no: r.no, date: r.createdAt, by: r.createdBy, name: l.name, unit: l.unit, qty: l.qty, description: l.description, group: this.catName(rootId), status: r.status, removed: l.removed });
      }
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  });

  groups(r: Requisition): string[] {
    return groupsOf(r);
  }

  catName(id: string): string {
    return this.s.categories().find((c) => c.id === id)?.name ?? id;
  }

  liveCount(r: Requisition): number {
    return r.lines.filter((l) => !l.removed).length;
  }

  expected(r: Requisition): string {
    if (!r.approvals.length) return '—';
    const dates = r.approvals.map((a) => a.expectedDate).sort();
    return r.status === 'received' ? 'تم' : dateLabel(dates[dates.length - 1]);
  }

  approvedValue(r: Requisition): number {
    return groupsOf(r).reduce((sum, g) => {
      const v = purchaseValue(r, g);
      return sum + v.actual + v.committed;
    }, 0);
  }

  exportLines(): void {
    downloadCsv('requested-items.csv', [
      ['التاريخ', 'الطلب', 'طلبها', 'الصنف', 'القسم', 'الوصف', 'الكمية', 'الوحدة', 'الحالة'],
      ...this.lineRows().map((l) => [l.date, l.no, l.by, l.name, l.group, l.description, l.qty, l.unit, REQ_STATUS[l.status].label]),
    ]);
  }
}
