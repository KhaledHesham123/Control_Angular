import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { gaugeOf, num } from '../core/ship-calc';
import { certDocStatus, hasData } from '../core/ship-certs';
import { dateLabel, fmt } from '../core/ship-format';
import { particularsPrint } from '../core/ship-print';
import { ShipStore } from '../core/ship-store';
import { Certificate, Hold, VesselProfile } from '../core/ship.types';

@Component({
  selector: 'sh-particulars',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>مواصفات {{ f.name || 'السفينة' }}</h1>
          <p>بطاقة هذه السفينة: الهوية، الأبعاد، المحرك والأوناش، وسعة العنابر، مع شهادات السفينة.</p>
        </div>
        <div class="actions">
          <a class="btn" routerLink="/ship/fleet"><sc-icon name="back" /> الأسطول</a>
          <button type="button" class="btn" (click)="print()"><sc-icon name="print" /> طباعة / PDF</button>
          @if (s.can('fleet') && stored()) {
            <button type="button" class="btn" (click)="remove()"><sc-icon name="trash" /> حذف</button>
          }
          @if (s.can('fleet')) {
            <button type="button" class="btn btn-primary" (click)="save()"><sc-icon name="check" /> {{ stored() ? 'تعديل المواصفات' : 'إنشاء المواصفات' }}</button>
          }
        </div>
      </div>

      @if (!s.can('fleet')) {
        <div class="readonly-note"><sc-icon name="lock" /> التعديل متاح لمدير الشركة فقط.</div>
      }

      <fieldset [disabled]="!s.can('fleet')" style="border:0;padding:0;margin:0;min-width:0;display:grid;gap:16px">
        <section class="card">
          <div class="card-head"><h2>الهوية</h2></div>
          <div class="card-body form-grid">
            <label class="field"><span>اسم السفينة</span><input type="text" [(ngModel)]="f.name" /></label>
            <label class="field"><span>الاسم السابق</span><input type="text" [(ngModel)]="f.formerName" /></label>
            <label class="field"><span>رقم IMO</span><input type="text" dir="ltr" [(ngModel)]="f.imo" /></label>
            <label class="field"><span>إشارة النداء (Call Sign)</span><input type="text" dir="ltr" [(ngModel)]="f.callSign" /></label>
            <label class="field"><span>العلم</span><input type="text" [(ngModel)]="f.flag" /></label>
            <label class="field"><span>النوع</span><input type="text" [(ngModel)]="f.type" /></label>
            <label class="field"><span>هيئة التصنيف</span><input type="text" [(ngModel)]="f.classSociety" /></label>
            <label class="field"><span>سنة البناء</span><input type="text" [(ngModel)]="f.buildYear" /></label>
            <label class="field wide"><span>المالك / المشغّل</span><input type="text" [(ngModel)]="f.owner" /></label>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>الحمولات والأبعاد</h2></div>
          <div class="card-body form-grid">
            <label class="field"><span>DWT (طن)</span><input type="number" [(ngModel)]="f.dwt" /></label>
            <label class="field"><span>GRT</span><input type="number" [(ngModel)]="f.grt" /></label>
            <label class="field"><span>NRT</span><input type="number" [(ngModel)]="f.nrt" /></label>
            <label class="field"><span>الطول LOA (م)</span><input type="number" step="any" [(ngModel)]="f.loa" /></label>
            <label class="field"><span>العرض Beam (م)</span><input type="number" step="any" [(ngModel)]="f.beam" /></label>
            <label class="field"><span>الغاطس Draft (م)</span><input type="number" step="any" [(ngModel)]="f.draft" /></label>
            <label class="field"><span>سعة الحبوب (م³)</span><input type="number" [(ngModel)]="f.grainCapacity" /></label>
            <label class="field"><span>سعة البالة (م³)</span><input type="number" [(ngModel)]="f.baleCapacity" /></label>
            <label class="field"><span>السرعة (عقدة)</span><input type="number" step="any" [(ngModel)]="f.speedKn" /></label>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>المحرك والمعدات</h2></div>
          <div class="card-body form-grid">
            <label class="field wide"><span>المحرك الرئيسي</span><input type="text" [(ngModel)]="f.mainEngine" /></label>
            <label class="field wide"><span>الأوناش</span><input type="text" [(ngModel)]="f.cranes" /></label>
            <label class="field wide"><span>ملاحظات</span><textarea rows="2" [(ngModel)]="f.notes"></textarea></label>
          </div>
        </section>
      </fieldset>

      <section class="card">
        <div class="card-head"><h2>سعة العنابر</h2></div>
        <div class="card-body stack">
          @if (drawingHolds()) {
            <div class="kpis">
              <div class="kpi"><label>عدد العنابر</label><strong>{{ s.data().holds.length }}</strong></div>
              <div class="kpi ok"><label>سعة الحبوب</label><strong>{{ fmt(totalCap(), 0) }} م³</strong></div>
              <div class="kpi gold"><label>الفتحتان</label><strong>25.15 × 12.57 م</strong></div>
            </div>
            <p class="muted small">عنبر واحد أبعاده 52 × 12.6 × 8.275 م، وفتحتان من نوع McGregor. الرقم سعة الحبوب بالمتر المكعب، مش حمولة بالطن.</p>
          } @else {
            <div class="kpis">
              <div class="kpi"><label>السعة الكلية</label><strong>{{ fmt(totalCap(), 0) }} طن</strong></div>
              <div class="kpi ok"><label>المحمّل</label><strong>{{ fmt(totalLoaded(), 0) }} طن</strong></div>
              <div class="kpi gold"><label>المتاح</label><strong>{{ fmt(totalCap() - totalLoaded(), 0) }} طن</strong></div>
            </div>
          }
          <div class="grid g2">
            @for (h of s.data().holds; track h.id) {
              <section class="card">
                <div class="card-head"><h3>{{ h.name }}</h3>@if (!drawingHolds()) { <span class="badge info">{{ fmt(g(h).percent, 0) }}%</span> }</div>
                <div class="card-body stack">
                  <div class="value" style="font-size:1.4rem;font-weight:800"><span class="num">{{ fmt(drawingHolds() ? h.capacity : h.loaded, 0) }}</span> <small class="muted">{{ drawingHolds() ? 'م³ حبوب' : '/ ' + fmt(h.capacity, 0) + ' طن' }}</small></div>
                  @if (!drawingHolds()) {
                    <div class="gauge" [class]="'gauge ' + (g(h).percent > 90 ? 'bad' : 'ok')"><i [style.width.%]="g(h).percent"></i></div>
                    <div class="muted small">المتاح {{ fmt(h.capacity - h.loaded, 0) }} طن</div>
                  }
                  @if (!drawingHolds() && s.can('voyages')) {
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
            <div class="empty">لا توجد عنابر لهذه السفينة.</div>
          }
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>الشهادات</h2><a class="btn btn-sm" routerLink="/ship/certificates">إدارة الشهادات</a></div>
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <tbody>
              @for (c of mainCerts(); track c.id) {
                <tr>
                  <td><b>{{ c.title }}</b></td>
                  <td>{{ c.issuer }}</td>
                  <td>{{ dateLabel(c.expiryDate || c.dueDate) }}</td>
                  <td><span class="badge" [class]="'badge ' + state(c).tone">{{ state(c).label }}</span></td>
                </tr>
              }
            </tbody>
          </table>
          @if (!mainCerts().length) { <div class="empty">لا توجد شهادات.</div> }
        </div>
      </section>
    </div>
  `,
})
export class ShParticulars {
  readonly s = inject(ShipStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly dateLabel = dateLabel;
  readonly fmt = fmt;
  readonly num = num;
  readonly stored = signal(false);
  readonly totalCap = computed(() => this.s.data().holds.reduce((a, h) => a + h.capacity, 0));
  readonly totalLoaded = computed(() => this.s.data().holds.reduce((a, h) => a + h.loaded, 0));
  readonly drawingHolds = computed(() => {
    const vessel = this.s.vessel();
    return vessel.imo.replace(/\s/g, '') === '8318128' || vessel.name.toUpperCase().includes('AMANY');
  });
  f: VesselProfile = { ...this.s.vessel() };
  private readonly routeId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });
  private loadedFor = '';

  constructor() {
    effect(() => {
      const id = this.routeId() || this.s.vesselId();
      untracked(() => this.openShip(id));
    });
  }

  private openShip(id: string): void {
    if (!id || this.loadedFor === id) return;
    this.loadedFor = id;
    this.s.selectVessel(id);
    const local = this.s.vessels().find((vessel) => vessel.id === id) ?? this.s.vessel();
    this.f = { ...local, id };
    this.s
      .getParticulars(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((row) => {
        if (this.loadedFor !== id) return;
        this.stored.set(!!row);
      });
  }

  readonly mainCerts = computed(() => this.s.data().certificates.filter((c) => c.section === 'cert' && hasData(c)));

  state(c: Certificate) {
    return certDocStatus(c);
  }

  g(h: Hold) {
    return gaugeOf(h.loaded, h.capacity);
  }

  shipmentsIn(holdName: string) {
    const active = this.s.activeVoyage()?.id;
    return this.s.data().shipments.filter((x) => x.voyageId === active && !x.status.includes('التفريغ') && (x.hold === holdName || x.hold === 'العنبران'));
  }

  save(): void {
    const profile = { ...this.f, lat: Number(this.f.lat) || 0, lng: Number(this.f.lng) || 0 };
    const request = this.stored() ? this.s.updateParticulars(profile) : this.s.createParticulars(profile);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((ok) => {
      if (ok) this.stored.set(true);
    });
  }

  remove(): void {
    if (!window.confirm(`حذف مواصفات ${this.f.name}؟`)) return;
    this.s.deleteParticulars(this.f.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((ok) => {
      if (ok) void this.router.navigate(['/ship/fleet']);
    });
  }

  print(): void {
    particularsPrint(this.f, this.s.data().certificates, this.s.data().holds);
  }
}
