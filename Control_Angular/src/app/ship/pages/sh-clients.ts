import { Component, computed, inject, signal } from '@angular/core';
import { num, today } from '../core/ship-calc';
import { dateLabel, fmt, usd } from '../core/ship-format';
import { ShipStore } from '../core/ship-store';
import { CargoClient, Shipment } from '../core/ship.types';

const COMMODITIES = ['قمح صب', 'ذرة صفراء', 'سماد يوريا', 'فوسفات صخري', 'خام حديد', 'أسمنت سائب', 'سكر خام سائب', 'فول صويا'];
const STATUSES = ['قيد التحميل', 'مشحونة بالبحر حالياً', 'تم التفريغ والتسليم'];
const CLIENT_TYPES = ['مستورد ومستلم (Consignee)', 'شاحن ومصدر (Shipper)', 'مستأجر سفينة (Charterer)'];

@Component({
  selector: 'sh-clients',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>العملاء والشحنات</h1>
          <p>عملاء الشحن وسلع النولون وشحناتهم على الرحلات، مع النولون المستحق والمدفوع.</p>
        </div>
        @if (s.can('voyages')) {
          <div class="actions">
            <button type="button" class="btn" (click)="openClient()"><sc-icon name="plus" /> عميل</button>
            <button type="button" class="btn btn-primary" (click)="openShipment()"><sc-icon name="plus" /> شحنة</button>
          </div>
        }
      </div>

      <div class="kpis">
        <div class="kpi"><label>الشحنات</label><strong>{{ s.data().shipments.length }}</strong></div>
        <div class="kpi"><label>الحمولة (طن)</label><strong>{{ fmt(tons(), 0) }}</strong></div>
        <div class="kpi ok"><label>إجمالي النولون</label><strong>{{ usd(total()) }}</strong></div>
        <div class="kpi warn"><label>المتبقي للتحصيل</label><strong>{{ usd(total() - paid()) }}</strong></div>
      </div>

      <div class="row between">
        <div class="tabs">
          <button type="button" class="tab" [class.on]="tab() === 'shipments'" (click)="tab.set('shipments')">الشحنات</button>
          <button type="button" class="tab" [class.on]="tab() === 'clients'" (click)="tab.set('clients')">العملاء</button>
        </div>
        <input class="search" type="search" placeholder="بحث" [value]="q()" (input)="q.set($any($event.target).value)" />
      </div>

      @if (tab() === 'shipments') {
        <section class="card">
          <div class="card-body flush table-wrap">
            <table class="tbl">
              <thead><tr><th>البوليصة</th><th>العميل</th><th>السلعة</th><th>العنبر</th><th>من ← إلى</th><th>الطن</th><th>النولون</th><th>المدفوع</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                @for (x of shipments(); track x.id) {
                  <tr>
                    <td><b>{{ x.ref }}</b><div class="muted small">{{ dateLabel(x.date) }} · {{ voyageNo(x.voyageId) }}</div></td>
                    <td>{{ clientName(x.clientId) }}</td>
                    <td>{{ x.commodity }}</td>
                    <td>{{ x.hold }}</td>
                    <td class="small">{{ x.loadingPort }} ← {{ x.dischargePort }}</td>
                    <td class="num">{{ fmt(x.tons, 0) }}</td>
                    <td class="num">{{ usd(freight(x)) }}</td>
                    <td class="num">{{ usd(x.paid) }}</td>
                    <td><span class="badge" [class]="'badge ' + statusTone(x.status)">{{ x.status }}</span></td>
                    <td class="end tight">
                      @if (s.can('voyages')) {
                        <button type="button" class="btn btn-sm" (click)="openShipment(x)"><sc-icon name="edit" /></button>
                        <button type="button" class="btn btn-sm btn-danger" (click)="removeShipment(x)"><sc-icon name="trash" /></button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            @if (!shipments().length) { <div class="empty"><sc-icon name="cube" /> لا توجد شحنات.</div> }
          </div>
        </section>
      } @else {
        <section class="card">
          <div class="card-body flush table-wrap">
            <table class="tbl">
              <thead><tr><th>العميل</th><th>النوع</th><th>الدولة</th><th>جهة الاتصال</th><th>شروط الدفع</th><th>الشحنات</th><th></th></tr></thead>
              <tbody>
                @for (c of clients(); track c.id) {
                  <tr>
                    <td><b>{{ c.company }}</b></td>
                    <td class="small">{{ c.type }}</td>
                    <td>{{ c.country }}</td>
                    <td class="small">{{ c.contact }}<br /><span class="ltr">{{ c.phone }}</span><br /><span class="ltr">{{ c.email }}</span></td>
                    <td class="small">{{ c.terms }}</td>
                    <td class="num">{{ countOf(c.id) }}</td>
                    <td class="end tight">@if (s.can('voyages')) { <button type="button" class="btn btn-sm" (click)="openClient(c)"><sc-icon name="edit" /></button> }</td>
                  </tr>
                }
              </tbody>
            </table>
            @if (!clients().length) { <div class="empty">لا يوجد عملاء.</div> }
          </div>
        </section>
      }
    </div>

    @if (cform) {
      <div class="modal-back" (click)="cform = null">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head"><h3>{{ cform.id ? 'تعديل عميل' : 'عميل جديد' }}</h3></div>
          <div class="modal-body">
            <div class="form-grid">
              <label class="field wide"><span>اسم الشركة</span><input type="text" [(ngModel)]="cform.company" /></label>
              <label class="field">
                <span>النوع</span>
                <select [(ngModel)]="cform.type">
                  @for (t of clientTypes; track t) { <option [value]="t">{{ t }}</option> }
                </select>
              </label>
              <label class="field"><span>الدولة</span><input type="text" [(ngModel)]="cform.country" /></label>
              <label class="field"><span>جهة الاتصال</span><input type="text" [(ngModel)]="cform.contact" /></label>
              <label class="field"><span>الهاتف</span><input type="text" dir="ltr" [(ngModel)]="cform.phone" /></label>
              <label class="field"><span>الإيميل</span><input type="email" dir="ltr" [(ngModel)]="cform.email" /></label>
              <label class="field wide"><span>شروط الدفع</span><input type="text" [(ngModel)]="cform.terms" /></label>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="cform = null">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="saveClient()">حفظ</button>
          </div>
        </div>
      </div>
    }

    @if (sform) {
      <div class="modal-back" (click)="sform = null">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="modal-head"><h3>{{ sform.id ? 'تعديل شحنة' : 'شحنة جديدة' }}</h3></div>
          <div class="modal-body">
            <div class="form-grid">
              <label class="field"><span>رقم البوليصة</span><input type="text" dir="ltr" [(ngModel)]="sform.ref" /></label>
              <label class="field">
                <span>العميل</span>
                <select [(ngModel)]="sform.clientId">
                  @for (c of clients(); track c.id) { <option [ngValue]="c.id">{{ c.company }}</option> }
                </select>
              </label>
              <label class="field">
                <span>الرحلة</span>
                <select [(ngModel)]="sform.voyageId">
                  @for (v of s.voyages(); track v.id) { <option [ngValue]="v.id">{{ v.number }} — {{ v.title }}</option> }
                </select>
              </label>
              <label class="field">
                <span>السلعة</span>
                <input type="text" list="commodities" [(ngModel)]="sform.commodity" />
                <datalist id="commodities">@for (c of commodities; track c) { <option [value]="c"></option> }</datalist>
              </label>
              <label class="field">
                <span>العنبر</span>
                <select [(ngModel)]="sform.hold">
                  @for (h of s.data().holds; track h.id) { <option [value]="h.name">{{ h.name }}</option> }
                  <option value="العنبران">العنبران</option>
                </select>
              </label>
              <label class="field"><span>ميناء التحميل</span><input type="text" [(ngModel)]="sform.loadingPort" /></label>
              <label class="field"><span>ميناء التفريغ</span><input type="text" [(ngModel)]="sform.dischargePort" /></label>
              <label class="field"><span>الكمية (طن)</span><input type="number" min="0" [(ngModel)]="sform.tons" /></label>
              <label class="field"><span>النولون / طن (USD)</span><input type="number" min="0" step="any" [(ngModel)]="sform.ratePerTon" /></label>
              <label class="field"><span>مصاريف إضافية</span><input type="number" min="0" [(ngModel)]="sform.extra" /></label>
              <label class="field"><span>المدفوع</span><input type="number" min="0" [(ngModel)]="sform.paid" /></label>
              <label class="field">
                <span>الحالة</span>
                <select [(ngModel)]="sform.status">
                  @for (st of statuses; track st) { <option [value]="st">{{ st }}</option> }
                </select>
              </label>
              <label class="field"><span>التاريخ</span><input type="date" [(ngModel)]="sform.date" /></label>
            </div>
            <div class="alert"><sc-icon name="info" /> النولون = الطن × السعر + المصاريف = <b>{{ usd(num(sform.tons) * num(sform.ratePerTon) + num(sform.extra)) }}</b></div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="sform = null">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="saveShipment()">حفظ</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ShClients {
  readonly s = inject(ShipStore);
  readonly fmt = fmt;
  readonly usd = usd;
  readonly num = num;
  readonly dateLabel = dateLabel;
  readonly commodities = COMMODITIES;
  readonly statuses = STATUSES;
  readonly clientTypes = CLIENT_TYPES;
  readonly tab = signal<'shipments' | 'clients'>('shipments');
  readonly q = signal('');
  cform: CargoClient | null = null;
  sform: Shipment | null = null;

  readonly clients = computed(() => {
    const t = this.q().trim().toLowerCase();
    return this.s.data().clients.filter((c) => !t || c.company.toLowerCase().includes(t) || c.country.toLowerCase().includes(t));
  });

  readonly shipments = computed(() => {
    const t = this.q().trim().toLowerCase();
    return this.s
      .data()
      .shipments.filter((x) => !t || x.ref.toLowerCase().includes(t) || x.commodity.toLowerCase().includes(t) || this.clientName(x.clientId).toLowerCase().includes(t))
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  readonly tons = computed(() => this.s.data().shipments.reduce((a, x) => a + x.tons, 0));
  readonly total = computed(() => this.s.data().shipments.reduce((a, x) => a + this.freight(x), 0));
  readonly paid = computed(() => this.s.data().shipments.reduce((a, x) => a + x.paid, 0));

  freight(x: Shipment): number {
    return x.tons * x.ratePerTon + x.extra;
  }

  clientName(id: number): string {
    return this.s.data().clients.find((c) => c.id === id)?.company ?? '—';
  }

  voyageNo(id: number): string {
    return this.s.voyages().find((v) => v.id === id)?.number ?? '—';
  }

  countOf(id: number): number {
    return this.s.data().shipments.filter((x) => x.clientId === id).length;
  }

  statusTone(st: string): string {
    return st.includes('التفريغ') ? 'ok' : st.includes('بالبحر') ? 'info' : 'warn';
  }

  openClient(c?: CargoClient): void {
    this.cform = c ? { ...c } : { id: 0, company: '', type: CLIENT_TYPES[0], country: '', contact: '', phone: '', email: '', terms: '' };
  }

  saveClient(): void {
    const f = this.cform;
    if (!f || !f.company.trim()) {
      this.s.notify('اسم الشركة مطلوب.', 'warn');
      return;
    }
    this.s.saveClient(f);
    this.cform = null;
  }

  openShipment(x?: Shipment): void {
    this.sform = x
      ? { ...x }
      : {
          id: 0,
          ref: `BL-${String(this.s.data().shipments.length + 501)}`,
          clientId: this.s.data().clients[0]?.id ?? 0,
          voyageId: this.s.activeVoyage()?.id ?? this.s.voyages()[0]?.id ?? 0,
          commodity: COMMODITIES[0],
          hold: this.s.data().holds[0]?.name ?? '',
          loadingPort: '',
          dischargePort: '',
          tons: 0,
          ratePerTon: 0,
          extra: 0,
          paid: 0,
          status: STATUSES[0],
          date: today(),
        };
  }

  saveShipment(): void {
    const f = this.sform;
    if (!f || !f.ref.trim() || num(f.tons) <= 0) {
      this.s.notify('رقم البوليصة والكمية مطلوبان.', 'warn');
      return;
    }
    this.s.saveShipment({ ...f, tons: num(f.tons), ratePerTon: num(f.ratePerTon), extra: num(f.extra), paid: num(f.paid) });
    this.sform = null;
  }

  removeShipment(x: Shipment): void {
    if (window.confirm(`حذف الشحنة ${x.ref}؟`)) this.s.deleteShipment(x.id);
  }
}
