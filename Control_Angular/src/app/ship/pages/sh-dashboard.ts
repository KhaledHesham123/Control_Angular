import { Component, DestroyRef, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { ShipMap } from '../core/ship-map';
import {
  certState,
  daysBetween,
  descendantIds,
  gaugeOf,
  kindGauge,
  legsOf,
  today,
  voyageCost,
  voyageFuelOutlook,
} from '../core/ship-calc';
import { certDocStatus } from '../core/ship-certs';
import { dateLabel, fmt, usd } from '../core/ship-format';
import { ShipStore } from '../core/ship-store';
import { REQ_STATUS, TANK_KIND_LABEL, TankKind, VOYAGE_STATUS_LABEL, Voyage, VoyageStatus } from '../core/ship.types';

const KINDS: { kind: TankKind; icon: string; unit: string }[] = [
  { kind: 'hfo', icon: 'fuel', unit: 'طن' },
  { kind: 'mgo', icon: 'bolt', unit: 'طن' },
  { kind: 'lube', icon: 'wrench', unit: 'طن' },
  { kind: 'water', icon: 'water', unit: 'طن' },
];

const POWER_LABEL: Record<string, string> = {
  aux_gen: 'مولدات الديزل المساعدة',
  shaft_gen: 'مولد العمود (Shaft Generator)',
  shore_power: 'كهرباء الرصيف (Shore Power)',
};

@Component({
  selector: 'sh-dashboard',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>لوحة المتابعة — {{ s.vessel().name }}</h1>
          <p>صورة كاملة لحال السفينة: المخزون، الوقود، الرحلة الجارية، والطلبات اللي محتاجة قرار.</p>
        </div>
        <div class="actions">
          @if (s.can('request')) {
            <a class="btn btn-primary" routerLink="/ship/requests/new"><sc-icon name="plus" /> طلب شراء جديد</a>
          }
          @if (s.can('issue')) {
            <a class="btn" routerLink="/ship/stores"><sc-icon name="up" /> صرف من المخزن</a>
          }
          @if (s.can('daily')) {
            <a class="btn" routerLink="/ship/daily"><sc-icon name="clock" /> التقرير اليومي</a>
          }
        </div>
      </div>

      <div class="kpis">
        <div class="kpi">
          <label>الطاقم على السفينة</label>
          <strong>{{ s.crewOnBoard().length }}</strong>
          <small>{{ onLeave() }} في إجازة</small>
        </div>
        <div class="kpi ok">
          <label>الرحلة الجارية</label>
          <strong>{{ s.activeVoyage()?.number ?? 'لا يوجد' }}</strong>
          <small>{{ s.activeVoyage() ? 'اليوم ' + voyageDay() : 'السفينة غير مسافرة حالياً' }}</small>
        </div>
        <div class="kpi" [class.warn]="actionable().length > 0">
          <label>طلبات محتاجة إجراء</label>
          <strong>{{ actionable().length }}</strong>
          <small>{{ s.can('review') ? 'مراجعة / عروض / اعتماد' : 'بانتظار الاستلام أو الإرسال' }}</small>
        </div>
        <div class="kpi" [class.bad]="low().length > 0">
          <label>أصناف تحت الحد الأدنى</label>
          <strong>{{ low().length }}</strong>
          <small>من {{ activeProducts() }} صنف</small>
        </div>
        @if (s.can('costs')) {
          <div class="kpi gold">
            <label>تكلفة الرحلة حتى الآن</label>
            <strong>{{ cost() ? usd(cost()!.total) : '—' }}</strong>
            <small>مشتريات + وقود + موانئ + رواتب</small>
          </div>
        } @else {
          <div class="kpi gold">
            <label>الطلبات اللي في الطريق</label>
            <strong>{{ s.requests().filter(isInbound).length }}</strong>
            <small>معتمدة وبانتظار التوريد</small>
          </div>
        }
      </div>

      <section class="card">
        <div class="card-head">
          <h2>الهيكل ثلاثي الأبعاد</h2>
          <small>{{ hullName() }} · IMO {{ hullImo() }}</small>
        </div>
        <div class="card-body flush">
          <sh-viewer
            [name]="hullName()"
            [imo]="hullImo()"
            [loa]="s.vessel().loa"
            [beam]="s.vessel().beam"
            [draft]="s.vessel().draft" />
        </div>
      </section>

      <div class="grid g-main">
        <section class="card">
          <div class="card-head">
            <h2>الوقود والزيوت — خزان واحد لكل نوع</h2>
            <a class="btn btn-sm" routerLink="/ship/tanks">تفاصيل الخزانات</a>
          </div>
          <div class="card-body stack">
            @for (k of kinds(); track k.kind) {
              @if (k.kind === 'lube' && oils().length) {
                @for (t of oils(); track t.id) {
                  <div class="tank-card">
                    <div class="between row">
                      <span class="row"><sc-icon name="wrench" /> <b>{{ t.name }}</b></span>
                      <span class="badge" [class]="'badge ' + tankGauge(t.current, t.max).tone">{{ fmt(tankGauge(t.current, t.max).percent, 0) }}%</span>
                    </div>
                    <div class="between row">
                      <span class="value"><span class="num">{{ fmt(t.current, 0) }}</span> <small class="muted">/ {{ fmt(t.max, 0) }} لتر</small></span>
                      <span class="muted small">بداية الرحلة {{ fmt(t.opening ?? 0, 0) }}</span>
                    </div>
                    <div class="gauge" [class]="'gauge ' + tankGauge(t.current, t.max).tone"><i [style.width.%]="tankGauge(t.current, t.max).percent"></i></div>
                  </div>
                }
              } @else {
              <div class="tank-card">
                <div class="between row">
                  <span class="row"><sc-icon [name]="k.icon" /> <b>{{ k.label }}</b></span>
                  <span class="badge" [class]="'badge ' + k.g.tone">{{ k.g.tone === 'ok' ? 'كافٍ' : k.g.tone === 'warn' ? 'يحتاج تخطيط' : 'منخفض' }}</span>
                </div>
                <div class="between row">
                  <span class="value"><span class="num">{{ fmt(k.g.current, 1) }}</span> <small class="muted">/ {{ fmt(k.g.max, 0) }} {{ k.unit }}</small></span>
                  <span class="muted small">
                    @if (k.outlook.expected !== null) {
                      المتوقع للرحلة <b class="num">{{ fmt(k.outlook.expected, 1) }}</b> طن خلال {{ fmt(k.outlook.spanDays, 0) }} يوم
                      · المعدل <b class="num">{{ fmt(k.outlook.rate, 2) }}</b> طن/يوم
                      @if (k.outlook.lasts !== null) {
                        · الكمية تكفي <b class="num">{{ fmt(k.outlook.lasts, 0) }}</b> يوم
                      }
                    } @else if (k.outlook.lasts !== null) {
                      يكفي تقريباً <b class="num">{{ fmt(k.outlook.lasts, 0) }}</b> يوم · الاستهلاك {{ fmt(k.outlook.rate, 2) }} {{ k.unit }}/يوم
                    } @else {
                      بدون استهلاك مسجل
                    }
                  </span>
                </div>
                <div class="gauge" [class]="'gauge ' + k.g.tone"><i [style.width.%]="k.g.percent"></i></div>
                @if (k.outlook.coversVoyage === false) {
                  <div class="alert bad">الكمية الحالية لا تغطي باقي الرحلة حسب معدل الاستهلاك المتوقع.</div>
                }
              </div>
              }
            }
          </div>
        </section>

        <div class="stack">
          <section class="card">
            <div class="card-head"><h2>الكهرباء والطاقة</h2></div>
            <div class="card-body stack">
              <dl class="kv">
                <dt>مصدر الطاقة</dt><dd>{{ power() }}</dd>
                <dt>وضع السفينة</dt><dd>{{ s.data().config.mode === 'sea' ? 'في البحر' : 'في الميناء' }}</dd>
                <dt>استهلاك الديزل</dt><dd><span class="num">{{ fmt(mgoBurn(), 2) }}</span> طن/يوم</dd>
              </dl>
              <div class="chips">
                @for (g of s.data().config.generators; track g.id) {
                  <span class="badge info"><sc-icon name="bolt" /> {{ g.name }} · {{ g.defaultHours }} ساعة/يوم</span>
                }
              </div>
            </div>
          </section>

          <section class="card">
            <div class="card-head">
              <h2>الإعاشة والمؤن</h2>
              <a class="btn btn-sm" routerLink="/ship/stores">المخزن</a>
            </div>
            <div class="card-body stack">
              @for (f of food(); track f.id) {
                <div class="gauge-row">
                  <div class="top"><span>{{ f.name }}</span><b class="num">{{ fmt(f.stock, 1) }} {{ f.unit }}</b></div>
                  <div class="gauge" [class]="'gauge ' + f.g.tone"><i [style.width.%]="f.g.percent"></i></div>
                </div>
              }
              @if (!food().length) {
                <div class="empty">لا توجد أصناف إعاشة.</div>
              }
            </div>
          </section>
        </div>
      </div>

      <div class="grid g2">
        <section class="card">
          <div class="card-head">
            <h2>الرحلة الجارية</h2>
            <a class="btn btn-sm" routerLink="/ship/voyages">كل الرحلات</a>
          </div>
          <div class="card-body stack">
            @if (s.activeVoyage(); as v) {
              <div class="between row">
                <div><b>{{ v.title }}</b><div class="muted small">{{ v.number }} · بدأت {{ dateLabel(v.startDate) }}</div></div>
                @if (s.can('voyages')) {
                  <label class="field" style="min-width: 160px; margin: 0">
                    <span>حالة الرحلة</span>
                    <select [ngModel]="v.status" (ngModelChange)="changeStatus(v, $event)">
                      @for (st of voyageStatuses; track st.id) {
                        <option [value]="st.id">{{ st.label }}</option>
                      }
                    </select>
                  </label>
                } @else {
                  <span class="badge ok">جارية</span>
                }
              </div>
              <div class="chips">
                @for (st of v.stops; track st.id; let i = $index) {
                  <span class="badge" [class.gold]="st.id === next()?.id">{{ i + 1 }}. {{ portName(st.portId) }} · {{ dateLabel(st.eta) }}</span>
                }
              </div>
              @if (next(); as n) {
                <div class="alert"><sc-icon name="anchor" /> الميناء القادم: <b>{{ portName(n.portId) }}</b> — {{ dateLabel(n.eta) }}</div>
              }
              @if (s.can('costs') && cost(); as c) {
                <div class="bar-split">
                  <i style="background:#167a82" [style.width.%]="pct(c.purchases)"></i>
                  <i style="background:#d4a857" [style.width.%]="pct(c.bunker)"></i>
                  <i style="background:#2b6cb0" [style.width.%]="pct(c.port)"></i>
                  <i style="background:#6b4fb3" [style.width.%]="pct(c.crew)"></i>
                  <i style="background:#9aa7b0" [style.width.%]="pct(c.other)"></i>
                </div>
                <div class="legend">
                  <span><b style="background:#167a82"></b>مشتريات {{ usd(c.purchases) }}</span>
                  <span><b style="background:#d4a857"></b>وقود {{ usd(c.bunker) }}</span>
                  <span><b style="background:#2b6cb0"></b>موانئ {{ usd(c.port) }}</span>
                  <span><b style="background:#6b4fb3"></b>رواتب {{ usd(c.crew) }}</span>
                </div>
              }
            } @else {
              <div class="empty"><sc-icon name="route" /> لا توجد رحلة جارية. ابدأ رحلة من صفحة الرحلات.</div>
            }
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <h2>الموقع والمسار</h2>
            <small>{{ s.vessel().location }}</small>
          </div>
          <div class="card-body"><div #mapEl class="map sm"></div></div>
        </section>
      </div>

      <div class="grid g2">
        <section class="card">
          <div class="card-head">
            <h2>طلبات تنتظر إجراء</h2>
            <a class="btn btn-sm" routerLink="/ship/requests">كل الطلبات</a>
          </div>
          <div class="card-body flush table-wrap">
            @if (actionable().length) {
              <table class="tbl">
                <tbody>
                  @for (r of actionable(); track r.id) {
                    <tr>
                      <td><a [routerLink]="['/ship/requests', r.id]"><b>{{ r.no }}</b></a><div class="muted small">{{ r.createdBy }} · {{ dateLabel(r.createdAt) }}</div></td>
                      <td><span class="badge" [class]="'badge ' + st(r.status).tone">{{ st(r.status).label }}</span></td>
                      <td class="end"><a class="btn btn-sm" [routerLink]="['/ship/requests', r.id]">فتح</a></td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <div class="empty"><sc-icon name="check" /> مفيش طلبات محتاجة إجراء دلوقتي.</div>
            }
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>تنبيهات</h2></div>
          <div class="card-body stack">
            @for (a of alerts(); track a.text) {
              <div class="alert" [class]="'alert ' + a.tone"><sc-icon [name]="a.icon" /> <span>{{ a.text }}</span></div>
            }
            @if (!alerts().length) {
              <div class="empty"><sc-icon name="shield" /> لا توجد تنبيهات.</div>
            }
          </div>
        </section>
      </div>
    </div>
  `,
})
export class ShDashboard {
  readonly s = inject(ShipStore);
  readonly voyageStatuses = (Object.keys(VOYAGE_STATUS_LABEL) as VoyageStatus[]).map((id) => ({ id, label: VOYAGE_STATUS_LABEL[id] }));
  readonly isInbound = (r: { status: string }): boolean => r.status === 'approved';
  readonly usd = usd;
  readonly fmt = fmt;
  readonly dateLabel = dateLabel;
  private readonly mapEl = viewChild<ElementRef<HTMLElement>>('mapEl');
  private map: ShipMap | null = null;

  changeStatus(v: Voyage, status: VoyageStatus): void {
    if (v.status === status) return;
    this.s.setVoyageStatus(v.id, status);
  }

  readonly onLeave = computed(() => this.s.crew().filter((c) => c.status === 'OnLeave').length);
  readonly activeProducts = computed(() => this.s.products().filter((p) => p.active).length);
  readonly hullName = computed(() => (this.s.vessel().id ? this.s.vessel().name : 'AMANY QUEEN'));
  readonly hullImo = computed(() => (this.s.vessel().id ? this.s.vessel().imo : '8318128'));

  readonly low = computed(() => {
    const stock = this.s.data().stock;
    return this.s.products().filter((p) => p.active && p.minLevel > 0 && (stock[p.id] ?? 0) < p.minLevel);
  });

  readonly oils = computed(() => this.s.tanks().filter((tank) => tank.unit === 'لتر'));
  readonly tankGauge = gaugeOf;

  readonly kinds = computed(() => {
    const tanks = this.s.tanks();
    const crew = this.s.crewOnBoard().length;
    const voyage = this.s.activeVoyage();
    const config = this.s.data().config;
    return KINDS.map((k) => {
      const g = kindGauge(tanks, k.kind);
      const outlook = voyageFuelOutlook(k.kind, g.current, voyage, config, crew);
      return { ...k, label: TANK_KIND_LABEL[k.kind], g, outlook };
    }).filter((k) => k.g.max > 0 || (k.kind === 'lube' && this.oils().length > 0));
  });

  readonly food = computed(() => {
    const ids = new Set(descendantIds('c-kitchen', this.s.categories()));
    const stock = this.s.data().stock;
    return this.s
      .products()
      .filter((p) => p.active && ids.has(p.categoryId) && p.minLevel > 0)
      .map((p) => ({ id: p.id, name: p.name, unit: p.unit, stock: stock[p.id] ?? 0, g: gaugeOf(stock[p.id] ?? 0, p.minLevel * 2.5) }))
      .sort((a, b) => a.g.percent - b.g.percent)
      .slice(0, 6);
  });

  readonly cost = computed(() => {
    const v = this.s.activeVoyage();
    return v ? voyageCost(v, this.s.data(), this.s.categories()) : null;
  });

  readonly actionable = computed(() => {
    const reqs = this.s.requests();
    if (this.s.can('review')) {
      return reqs.filter((r) => ['submitted', 'ready', 'sent', 'offers'].includes(r.status)).slice(0, 6);
    }
    return reqs.filter((r) => r.status === 'approved' || r.status === 'draft').slice(0, 6);
  });

  readonly next = computed(() => this.s.activeVoyage()?.stops.find((st) => st.eta >= today()) ?? null);

  readonly alerts = computed(() => {
    const out: { text: string; tone: string; icon: string }[] = [];
    for (const k of this.kinds()) {
      if (k.outlook.coversVoyage === false) out.push({ text: `${k.label}: الكمية لا تغطي باقي الرحلة`, tone: 'bad', icon: 'alert' });
      else if (k.g.tone === 'bad' && k.g.max > 0) out.push({ text: `${k.label}: المتبقي ${fmt(k.g.current, 1)} طن فقط`, tone: 'bad', icon: 'alert' });
      else if (k.outlook.lasts !== null && k.outlook.lasts < 8) out.push({ text: `${k.label} يكفي ${fmt(k.outlook.lasts, 0)} أيام تقريباً`, tone: 'warn', icon: 'alert' });
    }
    if (this.low().length) out.push({ text: `${this.low().length} صنف تحت الحد الأدنى — جهّز طلب شراء`, tone: 'warn', icon: 'cart' });
    const certs = this.s.data().certificates;
    const expired = certs.filter((c) => certDocStatus(c).key === 'expired');
    const soon = certs.filter((c) => certDocStatus(c).key === 'soon');
    if (expired.length) {
      out.push({ text: `${expired.length} شهادة منتهية: ${expired.slice(0, 3).map((c) => c.title).join('، ')}${expired.length > 3 ? '…' : ''}`, tone: 'bad', icon: 'shield' });
    }
    if (soon.length) {
      out.push({ text: `${soon.length} شهادة تنتهي خلال 3 شهور: ${soon.slice(0, 3).map((c) => c.title).join('، ')}${soon.length > 3 ? '…' : ''}`, tone: 'warn', icon: 'shield' });
    }
    for (const m of this.s.crewOnBoard()) {
      for (const c of m.certs) {
        const st = certState(c.expiry);
        if (st.tone === 'bad') out.push({ text: `${m.name} — ${c.name}: ${st.label}`, tone: 'bad', icon: 'users' });
      }
    }
    return out.slice(0, 8);
  });

  constructor() {
    effect(() => {
      const el = this.mapEl()?.nativeElement;
      const vessel = this.s.vessel();
      const voyage = this.s.activeVoyage();
      const ports = this.s.ports();
      if (!el) return;
      this.map ??= new ShipMap(el);
      const stops = (voyage?.stops ?? []).map((st, i) => ({ st, p: ports.find((p) => p.id === st.portId), i })).filter((x) => x.p);
      void this.map.draw(
        [
          ...stops.map((x) => ({ lat: x.p!.lat, lng: x.p!.lng, label: x.p!.name, index: x.i + 1, tone: 'navy' as const, popup: `<b>${x.p!.name}</b><br>ETA ${x.st.eta}` })),
          ...(vessel.id ? [{ lat: vessel.lat, lng: vessel.lng, label: vessel.name, tone: 'gold' as const, popup: `<b>${vessel.name}</b><br>${vessel.location}` }] : []),
        ],
        [{ points: stops.map((x) => [x.p!.lat, x.p!.lng] as [number, number]) }],
      );
    });
    inject(DestroyRef).onDestroy(() => this.map?.destroy());
  }

  readonly power = computed(() => POWER_LABEL[this.s.data().config.power] ?? '—');
  readonly mgoBurn = computed(() => this.kinds().find((k) => k.kind === 'mgo')?.outlook.rate ?? 0);

  voyageDay(): number {
    const v = this.s.activeVoyage();
    return v ? Math.max(1, daysBetween(v.startDate, today()) + 1) : 0;
  }

  st(status: keyof typeof REQ_STATUS) {
    return REQ_STATUS[status];
  }

  portName(id: string): string {
    return this.s.ports().find((p) => p.id === id)?.name ?? '—';
  }

  pct(value: number): number {
    const c = this.cost();
    return c && c.total > 0 ? (value / c.total) * 100 : 0;
  }
}
