import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { bunkerScore, supplierRating, uid } from '../core/ship-calc';
import { fmt, usd } from '../core/ship-format';
import { ShipMap } from '../core/ship-map';
import { ShipStore } from '../core/ship-store';
import { Port } from '../core/ship.types';

@Component({
  selector: 'sh-ports',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>الموانئ وأسعار الوقود</h1>
          <p>كل ميناء مربوط بسعر الوقود وتكلفة الرسو والموردين اللي فيه. ده الأساس اللي بيعتمد عليه مخطط المسار.</p>
        </div>
        @if (s.can('suppliers')) {
          <button type="button" class="btn btn-primary" (click)="openEdit()"><sc-icon name="plus" /> ميناء جديد</button>
        }
      </div>

      <div class="kpis">
        <div class="kpi"><label>عدد الموانئ</label><strong>{{ s.ports().length }}</strong></div>
        <div class="kpi ok"><label>أرخص HFO</label><strong>{{ cheapest()?.name ?? '—' }}</strong><small>{{ cheapest() ? usd(cheapest()!.hfoPrice) + '/طن' : '' }}</small></div>
        <div class="kpi bad"><label>أغلى HFO</label><strong>{{ dearest()?.name ?? '—' }}</strong><small>{{ dearest() ? usd(dearest()!.hfoPrice) + '/طن' : '' }}</small></div>
        <div class="kpi gold"><label>متوسط HFO</label><strong>{{ usd(avg()) }}</strong><small>للطن</small></div>
      </div>

      <section class="card">
        <div class="card-head"><h2>الخريطة</h2><small>الأخضر أرخص وقود · الأحمر أغلى</small></div>
        <div class="card-body"><div #mapEl class="map"></div></div>
      </section>

      <section class="card">
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead><tr><th>الميناء</th><th>HFO / طن</th><th>MGO / طن</th><th>الرسو / يوم</th><th>إرشاد + وكالة</th><th>قناة</th><th>الموردون</th><th></th></tr></thead>
            <tbody>
              @for (p of rows(); track p.id) {
                <tr>
                  <td><b>{{ p.name }}</b><div class="muted small">{{ p.country }}</div></td>
                  <td>
                    @if (p.hfoPrice) {
                      <span class="badge" [class]="'badge ' + tone(p)">{{ usd(p.hfoPrice) }}</span>
                    } @else {
                      <span class="muted">لا وقود</span>
                    }
                  </td>
                  <td class="num">{{ p.mgoPrice ? usd(p.mgoPrice) : '—' }}</td>
                  <td class="num">{{ usd(p.berthPerDay) }}</td>
                  <td class="num">{{ usd(p.pilotage + p.agency) }}</td>
                  <td class="num">{{ p.canal ? usd(p.canal) : '—' }}</td>
                  <td>
                    @for (x of suppliersOf(p); track x.id) {
                      <div class="small">{{ x.company }} <span class="stars">{{ rating(x) ?? '—' }}★</span></div>
                    }
                    @if (!suppliersOf(p).length) {
                      <span class="muted small">—</span>
                    }
                  </td>
                  <td class="end tight">
                    @if (s.can('suppliers')) {
                      <button type="button" class="btn btn-sm" (click)="openEdit(p)"><sc-icon name="edit" /></button>
                      <button type="button" class="btn btn-sm btn-danger" (click)="remove(p)"><sc-icon name="trash" /></button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>

    @if (form) {
      <div class="modal-back" (click)="form = null">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head"><h3>{{ isNew ? 'ميناء جديد' : 'تعديل الميناء' }}</h3><button type="button" class="btn btn-sm btn-ghost" (click)="form = null"><sc-icon name="x" /></button></div>
          <div class="modal-body">
            <div class="form-grid">
              <label class="field"><span>اسم الميناء</span><input type="text" [(ngModel)]="form.name" /></label>
              <label class="field"><span>الدولة</span><input type="text" [(ngModel)]="form.country" /></label>
              <label class="field"><span>خط العرض (Lat)</span><input type="number" step="any" [(ngModel)]="form.lat" /></label>
              <label class="field"><span>خط الطول (Lng)</span><input type="number" step="any" [(ngModel)]="form.lng" /></label>
              <label class="field"><span>سعر HFO / طن (0 = لا يتوفر)</span><input type="number" min="0" [(ngModel)]="form.hfoPrice" /></label>
              <label class="field"><span>سعر MGO / طن</span><input type="number" min="0" [(ngModel)]="form.mgoPrice" /></label>
              <label class="field"><span>الرسو / يوم</span><input type="number" min="0" [(ngModel)]="form.berthPerDay" /></label>
              <label class="field"><span>الإرشاد (Pilotage)</span><input type="number" min="0" [(ngModel)]="form.pilotage" /></label>
              <label class="field"><span>الوكالة (Agency)</span><input type="number" min="0" [(ngModel)]="form.agency" /></label>
              <label class="field"><span>رسوم قناة / عبور</span><input type="number" min="0" [(ngModel)]="form.canal" /></label>
            </div>
            <div class="field">
              <span>الموردون في هذا الميناء</span>
              <div class="chips">
                @for (x of s.suppliers(); track x.id) {
                  <button type="button" class="chip" [class.on]="form.supplierIds.includes(x.id)" (click)="toggle(x.id)">{{ x.company }}</button>
                }
              </div>
            </div>
            <label class="field"><span>ملاحظات</span><textarea rows="2" [(ngModel)]="form.notes"></textarea></label>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="form = null">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="save()"><sc-icon name="check" /> حفظ</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ShPorts {
  readonly s = inject(ShipStore);
  readonly usd = usd;
  readonly fmt = fmt;
  private readonly mapEl = viewChild<ElementRef<HTMLElement>>('mapEl');
  private map: ShipMap | null = null;
  readonly q = signal('');
  form: Port | null = null;
  isNew = false;

  readonly rows = computed(() => [...this.s.ports()].sort((a, b) => a.name.localeCompare(b.name, 'ar')));
  readonly fuel = computed(() => this.s.ports().filter((p) => p.hfoPrice > 0));
  readonly cheapest = computed(() => [...this.fuel()].sort((a, b) => a.hfoPrice - b.hfoPrice)[0] ?? null);
  readonly dearest = computed(() => [...this.fuel()].sort((a, b) => b.hfoPrice - a.hfoPrice)[0] ?? null);
  readonly avg = computed(() => (this.fuel().length ? this.fuel().reduce((s, p) => s + p.hfoPrice, 0) / this.fuel().length : 0));

  constructor() {
    effect(() => {
      const el = this.mapEl()?.nativeElement;
      const ports = this.s.ports();
      const avg = this.avg();
      if (!el) return;
      this.map ??= new ShipMap(el);
      void this.map.draw(
        ports.map((p) => ({
          lat: p.lat,
          lng: p.lng,
          label: p.name,
          tone: !p.hfoPrice ? ('navy' as const) : p.hfoPrice < avg * 0.97 ? ('ok' as const) : p.hfoPrice > avg * 1.05 ? ('bad' as const) : ('warn' as const),
          popup: `<b>${p.name}</b><br>HFO: ${p.hfoPrice ? '$' + p.hfoPrice : '—'}<br>رسو/يوم: $${p.berthPerDay}`,
        })),
        [],
      );
    });
    inject(DestroyRef).onDestroy(() => this.map?.destroy());
  }

  tone(p: Port): string {
    const a = this.avg();
    return p.hfoPrice < a * 0.97 ? 'ok' : p.hfoPrice > a * 1.05 ? 'bad' : 'warn';
  }

  suppliersOf(p: Port) {
    return this.s.suppliers().filter((x) => x.active && (p.supplierIds.includes(x.id) || x.portIds.includes(p.id)));
  }

  rating(x: Parameters<typeof supplierRating>[0]): number | null {
    return supplierRating(x);
  }

  openEdit(p?: Port): void {
    this.isNew = !p;
    this.form = p
      ? { ...p, supplierIds: [...p.supplierIds] }
      : { id: uid('port'), name: '', country: '', lat: 30, lng: 31, hfoPrice: 0, mgoPrice: 0, berthPerDay: 0, pilotage: 0, agency: 0, canal: 0, supplierIds: [], notes: '' };
  }

  toggle(id: string): void {
    const f = this.form;
    if (!f) return;
    f.supplierIds = f.supplierIds.includes(id) ? f.supplierIds.filter((x) => x !== id) : [...f.supplierIds, id];
  }

  save(): void {
    const f = this.form;
    if (!f) return;
    if (!f.name.trim()) {
      this.s.notify('اكتب اسم الميناء.', 'warn');
      return;
    }
    this.s.savePort({ ...f, lat: Number(f.lat), lng: Number(f.lng) });
    this.form = null;
  }

  remove(p: Port): void {
    if (window.confirm(`حذف ميناء «${p.name}»؟`)) this.s.deletePort(p.id);
  }

  /** للاستخدام في المقارنات */
  score(p: Port) {
    return bunkerScore(p, this.s.suppliers());
  }
}
