import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { addDays, daysBetween, legsOf, num, round, stopFees, suggestVoyageConsumption, today, uid, voyageCost, voyageExpectedTons, voyageFuelOutlook, voyageRevenue, voyageSpanDays } from '../core/ship-calc';
import { dateLabel, fmt, usd } from '../core/ship-format';
import { ShipMap } from '../core/ship-map';
import { ShipStore } from '../core/ship-store';
import { CONSUMPTION_KINDS, ConsumptionKind, PortStop, STOP_ACTIVITIES, VOYAGE_STATUS_LABEL, Voyage, VoyageConsumption, VoyageStatus } from '../core/ship.types';

const COLORS = ['#167a82', '#d4a857', '#2b6cb0', '#6b4fb3', '#1b8a5a', '#c0392b', '#9aa7b0'];

@Component({
  selector: 'sh-voyages',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>الرحلات وتكلفتها</h1>
          <p>
            كل رحلة لها ميناء إبحار ووصول ومحطات (رسو وتزويد). تكلفة الرحلة = مشتريات معتمدة من عروض الموردين + وقود + رسوم موانئ + رواتب الطاقم + مصروفات أخرى.
          </p>
        </div>
        @if (s.can('voyages')) {
          <button type="button" class="btn btn-primary" (click)="openEdit()"><sc-icon name="plus" /> رحلة جديدة</button>
        }
      </div>

      <div class="grid" style="grid-template-columns: 300px minmax(0, 1fr); align-items: start">
        <section class="card">
          <div class="card-head"><h3>الرحلات ({{ s.voyages().length }})</h3></div>
          <div class="card-body stack">
            @for (v of list(); track v.id) {
              <button type="button" class="pick-item" style="text-align:start;cursor:pointer;width:100%" [class.in-cart]="v.id === current()?.id" (click)="selected.set(v.id)">
                <div>
                  <b>{{ v.number }}</b> <span class="badge" [class]="'badge ' + statusTone(v.status)">{{ statusLabel(v.status) }}</span>
                  <div class="small">{{ v.title }}</div>
                  <div class="muted small">{{ dateLabel(v.startDate) }} ← {{ v.endDate ? dateLabel(v.endDate) : 'مستمرة' }}</div>
                </div>
                @if (s.can('costs')) {
                  <b class="num">{{ usd(totalOf(v)) }}</b>
                }
              </button>
            }
            @if (!list().length) {
              <div class="empty"><sc-icon name="route" /> لا توجد رحلات.</div>
            }
          </div>
        </section>

        @if (current(); as v) {
          <div class="stack" style="gap:16px">
            <section class="card">
              <div class="card-head">
                <div>
                  <h2>{{ v.title }}</h2>
                  <small>{{ v.number }} · {{ dateLabel(v.startDate) }} ← {{ v.endDate ? dateLabel(v.endDate) : 'مستمرة' }}</small>
                </div>
                <div class="actions">
                  <span class="badge" [class]="'badge ' + statusTone(v.status)">{{ statusLabel(v.status) }}</span>
                  @if (s.can('voyages')) {
                    @if (v.status === 'planned') {
                      <button type="button" class="btn btn-sm btn-primary" (click)="s.setVoyageStatus(v.id, 'active')"><sc-icon name="route" /> بدء الرحلة</button>
                    }
                    @if (v.status === 'active') {
                      <button type="button" class="btn btn-sm btn-primary" (click)="s.setVoyageStatus(v.id, 'completed')"><sc-icon name="check" /> إنهاء الرحلة</button>
                    }
                    <button type="button" class="btn btn-sm" (click)="openEdit(v)"><sc-icon name="edit" /> تعديل المسار</button>
                    <button type="button" class="btn btn-sm btn-danger" (click)="remove(v)"><sc-icon name="trash" /></button>
                  }
                </div>
              </div>
              <div class="card-body stack">
                <div class="kpis">
                  <div class="kpi"><label>المدة</label><strong>{{ cost()?.days ?? 0 }} يوم</strong></div>
                  <div class="kpi"><label>المسافة</label><strong>{{ fmt(totalNm(), 0) }} ميل</strong><small>وقود تقديري {{ fmt(totalFuel(), 0) }} طن</small></div>
                  @if (s.can('costs')) {
                    <div class="kpi gold"><label>إجمالي التكلفة</label><strong>{{ usd(cost()?.total ?? 0) }}</strong></div>
                    <div class="kpi ok"><label>الإيراد (نولون)</label><strong>{{ usd(revenue()) }}</strong></div>
                    <div class="kpi" [class.bad]="revenue() - (cost()?.total ?? 0) < 0" [class.ok]="revenue() - (cost()?.total ?? 0) >= 0">
                      <label>الصافي</label><strong>{{ usd(revenue() - (cost()?.total ?? 0)) }}</strong>
                    </div>
                  }
                </div>
                @if (v.notes) { <div class="hint">{{ v.notes }}</div> }
              </div>
            </section>

            <section class="card">
              <div class="card-head"><h3>خط السير (الموانئ والمراحل)</h3></div>
              <div class="card-body"><div #mapEl class="map sm"></div></div>
              <div class="card-body flush table-wrap">
                <table class="tbl">
                  <thead><tr><th>#</th><th>الميناء</th><th>الوصول</th><th>المغادرة</th><th>المرحلة السابقة</th><th>الأنشطة</th><th>رسوم الميناء</th></tr></thead>
                  <tbody>
                    @for (st of v.stops; track st.id; let i = $index) {
                      <tr>
                        <td>{{ i + 1 }}</td>
                        <td><b>{{ portName(st.portId) }}</b>@if (st.agent) { <div class="muted small">وكيل: {{ st.agent }}</div> }</td>
                        <td>{{ dateLabel(st.eta) }}</td>
                        <td>{{ dateLabel(st.etd) }}</td>
                        <td class="small">
                          @if (legAt(i); as l) {
                            <span class="num">{{ fmt(l.nm, 0) }}</span> ميل · {{ fmt(l.days, 1) }} يوم · {{ fmt(l.fuelT, 0) }} طن
                          } @else { — }
                        </td>
                        <td>
                          <div class="chips">
                            @for (a of st.activities; track a) {
                              <span class="badge" [class]="'badge ' + (a === 'تزويد وقود' ? 'gold' : 'muted')">{{ a }}</span>
                            }
                          </div>
                        </td>
                        <td class="num">
                          {{ usd(fees(st)) }}
                          @if (st.actualFda > 0) { <span class="badge ok">فعلي</span> } @else { <span class="badge muted">تقديري</span> }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
                @if (!v.stops.length) {
                  <div class="empty">لم تُضف محطات بعد — اضغط «تعديل المسار».</div>
                }
              </div>
            </section>

            <section class="card">
              <div class="card-head"><h3>معدل الاستهلاك المتوقع للرحلة</h3></div>
              <div class="card-body stack">
                <p class="muted small">من أول يوم في الرحلة حتى آخر يوم. المعدل اليومي = الكمية المتوقعة ÷ مدة الرحلة، وكمية الخزان تتقاس على هذا المعدل.</p>
                <div class="kpis">
                  @for (row of fuelRows(v); track row.kind) {
                    <div class="kpi" [class.bad]="row.covers === false" [class.ok]="row.covers === true">
                      <label>{{ row.label }}</label>
                      <strong class="num">{{ fmt(row.expected, 1) }} طن</strong>
                      <small>{{ fmt(row.rate, 2) }} طن/يوم · الخزان يكفي {{ row.lasts === null ? '—' : fmt(row.lasts, 0) + ' يوم' }}</small>
                    </div>
                  }
                </div>
              </div>
            </section>

            @if (s.can('costs')) {
              <div class="grid g2">
                <section class="card">
                  <div class="card-head"><h3>توزيع التكلفة</h3></div>
                  <div class="card-body stack">
                    @if (cost(); as c) {
                      <div class="bar-split">
                        @for (p of parts(); track p.label) {
                          <i [style.background]="p.color" [style.width.%]="c.total > 0 ? (p.value / c.total) * 100 : 0"></i>
                        }
                      </div>
                      <table class="tbl">
                        <tbody>
                          @for (p of parts(); track p.label) {
                            <tr>
                              <td><span class="legend"><span><b [style.background]="p.color"></b>{{ p.label }}</span></span></td>
                              <td class="end num">{{ usd(p.value) }}</td>
                              <td class="end muted small">{{ c.total > 0 ? fmt((p.value / c.total) * 100, 0) : 0 }}%</td>
                            </tr>
                          }
                        </tbody>
                        <tfoot><tr><td>الإجمالي</td><td class="end num">{{ usd(c.total) }}</td><td></td></tr></tfoot>
                      </table>
                      @if (c.committed > 0) {
                        <div class="pill-note">منها {{ usd(c.committed) }} مشتريات معتمدة لم تُستلم بعد.</div>
                      }
                    }
                  </div>
                </section>

                <section class="card">
                  <div class="card-head">
                    <h3>مصروفات أخرى</h3>
                    @if (s.can('costs')) {
                      <button type="button" class="btn btn-sm" (click)="openExpense()"><sc-icon name="plus" /> مصروف</button>
                    }
                  </div>
                  <div class="card-body flush table-wrap">
                    <table class="tbl">
                      <tbody>
                        @for (e of expenses(); track e.id) {
                          <tr>
                            <td>{{ e.label }}<div class="muted small">{{ dateLabel(e.date) }} {{ e.note }}</div></td>
                            <td class="end num">{{ usd(e.amount) }}</td>
                            <td class="end tight"><button type="button" class="btn btn-sm btn-ghost btn-danger" (click)="s.deleteExpense(e.id)"><sc-icon name="trash" /></button></td>
                          </tr>
                        }
                      </tbody>
                    </table>
                    @if (!expenses().length) { <div class="empty small">لا توجد مصروفات إضافية.</div> }
                  </div>
                </section>
              </div>
            }

            <section class="card">
              <div class="card-head"><h3>طلبات الشراء في هذه الرحلة</h3></div>
              <div class="card-body flush table-wrap">
                <table class="tbl">
                  <tbody>
                    @for (r of linked(); track r.id) {
                      <tr>
                        <td><a [routerLink]="['/ship/requests', r.id]"><b>{{ r.no }}</b></a></td>
                        <td>{{ dateLabel(r.createdAt) }}</td>
                        <td>{{ r.createdBy }}</td>
                        <td>{{ r.lines.length }} بند</td>
                      </tr>
                    }
                  </tbody>
                </table>
                @if (!linked().length) { <div class="empty small">لا توجد طلبات مرتبطة.</div> }
              </div>
            </section>
          </div>
        } @else {
          <div class="card"><div class="empty"><sc-icon name="route" /> اختر رحلة من القائمة.</div></div>
        }
      </div>
    </div>

    @if (form) {
      <div class="modal-back" (click)="form = null">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="modal-head"><h3>{{ isNew ? 'رحلة جديدة' : 'تعديل الرحلة ومسارها' }}</h3><button type="button" class="btn btn-sm btn-ghost" (click)="form = null"><sc-icon name="x" /></button></div>
          <div class="modal-body">
            <div class="form-grid">
              <label class="field"><span>رقم الرحلة</span><input type="text" [(ngModel)]="form.number" /></label>
              <label class="field wide"><span>العنوان</span><input type="text" [(ngModel)]="form.title" placeholder="مثال: دمياط ← جدة ← سنغافورة" /></label>
              <label class="field">
                <span>الحالة</span>
                <select [(ngModel)]="form.status">
                  @for (st of statuses; track st.id) {
                    <option [value]="st.id">{{ st.label }}</option>
                  }
                </select>
              </label>
              <label class="field"><span>تاريخ البداية</span><input type="date" [(ngModel)]="form.startDate" /></label>
              <label class="field"><span>تاريخ النهاية</span><input type="date" [(ngModel)]="form.endDate" /></label>
              <label class="field"><span>عدد أيام الرحلة</span><input type="number" min="1" step="1" [ngModel]="formSpan()" (ngModelChange)="setSpan($event)" /></label>
              <div class="field wide">
                <span>الاستهلاك المتوقع لهذه الرحلة فقط (طن) — مدة الرحلة {{ formSpan() }} يوم. المعدل الثابت للسفينة لا يتغير من هنا.</span>
                @for (row of form.consumptions ?? []; track row.kind) {
                  <div class="row">
                    <b>{{ consumptionLabel(row.kind) }}</b>
                    <input type="number" min="0" step="any" [(ngModel)]="row.quantity" (change)="persistConsumption(row)" />
                    <button type="button" class="btn btn-sm btn-ghost" (click)="removeConsumption(row.kind)" aria-label="حذف"><sc-icon name="trash" /></button>
                  </div>
                }
                <div class="row">
                  <button type="button" class="btn btn-sm btn-primary" (click)="addConsumption()" [disabled]="!nextConsumption()"><sc-icon name="plus" /> إضافة نوع</button>
                  <button type="button" class="btn btn-sm" (click)="fillConsumption()">احسب من مدة الرحلة وأرقام التشغيل</button>
                </div>
              </div>
              <label class="field wide"><span>ملاحظات</span><input type="text" [(ngModel)]="form.notes" /></label>
            </div>

            <div class="between row">
              <h4>المحطات</h4>
              <button type="button" class="btn btn-sm btn-primary" (click)="addStop()"><sc-icon name="plus" /> إضافة ميناء</button>
            </div>
            @for (st of form.stops; track st.id; let i = $index) {
              <div class="card">
                <div class="card-body stack">
                  <div class="row between">
                    <b>محطة {{ i + 1 }}</b>
                    <div class="row">
                      <button type="button" class="btn btn-sm" [disabled]="i === 0" (click)="move(i, -1)">↑</button>
                      <button type="button" class="btn btn-sm" [disabled]="i === form.stops.length - 1" (click)="move(i, 1)">↓</button>
                      <button type="button" class="btn btn-sm btn-danger" (click)="form.stops.splice(i, 1)"><sc-icon name="trash" /></button>
                    </div>
                  </div>
                  <div class="form-grid">
                    <label class="field">
                      <span>الميناء</span>
                      <select [(ngModel)]="st.portId" (ngModelChange)="fill(st)">
                        @for (p of s.ports(); track p.id) {
                          <option [value]="p.id">{{ p.name }}</option>
                        }
                      </select>
                    </label>
                    <label class="field"><span>الوصول (ETA)</span><input type="date" [(ngModel)]="st.eta" /></label>
                    <label class="field"><span>المغادرة (ETD)</span><input type="date" [(ngModel)]="st.etd" /></label>
                    <label class="field"><span>الوكيل الملاحي</span><input type="text" [(ngModel)]="st.agent" /></label>
                    <label class="field"><span>مسافة المرحلة (ميل) — اختياري</span><input type="number" min="0" [(ngModel)]="st.legNm" placeholder="تلقائي" /></label>
                  </div>
                  <div class="chips">
                    @for (a of activities; track a) {
                      <button type="button" class="chip" [class.on]="st.activities.includes(a)" (click)="toggleAct(st, a)">{{ a }}</button>
                    }
                  </div>
                  <div class="form-grid">
                    <label class="field"><span>رسو</span><input type="number" min="0" [(ngModel)]="st.berthFee" /></label>
                    <label class="field"><span>إرشاد</span><input type="number" min="0" [(ngModel)]="st.pilotFee" /></label>
                    <label class="field"><span>قناة / عبور</span><input type="number" min="0" [(ngModel)]="st.canalFee" /></label>
                    <label class="field"><span>وكالة</span><input type="number" min="0" [(ngModel)]="st.agencyFee" /></label>
                    <label class="field"><span>FDA الفعلي (يلغي التقديري)</span><input type="number" min="0" [(ngModel)]="st.actualFda" /></label>
                    <div class="field"><span>إجمالي الرسوم</span><b class="num">{{ usd(fees(st)) }}</b>
                      <button type="button" class="btn btn-sm btn-ghost" (click)="fill(st)">احسب من بيانات الميناء</button></div>
                  </div>
                </div>
              </div>
            }
            @if (!form.stops.length) {
              <div class="empty">أضف ميناء الإبحار ثم المحطات ثم ميناء الوصول.</div>
            }
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="form = null">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="save()"><sc-icon name="check" /> حفظ الرحلة</button>
          </div>
        </div>
      </div>
    }

    @if (exp) {
      <div class="modal-back" (click)="exp = null">
        <div class="modal narrow" (click)="$event.stopPropagation()">
          <div class="modal-head"><h3>مصروف على الرحلة</h3></div>
          <div class="modal-body">
            <label class="field"><span>البيان</span><input type="text" [(ngModel)]="exp.label" placeholder="مثال: تأمين، غرامة، استشارات…" /></label>
            <label class="field"><span>المبلغ (USD)</span><input type="number" min="0" [(ngModel)]="exp.amount" /></label>
            <label class="field"><span>التاريخ</span><input type="date" [(ngModel)]="exp.date" /></label>
            <label class="field"><span>ملاحظة</span><input type="text" [(ngModel)]="exp.note" /></label>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="exp = null">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="saveExpense()">حفظ</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ShVoyages {
  readonly s = inject(ShipStore);
  readonly usd = usd;
  readonly fmt = fmt;
  readonly dateLabel = dateLabel;
  readonly activities = STOP_ACTIVITIES;
  readonly statuses = (Object.keys(VOYAGE_STATUS_LABEL) as VoyageStatus[]).map((id) => ({ id, label: VOYAGE_STATUS_LABEL[id] }));
  readonly selected = signal<number | null>(null);
  private readonly mapEl = viewChild<ElementRef<HTMLElement>>('mapEl');
  private map: ShipMap | null = null;

  form: Voyage | null = null;
  isNew = false;
  exp: { label: string; amount: number; date: string; note: string } | null = null;

  readonly list = computed(() => [...this.s.voyages()].sort((a, b) => b.startDate.localeCompare(a.startDate)));
  readonly current = computed(() => this.s.voyages().find((v) => v.id === this.selected()) ?? this.s.activeVoyage() ?? this.list()[0] ?? null);
  readonly cost = computed(() => {
    const v = this.current();
    return v ? voyageCost(v, this.s.data(), this.s.categories()) : null;
  });
  readonly revenue = computed(() => {
    const v = this.current();
    return v ? voyageRevenue(v, this.s.data()) : 0;
  });
  readonly legs = computed(() => {
    const v = this.current();
    return v ? legsOf(v, this.s.ports(), this.s.vessel().speedKn, this.s.data().config.hfoTonsPerDaySea) : [];
  });
  readonly totalNm = computed(() => this.legs().reduce((a, l) => a + l.nm, 0));
  readonly totalFuel = computed(() => this.legs().reduce((a, l) => a + l.fuelT, 0));
  readonly expenses = computed(() => this.s.data().expenses.filter((e) => e.voyageId === this.current()?.id));
  readonly linked = computed(() => this.s.requests().filter((r) => r.voyageId === this.current()?.id));

  readonly parts = computed(() => {
    const c = this.cost();
    if (!c) return [];
    const cats = this.s.categories();
    const out: { label: string; value: number; color: string }[] = [];
    let i = 0;
    for (const [id, value] of Object.entries(c.purchasesByGroup)) {
      out.push({ label: `مشتريات — ${cats.find((x) => x.id === id)?.name ?? id}`, value, color: COLORS[i++ % COLORS.length] });
    }
    out.push({ label: 'وقود (تزويد)', value: c.bunker, color: '#d4a857' });
    out.push({ label: 'رسوم موانئ', value: c.port, color: '#2b6cb0' });
    out.push({ label: 'رواتب الطاقم', value: c.crew, color: '#6b4fb3' });
    out.push({ label: 'مصروفات أخرى', value: c.other, color: '#9aa7b0' });
    return out.filter((p) => p.value > 0);
  });

  constructor() {
    effect(() => {
      const el = this.mapEl()?.nativeElement;
      const v = this.current();
      const ports = this.s.ports();
      if (!el || !v) return;
      this.map ??= new ShipMap(el);
      const stops = v.stops.map((st, i) => ({ st, p: ports.find((p) => p.id === st.portId), i })).filter((x) => x.p);
      void this.map.draw(
        stops.map((x) => ({
          lat: x.p!.lat,
          lng: x.p!.lng,
          label: x.p!.name,
          index: x.i + 1,
          tone: x.st.activities.includes('تزويد وقود') ? ('gold' as const) : ('navy' as const),
          popup: `<b>${x.p!.name}</b><br>${x.st.eta} ← ${x.st.etd}`,
        })),
        [{ points: stops.map((x) => [x.p!.lat, x.p!.lng] as [number, number]) }],
      );
    });
    inject(DestroyRef).onDestroy(() => this.map?.destroy());
  }

  statusLabel(st: VoyageStatus): string {
    return VOYAGE_STATUS_LABEL[st];
  }

  statusTone(st: VoyageStatus): string {
    return st === 'active' ? 'ok' : st === 'planned' ? 'info' : 'muted';
  }

  totalOf(v: Voyage): number {
    return voyageCost(v, this.s.data(), this.s.categories()).total;
  }

  portName(id: string): string {
    return this.s.ports().find((p) => p.id === id)?.name ?? '—';
  }

  legAt(i: number) {
    return i > 0 ? this.legs()[i - 1] : null;
  }

  fees(st: PortStop): number {
    return stopFees(st);
  }

  /* ── تعديل ── */

  openEdit(v?: Voyage): void {
    this.isNew = !v;
    const n = this.s.voyages().length + 1;
    this.form = v
      ? { ...v, stops: v.stops.map((st) => ({ ...st, activities: [...st.activities] })) }
      : { id: this.s.nextVoyageId(), number: `V-${new Date().getFullYear()}-${String(n).padStart(2, '0')}`, title: '', status: 'planned', startDate: today(), endDate: '', stops: [], notes: '', expectedHfo: 0, expectedMgo: 0, expectedLube: 0, consumptions: [] };
    if (this.form) {
      this.form = { ...this.form, consumptions: this.consumptionOf(this.form) };
    }
    if (this.isNew && this.form) {
      this.fillConsumption();
    }
  }

  formSpan(): number {
    return this.form ? voyageSpanDays(this.form) : 1;
  }

  setSpan(days: number): void {
    const form = this.form;
    if (!form?.startDate) return;
    const span = Math.max(1, Math.round(num(days)));
    form.endDate = span <= 1 ? form.startDate : addDays(form.startDate, span);
  }

  fillConsumption(): void {
    const form = this.form;
    if (!form) return;
    const burn = suggestVoyageConsumption(form, this.s.data().config, Math.max(1, this.s.crewOnBoard().length));
    const gasoline = (this.s.data().config.dailyRates ?? []).find((item) => item.kind === 'Gasoline' && item.motion === 'Sailing')?.tonsPerDay ?? 0;
    form.consumptions = [
      { kind: 'HeavyFuel', quantity: burn.hfo },
      { kind: 'Diesel', quantity: burn.mgo },
      { kind: 'Water', quantity: burn.water },
      { kind: 'Lubricant', quantity: burn.lube },
      { kind: 'Gasoline', quantity: round(gasoline * burn.days, 1) },
    ];
    this.applyRows(form);
  }

  consumptionLabel(kind: ConsumptionKind): string {
    return CONSUMPTION_KINDS.find((item) => item.id === kind)?.label ?? kind;
  }

  nextConsumption(): ConsumptionKind | null {
    const used = new Set((this.form?.consumptions ?? []).map((row) => row.kind));
    return CONSUMPTION_KINDS.find((item) => !used.has(item.id))?.id ?? null;
  }

  addConsumption(): void {
    const form = this.form;
    const kind = this.nextConsumption();
    if (!form || !kind) return;
    form.consumptions = [...(form.consumptions ?? []), { kind, quantity: 0 }];
  }

  removeConsumption(kind: ConsumptionKind): void {
    const form = this.form;
    if (!form) return;
    form.consumptions = (form.consumptions ?? []).filter((row) => row.kind !== kind);
    if (!this.isNew) this.s.deleteConsumption(form.id, kind);
  }

  persistConsumption(row: VoyageConsumption): void {
    const form = this.form;
    if (!form || this.isNew) return;
    const quantity = num(row.quantity);
    if (quantity <= 0) this.s.deleteConsumption(form.id, row.kind);
    else this.s.saveConsumption(form.id, row.kind, quantity);
  }

  private consumptionOf(voyage: Voyage): VoyageConsumption[] {
    const stored = new Map((voyage.consumptions ?? []).map((row) => [row.kind, num(row.quantity)]));
    const fallback = (kind: ConsumptionKind) => {
      if (stored.has(kind)) return stored.get(kind) ?? 0;
      if (kind === 'HeavyFuel') return num(voyage.expectedHfo);
      if (kind === 'Diesel') return num(voyage.expectedMgo);
      if (kind === 'Lubricant') return num(voyage.expectedLube);
      if (kind === 'Water') return num(voyage.expectedWater);
      return 0;
    };
    return CONSUMPTION_KINDS.map((item) => ({ kind: item.id, quantity: fallback(item.id) }));
  }

  private applyRows(form: Voyage): void {
    const qty = (kind: ConsumptionKind) => num(form.consumptions?.find((row) => row.kind === kind)?.quantity);
    form.expectedHfo = qty('HeavyFuel');
    form.expectedMgo = qty('Diesel');
    form.expectedLube = qty('Lubricant');
    form.expectedWater = qty('Water');
  }

  fuelRows(v: Voyage) {
    const config = this.s.data().config;
    const crew = Math.max(1, this.s.crewOnBoard().length);
    const kinds = ['hfo', 'mgo', 'water', 'lube'] as const;
    const days = voyageSpanDays(v);
    const gasoline = (v.consumptions ?? []).find((item) => item.kind === 'Gasoline')?.quantity ?? 0;
    const rows: { kind: string; label: string; expected: number; rate: number; lasts: number | null; covers: boolean | null }[] = kinds.map((kind) => {
      const tank = this.s.tanks().find((item) => item.kind === kind);
      const outlook = voyageFuelOutlook(kind, tank?.current ?? 0, v, config, crew);
      return {
        kind,
        label: kind === 'hfo' ? 'وقود ثقيل' : kind === 'mgo' ? 'ديزل' : kind === 'water' ? 'مياه' : 'زيوت',
        expected: voyageExpectedTons(v, kind, config, crew),
        rate: outlook.rate,
        lasts: outlook.lasts,
        covers: outlook.coversVoyage,
      };
    });
    rows.push({
      kind: 'gasoline',
      label: 'بنزين',
      expected: gasoline,
      rate: days ? gasoline / days : 0,
      lasts: null,
      covers: null,
    });
    return rows;
  }

  addStop(): void {
    const f = this.form;
    if (!f) return;
    const last = f.stops[f.stops.length - 1];
    const eta = last ? addDays(last.etd || last.eta, 3) : f.startDate;
    const st: PortStop = {
      id: uid('stop'),
      portId: this.s.ports()[0]?.id ?? '',
      eta,
      etd: addDays(eta, 1),
      activities: [],
      berthFee: 0,
      pilotFee: 0,
      canalFee: 0,
      agencyFee: 0,
      actualFda: 0,
      agent: '',
      legNm: null,
      legFuelT: null,
    };
    this.fill(st);
    f.stops.push(st);
  }

  fill(st: PortStop): void {
    const p = this.s.ports().find((x) => x.id === st.portId);
    if (!p) return;
    const days = Math.max(1, daysBetween(st.eta, st.etd || st.eta) || 1);
    st.berthFee = round(p.berthPerDay * days, 0);
    st.pilotFee = p.pilotage;
    st.canalFee = p.canal;
    st.agencyFee = p.agency;
  }

  move(i: number, d: number): void {
    const f = this.form;
    if (!f) return;
    const [x] = f.stops.splice(i, 1);
    f.stops.splice(i + d, 0, x);
  }

  toggleAct(st: PortStop, a: string): void {
    const i = st.activities.indexOf(a);
    if (i >= 0) st.activities.splice(i, 1);
    else st.activities.push(a);
  }

  save(): void {
    const f = this.form;
    if (!f) return;
    if (!f.title.trim()) {
      const first = f.stops[0];
      const last = f.stops[f.stops.length - 1];
      f.title = first && last ? `${this.portName(first.portId)} ← ${this.portName(last.portId)}` : '';
    }
    if (!f.title.trim()) {
      this.s.notify('اكتب عنوان الرحلة أو أضف محطات.', 'warn');
      return;
    }
    const stops = f.stops.map((st) => ({
      ...st,
      berthFee: num(st.berthFee),
      pilotFee: num(st.pilotFee),
      canalFee: num(st.canalFee),
      agencyFee: num(st.agencyFee),
      actualFda: num(st.actualFda),
      legNm: st.legNm ? num(st.legNm) : null,
    }));
    this.applyRows(f);
    const consumptions = (f.consumptions ?? []).map((row) => ({ kind: row.kind, quantity: num(row.quantity) })).filter((row) => row.quantity > 0);
    this.s.saveVoyage({
      ...f,
      consumptions,
      stops,
    });
    this.selected.set(f.id);
    this.form = null;
  }

  remove(v: Voyage): void {
    if (window.confirm(`حذف الرحلة ${v.number}؟`)) {
      this.s.deleteVoyage(v.id);
      this.selected.set(null);
    }
  }

  openExpense(): void {
    this.exp = { label: '', amount: 0, date: today(), note: '' };
  }

  saveExpense(): void {
    const e = this.exp;
    const v = this.current();
    if (!e || !v || !e.label.trim() || num(e.amount) <= 0) {
      this.s.notify('البيان والمبلغ مطلوبان.', 'warn');
      return;
    }
    this.s.addExpense({ voyageId: v.id, label: e.label.trim(), amount: num(e.amount), date: e.date, note: e.note });
    this.exp = null;
  }
}
