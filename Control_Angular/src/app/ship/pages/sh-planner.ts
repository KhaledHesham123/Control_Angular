import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { addDays, bunkerScore, planRoute, RoutePlan, round, today, uid } from '../core/ship-calc';
import { fmt, usd } from '../core/ship-format';
import { ShipMap } from '../core/ship-map';
import { ShipStore } from '../core/ship-store';
import { PortStop, Voyage } from '../core/ship.types';

interface Alt {
  label: string;
  plan: RoutePlan;
  delta: number;
}

@Component({
  selector: 'sh-planner',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>مخطط المسار والمقارنة</h1>
          <p>اختار ميناء الإبحار والوصول والمحطات. النظام بيحسب المسافة والوقود والتكلفة، ويقارن أسعار الوقود والموردين وتقييمهم، ويقترح أفضل ميناء تزويد ومسار أوفر.</p>
        </div>
        @if (s.can('voyages')) {
          <button type="button" class="btn btn-primary" [disabled]="plan().portIds.length < 2" (click)="openCreate()"><sc-icon name="route" /> إنشاء رحلة من هذا المسار</button>
        }
      </div>

      <div class="grid g-main" style="align-items:start">
        <section class="card">
          <div class="card-head"><h2>المسار</h2><button type="button" class="btn btn-sm" (click)="addStop()"><sc-icon name="plus" /> محطة</button></div>
          <div class="card-body stack">
            @for (id of route(); track $index; let i = $index) {
              <div class="row">
                <span class="badge gold" style="min-width:28px;justify-content:center">{{ i + 1 }}</span>
                <select style="flex:1" [value]="id" (change)="setStop(i, $any($event.target).value)">
                  @for (p of s.ports(); track p.id) {
                    <option [value]="p.id" [selected]="p.id === id">{{ p.name }} — {{ p.country }}</option>
                  }
                </select>
                <small class="muted" style="min-width:90px">{{ i === 0 ? 'ميناء الإبحار' : i === route().length - 1 ? 'ميناء الوصول' : 'محطة' }}</small>
                @if (route().length > 2) {
                  <button type="button" class="btn btn-sm btn-ghost btn-danger" (click)="removeStop(i)"><sc-icon name="x" /></button>
                }
              </div>
            }
            <label class="field" style="max-width:240px">
              <span>أيام الرسو في كل ميناء</span>
              <input type="number" min="0" step="0.5" [value]="daysInPort()" (input)="daysInPort.set(+$any($event.target).value || 0)" />
            </label>
            <div class="pill-note">السرعة {{ s.vessel().speedKn }} عقدة · استهلاك الإبحار {{ s.data().config.hfoTonsPerDaySea }} طن HFO/يوم (من مواصفات السفينة وأرقام التشغيل).</div>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>خريطة المسار</h2></div>
          <div class="card-body"><div #mapEl class="map sm"></div></div>
        </section>
      </div>

      <div class="kpis">
        <div class="kpi"><label>المسافة</label><strong>{{ fmt(plan().nm, 0) }} ميل</strong></div>
        <div class="kpi"><label>المدة</label><strong>{{ fmt(plan().days, 1) }} يوم</strong></div>
        <div class="kpi warn"><label>وقود مطلوب (HFO)</label><strong>{{ fmt(plan().fuelT, 0) }} طن</strong></div>
        <div class="kpi ok"><label>أفضل ميناء تزويد</label><strong>{{ plan().bestBunkerPort?.name ?? '—' }}</strong><small>{{ plan().fuelPrice ? usd(plan().fuelPrice) + '/طن' : '' }}</small></div>
        <div class="kpi"><label>تكلفة الوقود</label><strong>{{ usd(plan().fuelCost) }}</strong></div>
        <div class="kpi"><label>رسوم الموانئ</label><strong>{{ usd(plan().portCost) }}</strong></div>
        <div class="kpi gold"><label>الإجمالي التقديري</label><strong>{{ usd(plan().total) }}</strong></div>
      </div>

      @for (w of plan().warnings; track w) {
        <div class="alert warn"><sc-icon name="alert" /> {{ w }}</div>
      }

      <div class="grid g2" style="align-items:start">
        <section class="card">
          <div class="card-head"><h2>مراحل المسار</h2></div>
          <div class="card-body flush table-wrap">
            <table class="tbl">
              <thead><tr><th>من</th><th>إلى</th><th>ميل</th><th>أيام</th><th>وقود (طن)</th></tr></thead>
              <tbody>
                @for (l of plan().legs; track $index) {
                  <tr><td>{{ l.from }}</td><td>{{ l.to }}</td><td class="num">{{ fmt(l.nm, 0) }}</td><td class="num">{{ fmt(l.days, 1) }}</td><td class="num">{{ fmt(l.fuelT, 1) }}</td></tr>
                }
              </tbody>
            </table>
            @if (!plan().legs.length) { <div class="empty small">اختر ميناءين مختلفين.</div> }
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2><sc-icon name="sparkle" /> بدائل مقترحة للمسار (أرخص ← أغلى)</h2></div>
          <div class="card-body stack">
            @if (alts().length) {
              @for (a of alts(); track a.label) {
                <div class="pick-item" [class.in-cart]="a.delta < 0">
                  <div>
                    <b>{{ a.label }}</b>
                    <div class="muted small">{{ fmt(a.plan.nm, 0) }} ميل · {{ fmt(a.plan.fuelT, 0) }} طن · تزويد في {{ a.plan.bestBunkerPort?.name ?? '—' }} بسعر {{ usd(a.plan.fuelPrice) }}</div>
                  </div>
                  <div style="text-align:end">
                    <b class="num">{{ usd(a.plan.total) }}</b>
                    <div><span class="badge" [class]="'badge ' + (a.delta < 0 ? 'ok' : 'bad')">{{ a.delta < 0 ? 'يوفر ' + usd(-a.delta) : 'أغلى بـ ' + usd(a.delta) }}</span></div>
                  </div>
                </div>
              }
              <div class="pill-note">الاقتراحات = إضافة ميناء واحد بسعر وقود مختلف داخل المسار، مع احتساب المسافة الإضافية ورسوم الميناء. الميناء الأفضل للتزويد يراعي تقييم الموردين (كل نجمة أقل = عقوبة 1.5٪ على السعر).</div>
            } @else {
              <div class="empty small">لا توجد اقتراحات إضافية لهذا المسار.</div>
            }
          </div>
        </section>
      </div>

      <section class="card">
        <div class="card-head"><h2>مقارنة الموانئ والموردين (للتزويد)</h2><small>مرتبة من الأفضل (سعر معدّل بالتقييم)</small></div>
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead><tr><th>الميناء</th><th>HFO / طن</th><th>الحكم</th><th>تقييم الموردين</th><th>السعر المعدّل</th><th>رسو/يوم</th><th>الموردون</th><th></th></tr></thead>
            <tbody>
              @for (r of compare(); track r.port.id) {
                <tr [style.background]="inRoute(r.port.id) ? '#f3fafa' : null">
                  <td><b>{{ r.port.name }}</b><div class="muted small">{{ r.port.country }}</div></td>
                  <td class="num">{{ usd(r.port.hfoPrice) }}</td>
                  <td><span class="badge" [class]="'badge ' + r.tone">{{ r.verdict }}</span></td>
                  <td>{{ r.score.rating !== null ? fmt(r.score.rating, 1) + ' ★' : '—' }}</td>
                  <td class="num">{{ usd(r.score.adjusted, 0) }}</td>
                  <td class="num">{{ usd(r.port.berthPerDay) }}</td>
                  <td class="small">
                    @for (x of r.suppliers; track x.id) { <div>{{ x.company }}</div> }
                    @if (!r.suppliers.length) { — }
                  </td>
                  <td class="end tight">
                    @if (!inRoute(r.port.id)) {
                      <button type="button" class="btn btn-sm" (click)="insert(r.port.id)">إضافة للمسار</button>
                    } @else {
                      <span class="badge ok">في المسار</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>

    @if (creating) {
      <div class="modal-back" (click)="creating = false">
        <div class="modal narrow" (click)="$event.stopPropagation()">
          <div class="modal-head"><h3>إنشاء رحلة مجدولة</h3></div>
          <div class="modal-body">
            <div class="alert"><sc-icon name="route" /> {{ plan().names.join(' ← ') }}</div>
            <label class="field"><span>تاريخ الإبحار</span><input type="date" [(ngModel)]="startDate" [min]="todayIso" /></label>
            <div class="pill-note">تُحسب مواعيد الوصول من سرعة السفينة وأيام الرسو، وتُضاف رسوم كل ميناء تلقائياً، ويُعلَّم ميناء التزويد الأفضل.</div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="creating = false">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="create()">إنشاء</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ShPlanner {
  readonly s = inject(ShipStore);
  private readonly router = inject(Router);
  readonly fmt = fmt;
  readonly usd = usd;
  readonly todayIso = today();
  private readonly mapEl = viewChild<ElementRef<HTMLElement>>('mapEl');
  private map: ShipMap | null = null;

  readonly route = signal<string[]>(['dam', 'jed', 'sin']);
  readonly daysInPort = signal(1.5);
  creating = false;
  startDate = today();

  readonly plan = computed(() => planRoute(this.route(), this.s.ports(), this.s.suppliers(), this.s.vessel(), this.s.data().config, this.daysInPort()));

  readonly alts = computed<Alt[]>(() => {
    const base = this.plan();
    const ids = this.route();
    if (ids.length < 2) return [];
    const out: Alt[] = [];
    for (const p of this.s.ports()) {
      if (ids.includes(p.id) || !p.hfoPrice) continue;
      let best: Alt | null = null;
      for (let i = 1; i < ids.length; i++) {
        const next = [...ids.slice(0, i), p.id, ...ids.slice(i)];
        const plan = planRoute(next, this.s.ports(), this.s.suppliers(), this.s.vessel(), this.s.data().config, this.daysInPort());
        const alt = { label: `إضافة ${p.name} بعد ${this.nameOf(ids[i - 1])}`, plan, delta: plan.total - base.total };
        if (!best || alt.delta < best.delta) best = alt;
      }
      if (best) out.push(best);
    }
    return out.sort((a, b) => a.delta - b.delta).slice(0, 4);
  });

  readonly compare = computed(() => {
    const fuel = this.s.ports().filter((p) => p.hfoPrice > 0);
    const avg = fuel.length ? fuel.reduce((a, p) => a + p.hfoPrice, 0) / fuel.length : 0;
    return fuel
      .map((port) => {
        const score = bunkerScore(port, this.s.suppliers());
        const tone = port.hfoPrice < avg * 0.97 ? 'ok' : port.hfoPrice > avg * 1.05 ? 'bad' : 'warn';
        return {
          port,
          score,
          tone,
          verdict: tone === 'ok' ? 'رخيص' : tone === 'bad' ? 'غالي' : 'متوسط',
          suppliers: this.s.suppliers().filter((x) => x.active && (port.supplierIds.includes(x.id) || x.portIds.includes(port.id))),
        };
      })
      .sort((a, b) => a.score.adjusted - b.score.adjusted);
  });

  constructor() {
    effect(() => {
      const el = this.mapEl()?.nativeElement;
      const ports = this.s.ports();
      const ids = this.route();
      const avg = this.compare().length ? this.compare().reduce((a, r) => a + r.port.hfoPrice, 0) / this.compare().length : 0;
      if (!el) return;
      this.map ??= new ShipMap(el);
      const stops = ids.map((id, i) => ({ p: ports.find((x) => x.id === id), i })).filter((x) => x.p);
      const stopIds = new Set(ids);
      void this.map.draw(
        [
          ...stops.map((x) => ({ lat: x.p!.lat, lng: x.p!.lng, label: x.p!.name, index: x.i + 1, tone: 'navy' as const, popup: `<b>${x.p!.name}</b><br>HFO ${x.p!.hfoPrice ? '$' + x.p!.hfoPrice : '—'}` })),
          ...ports
            .filter((p) => !stopIds.has(p.id) && p.hfoPrice)
            .map((p) => ({ lat: p.lat, lng: p.lng, label: p.name, tone: p.hfoPrice < avg * 0.97 ? ('ok' as const) : p.hfoPrice > avg * 1.05 ? ('bad' as const) : ('warn' as const), popup: `<b>${p.name}</b><br>HFO $${p.hfoPrice}` })),
        ],
        [{ points: stops.map((x) => [x.p!.lat, x.p!.lng] as [number, number]) }],
      );
    });
    inject(DestroyRef).onDestroy(() => this.map?.destroy());
  }

  nameOf(id: string): string {
    return this.s.ports().find((p) => p.id === id)?.name ?? id;
  }

  inRoute(id: string): boolean {
    return this.route().includes(id);
  }

  setStop(i: number, id: string): void {
    this.route.update((r) => r.map((x, k) => (k === i ? id : x)));
  }

  addStop(): void {
    this.route.update((r) => {
      const next = this.s.ports().find((p) => !r.includes(p.id))?.id ?? r[r.length - 1];
      return [...r.slice(0, -1), next, r[r.length - 1]];
    });
  }

  removeStop(i: number): void {
    this.route.update((r) => r.filter((_, k) => k !== i));
  }

  insert(id: string): void {
    this.route.update((r) => [...r.slice(0, -1), id, r[r.length - 1]]);
  }

  openCreate(): void {
    this.startDate = today();
    this.creating = true;
  }

  create(): void {
    const plan = this.plan();
    const ports = this.s.ports();
    const stops: PortStop[] = [];
    let eta = this.startDate;
    plan.portIds.forEach((id, i) => {
      const p = ports.find((x) => x.id === id);
      if (!p) return;
      if (i > 0) eta = addDays(eta, Math.max(1, Math.ceil(plan.legs[i - 1].days)));
      const stay = Math.max(1, Math.ceil(this.daysInPort()));
      const activities: string[] = [];
      if (i === 0) activities.push('تحميل');
      if (i === plan.portIds.length - 1) activities.push('تفريغ');
      if (plan.bestBunkerPort?.id === id) activities.push('تزويد وقود');
      stops.push({
        id: uid('stop'),
        portId: id,
        eta,
        etd: addDays(eta, stay),
        activities,
        berthFee: round(p.berthPerDay * stay, 0),
        pilotFee: p.pilotage,
        canalFee: p.canal,
        agencyFee: p.agency,
        actualFda: 0,
        agent: '',
        legNm: null,
        legFuelT: null,
      });
      eta = addDays(eta, stay);
    });
    const voyage: Voyage = {
      id: this.s.nextVoyageId(),
      number: `V-${new Date().getFullYear()}-${String(this.s.voyages().length + 1).padStart(2, '0')}`,
      title: plan.names.join(' ← '),
      status: 'planned',
      startDate: this.startDate,
      endDate: stops[stops.length - 1]?.etd ?? '',
      stops,
      notes: `مخطط تلقائياً — ${Math.round(plan.nm)} ميل، وقود ${plan.fuelT} طن، تكلفة تقديرية $${plan.total}`,
    };
    this.s.saveVoyage(voyage);
    this.creating = false;
    void this.router.navigate(['/ship/voyages']);
  }
}
