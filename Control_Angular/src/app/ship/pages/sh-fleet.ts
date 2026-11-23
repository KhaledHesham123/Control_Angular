import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { kindGauge } from '../core/ship-calc';
import { fmt, usd } from '../core/ship-format';
import { ShipMap } from '../core/ship-map';
import { particularsPrint } from '../core/ship-print';
import { ShipStore } from '../core/ship-store';
import { VesselProfile } from '../core/ship.types';

@Component({
  selector: 'sh-fleet',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>الأسطول والتأجير</h1>
          <p>كل سفن الشركة: مكانها، رحلتها الحالية، وقودها، والمتاح منها للتأجير مع بطاقة المواصفات الجاهزة للإرسال للمستأجر.</p>
        </div>
        @if (s.can('fleet')) {
          <button type="button" class="btn btn-primary" (click)="adding = true"><sc-icon name="plus" /> سفينة جديدة</button>
        }
      </div>

      <div class="kpis">
        <div class="kpi"><label>عدد السفن</label><strong>{{ s.vessels().length }}</strong></div>
        <div class="kpi ok"><label>متاحة للتأجير</label><strong>{{ available() }}</strong></div>
        <div class="kpi gold"><label>مسافرة الآن</label><strong>{{ sailing() }}</strong></div>
      </div>

      <div class="tabs">
        <button type="button" class="tab" [class.on]="filter() === 'all'" (click)="filter.set('all')">كل السفن</button>
        <button type="button" class="tab" [class.on]="filter() === 'free'" (click)="filter.set('free')">المتاحة للتأجير</button>
      </div>

      <div class="grid g-main" style="align-items:start">
        <div class="grid auto" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))">
          @for (v of rows(); track v.id) {
            <article class="ship-card" [class.current]="v.id === s.vessel().id">
              <div class="between row">
                <div>
                  <b style="font-size:1.1rem">{{ v.name }}</b>
                  <div class="muted small">{{ v.type }} · {{ v.flag }} · IMO {{ v.imo }}</div>
                </div>
                @if (v.availableForCharter) {
                  <span class="badge ok">متاحة للتأجير</span>
                } @else {
                  <span class="badge muted">مشغّلة</span>
                }
              </div>
              <dl class="kv" style="grid-template-columns: 100px 1fr">
                <dt>DWT</dt><dd class="num">{{ fmt(v.dwt, 0) }} طن</dd>
                <dt>الموقع</dt><dd>{{ v.location || '—' }}</dd>
                <dt>الرحلة</dt><dd>{{ voyage(v) }}</dd>
                <dt>الطاقم</dt><dd>{{ crew(v) }} فرد</dd>
                <dt>وقود HFO</dt><dd><span class="num">{{ fmt(hfo(v), 0) }}</span> طن</dd>
                @if (v.availableForCharter && v.charterRate) {
                  <dt>سعر التأجير</dt><dd>{{ usd(v.charterRate) }}/يوم</dd>
                }
              </dl>
              <div class="row">
                <button type="button" class="btn btn-sm btn-primary" (click)="open(v)">فتح لوحة السفينة</button>
                <button type="button" class="btn btn-sm" (click)="print(v)"><sc-icon name="print" /> بطاقة المواصفات</button>
                @if (s.can('fleet')) {
                  <button type="button" class="btn btn-sm" (click)="toggle(v)">{{ v.availableForCharter ? 'إلغاء الإتاحة' : 'إتاحة للتأجير' }}</button>
                }
              </div>
            </article>
          }
          @if (!rows().length) {
            <div class="card"><div class="empty"><sc-icon name="ship" /> لا توجد سفن بهذا الفلتر.</div></div>
          }
        </div>
        <section class="card">
          <div class="card-head"><h3>مواقع السفن</h3></div>
          <div class="card-body"><div #mapEl class="map sm"></div></div>
        </section>
      </div>
    </div>

    @if (adding) {
      <div class="modal-back" (click)="adding = false">
        <div class="modal narrow" (click)="$event.stopPropagation()">
          <div class="modal-head"><h3>سفينة جديدة</h3></div>
          <div class="modal-body">
            <label class="field"><span>اسم السفينة</span><input type="text" [(ngModel)]="newName" placeholder="M/V …" /></label>
            <div class="hint">بعد الإضافة أكمل المواصفات من صفحة «مواصفات السفينة».</div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="adding = false">إلغاء</button>
            <button type="button" class="btn btn-primary" [disabled]="!newName.trim()" (click)="add()">إضافة</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ShFleet {
  readonly s = inject(ShipStore);
  private readonly router = inject(Router);
  readonly fmt = fmt;
  readonly usd = usd;
  readonly filter = signal<'all' | 'free'>('all');
  private readonly mapEl = viewChild<ElementRef<HTMLElement>>('mapEl');
  private map: ShipMap | null = null;
  adding = false;
  newName = '';

  readonly rows = computed(() => this.s.vessels().filter((v) => this.filter() === 'all' || v.availableForCharter));
  readonly available = computed(() => this.s.vessels().filter((v) => v.availableForCharter).length);
  readonly sailing = computed(() => this.s.vessels().filter((v) => this.s.state().data[v.id]?.voyages.some((x) => x.status === 'active')).length);

  constructor() {
    effect(() => {
      const el = this.mapEl()?.nativeElement;
      const vessels = this.s.vessels();
      if (!el) return;
      this.map ??= new ShipMap(el);
      void this.map.draw(
        vessels.map((v) => ({
          lat: v.lat,
          lng: v.lng,
          label: v.name,
          tone: v.availableForCharter ? ('ok' as const) : ('navy' as const),
          popup: `<b>${v.name}</b><br>${v.location}<br>${v.availableForCharter ? 'متاحة للتأجير' : 'مشغّلة'}`,
        })),
        [],
      );
    });
    inject(DestroyRef).onDestroy(() => this.map?.destroy());
  }

  voyage(v: VesselProfile): string {
    const a = this.s.state().data[v.id]?.voyages.find((x) => x.status === 'active');
    return a ? a.title : 'لا توجد رحلة جارية';
  }

  crew(v: VesselProfile): number {
    return this.s.state().data[v.id]?.crew.filter((c) => c.status === 'OnBoard').length ?? 0;
  }

  hfo(v: VesselProfile): number {
    return kindGauge(this.s.state().data[v.id]?.tanks ?? [], 'hfo').current;
  }

  open(v: VesselProfile): void {
    this.s.selectVessel(v.id);
    void this.router.navigate(['/ship']);
  }

  print(v: VesselProfile): void {
    particularsPrint(v, this.s.state().data[v.id]?.certificates ?? []);
  }

  toggle(v: VesselProfile): void {
    this.s.saveVessel({ ...v, availableForCharter: !v.availableForCharter });
  }

  add(): void {
    this.s.addVessel(this.newName);
    this.adding = false;
    this.newName = '';
    void this.router.navigate(['/ship/particulars']);
  }
}
