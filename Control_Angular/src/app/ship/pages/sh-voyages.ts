import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { addDays, daysBetween, legsOf, num, round, stopFees, suggestVoyageConsumption, today, uid, voyageCost, voyageExpectedTons, voyageFuelOutlook, voyageRevenue, voyageSpanDays } from '../core/ship-calc';
import { dateLabel, fmt, usd } from '../core/ship-format';
import { ShipMap } from '../core/ship-map';
import { ShipFiles } from '../core/ship-files';
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

      @if (s.can('voyages')) {
        <section class="card">
          <div class="card-head"><h2>إنشاء رحلة جديدة</h2></div>
          <div class="card-body stack">
            <div class="form-grid">
              <label class="field"><span>رقم الرحلة</span><input type="text" [(ngModel)]="draft.number" placeholder="AQ-004" /></label>
              <label class="field">
                <span>خرجت من</span>
                <select [(ngModel)]="draft.fromPortId">
                  <option value="">—</option>
                  @for (p of s.ports(); track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </select>
              </label>
              <label class="field">
                <span>رايحة إلى</span>
                <select [(ngModel)]="draft.toPortId">
                  <option value="">—</option>
                  @for (p of s.ports(); track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </select>
              </label>
              <div class="field wide">
                <span>الموانئ اللي هتعدي عليها</span>
                <div class="row">
                  <select [(ngModel)]="draft.viaPick">
                    <option value="">اختار ميناء</option>
                    @for (p of s.ports(); track p.id) {
                      <option [value]="p.id">{{ p.name }}</option>
                    }
                  </select>
                  <button type="button" class="btn btn-sm" (click)="addVia()">إضافة</button>
                </div>
                @for (id of draft.viaPortIds; track $index) {
                  <div class="row">
                    <span>{{ $index + 1 }}. {{ portName(id) }}</span>
                    <button type="button" class="btn btn-sm" [disabled]="$index === 0" (click)="moveVia($index, -1)">↑</button>
                    <button type="button" class="btn btn-sm" [disabled]="$index === draft.viaPortIds.length - 1" (click)="moveVia($index, 1)">↓</button>
                    <button type="button" class="btn btn-sm btn-ghost btn-danger" (click)="removeVia($index)">حذف</button>
                  </div>
                }
                @if (!draft.viaPortIds.length) {
                  <div class="muted small">لسه مفيش موانئ عبور.</div>
                }
              </div>
              @if (draftRoute()) {
                <div class="hint wide">المسار: {{ draftRoute() }}</div>
              }
              <label class="field">
                <span>الحالة</span>
                <select [(ngModel)]="draft.status">
                  @for (st of statuses; track st.id) {
                    <option [value]="st.id">{{ st.label }}</option>
                  }
                </select>
              </label>
              <label class="field"><span>تاريخ البداية</span><input type="date" [(ngModel)]="draft.startDate" /></label>
              <label class="field"><span>تاريخ النهاية</span><input type="date" [(ngModel)]="draft.endDate" /></label>
            </div>
            <div class="actions">
              <button type="button" class="btn btn-primary" (click)="createVoyage()"><sc-icon name="check" /> إنشاء الرحلة</button>
              <button type="button" class="btn" (click)="openEdit()">تفاصيل أكتر</button>
            </div>
          </div>
        </section>
      }

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
                  @if (s.can('voyages')) {
                    <label class="field" style="min-width: 180px; margin: 0">
                      <span>حالة الرحلة</span>
                      <select [ngModel]="v.status" (ngModelChange)="changeStatus(v, $event)">
                        @for (st of statuses; track st.id) {
                          <option [value]="st.id">{{ st.label }}</option>
                        }
                      </select>
                    </label>
                    <button type="button" class="btn btn-sm" (click)="openEdit(v)"><sc-icon name="edit" /> تعديل المسار</button>
                    <button type="button" class="btn btn-sm btn-danger" (click)="remove(v)"><sc-icon name="trash" /></button>
                  } @else {
                    <span class="badge" [class]="'badge ' + statusTone(v.status)">{{ statusLabel(v.status) }}</span>
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
                @if (v.sheet; as sheet) {
                  <div class="kpis">
                    <div class="kpi"><label>الشحنة</label><strong>{{ sheet.cargoType }}</strong><small>{{ sheet.destination }}</small></div>
                    <div class="kpi"><label>الوكيل</label><strong>{{ sheet.agent }}</strong><small>{{ sheet.daContact || sheet.exporter }}</small></div>
                    @if (sheet.daAmount != null) {
                      <div class="kpi gold"><label>مصاريف الوكيل</label><strong>{{ usd(sheet.daAmount, 2) }}</strong></div>
                    }
                    <div class="kpi"><label>حالة الشيت</label><strong>{{ sheet.operation === 'Complete' ? 'مكتملة' : 'مخطاف' }}</strong></div>
                  </div>
                  <div class="grid g2">
                    @for (load of sheet.loads; track load.place + load.start) {
                      <div class="hint">
                        <b>تحميل {{ load.type }}</b>
                        <div>{{ load.place }} · {{ dateLabel(load.start) }} ← {{ dateLabel(load.end) }} · {{ load.days }}</div>
                        <div class="num">{{ fmt(load.qty, 2) }} طن</div>
                      </div>
                    }
                    @for (out of sheet.discharges; track out.place + out.type) {
                      <div class="hint">
                        <b>تفريغ {{ out.type }}</b>
                        <div>{{ out.place }} · {{ out.start ? dateLabel(out.start) + ' ← ' + dateLabel(out.end) + ' · ' + out.days : 'لم يبدأ' }}</div>
                        @if (out.qty != null) { <div class="num">{{ fmt(out.qty, 2) }} طن</div> }
                        @if (out.shortage) { <div>عجز {{ fmt(out.shortage, 2) }} طن</div> }
                      </div>
                    }
                  </div>
                  <div class="muted small">
                    المصدّر {{ sheet.exporter }}
                    @if (sheet.sailingTime) { · الإبحار {{ sheet.sailingTime }} }
                    @if (sheet.anchorTime) { · المخطاف {{ sheet.anchorTime }} }
                    @if (sheet.totalTime) { · الإجمالي {{ sheet.totalTime }} }
                  </div>
                }
                <dl class="kv" style="grid-template-columns: 170px 1fr">
                  <dt>ميناء المغادرة</dt><dd>{{ v.departurePort || '—' }}</dd>
                  <dt>تاريخ ووقت المغادرة</dt><dd>{{ v.departureAt || '—' }}</dd>
                  <dt>ميناء الوصول</dt><dd>{{ v.arrivalPort || '—' }}</dd>
                  <dt>تاريخ ووقت الوصول</dt><dd>{{ v.arrivalAt || 'لم يصل بعد' }}</dd>
                  <dt>نوع الحمولة</dt><dd>{{ v.cargoType || '—' }}</dd>
                  <dt>كمية الحمولة</dt><dd class="num">{{ v.cargoQuantity != null ? fmt(v.cargoQuantity, 2) + ' ' + (v.cargoUnit || 'طن') : '—' }}</dd>
                  <dt>المستأجر</dt><dd>{{ v.charterer || '—' }}</dd>
                  <dt>الوكيل الملاحي</dt><dd>{{ v.agent || '—' }}</dd>
                  @if (v.freightAmount != null) {
                    <dt>النولون</dt><dd class="num">{{ usd(v.freightAmount, 2) }}</dd>
                  }
                  <dt>الحالة الحالية</dt>
                  <dd>{{ v.currentState || '—' }}{{ v.currentStateAt ? ' — ' + dateLabel(v.currentStateAt) : '' }}</dd>
                </dl>
                @if (v.notes) { <div class="hint">{{ v.notes }}</div> }
              </div>
            </section>

            <section class="card">
              <div class="card-head"><h3>خط السير (الموانئ والمراحل)</h3></div>
              <div class="card-body"><div #mapEl class="map sm"></div></div>
              <div class="card-body flush table-wrap">
                <table class="tbl">
                  <thead><tr><th>#</th><th>الميناء</th><th>الوصول</th><th>المغادرة</th><th>المرحلة السابقة</th><th>الأنشطة</th><th>رسوم الميناء</th><th>التكلفة الفعلية</th></tr></thead>
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
                          @if (st.actualFda > 0) { <span class="badge ok">فعلي</span> } @else { <span class="badge muted">مرجعي</span> }
                        </td>
                        <td class="small">
                          @if (st.actualFda > 0) {
                            <div class="num"><b>{{ usd(st.actualFda, 2) }}</b></div>
                            <div class="muted">{{ st.daProvider || '—' }}{{ st.daPaymentStatus ? ' · ' + st.daPaymentStatus : '' }}</div>
                          } @else {
                            <span class="muted">لم تُسجَّل</span>
                          }
                          @if (s.can('costs')) {
                            <button type="button" class="btn btn-sm btn-ghost" (click)="openDa(v, st)">
                              <sc-icon name="edit" /> {{ st.actualFda > 0 ? 'تعديل' : 'إضافة تكلفة الميناء' }}
                            </button>
                          }
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
                            <td class="end num">{{ usd(e.amount, 2) }}</td>
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

    @if (da) {
      <div class="modal-back" (click)="da = null">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>التكلفة الفعلية للميناء — {{ portName(da.stop.portId) }}</h3>
            <button type="button" class="btn btn-sm btn-ghost" (click)="da = null"><sc-icon name="x" /></button>
          </div>
          <div class="modal-body">
            <p class="muted small">
              الرسوم المسجلة على الميناء مرجعية للتقدير. هنا تسجّل فاتورة حساب المدفوعات الفعلية، وهي اللي بتدخل في تكلفة الرحلة.
            </p>
            <div class="form-grid">
              <label class="field"><span>المبلغ الفعلي (USD)</span><input type="number" min="0" step="any" [(ngModel)]="da.actualFda" /></label>
              <label class="field"><span>مورّد حساب المدفوعات</span><input type="text" [(ngModel)]="da.daProvider" /></label>
              <label class="field"><span>رقم الفاتورة</span><input type="text" [(ngModel)]="da.daInvoice" /></label>
              <label class="field"><span>تاريخ الفاتورة</span><input type="date" [(ngModel)]="da.daInvoiceDate" /></label>
              <label class="field"><span>تاريخ الاستحقاق</span><input type="date" [(ngModel)]="da.daDueDate" /></label>
              <label class="field">
                <span>حالة السداد</span>
                <select [(ngModel)]="da.daPaymentStatus">
                  <option value="">—</option>
                  @for (state of payStates; track state) {
                    <option [value]="state">{{ state }}</option>
                  }
                </select>
              </label>
              <label class="field"><span>اللي سدد</span><input type="text" [(ngModel)]="da.daPaidBy" /></label>
              <label class="field wide"><span>صورة الفاتورة</span><input type="file" accept="application/pdf,image/*" (change)="onDaInvoice($event)" /></label>
              <label class="field wide"><span>ملاحظة</span><input type="text" [(ngModel)]="da.daNote" /></label>
            </div>
            <div class="alert"><sc-icon name="info" /> الرسوم المرجعية للميناء {{ usd(refFees(da.stop), 2) }} · الفرق {{ usd(num(da.actualFda) - refFees(da.stop), 2) }}</div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="da = null">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="saveDa()"><sc-icon name="check" /> حفظ</button>
          </div>
        </div>
      </div>
    }

    @if (form) {
      <div class="modal-back" (click)="form = null">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="modal-head"><h3>{{ isNew ? 'رحلة جديدة' : 'تعديل الرحلة ومسارها' }}</h3><button type="button" class="btn btn-sm btn-ghost" (click)="form = null"><sc-icon name="x" /></button></div>
          <div class="modal-body">
            <div class="form-grid">
              <label class="field"><span>رقم الرحلة</span><input type="text" [(ngModel)]="form.number" /></label>
              <label class="field">
                <span>خرجت من</span>
                <select [(ngModel)]="formRoute.fromPortId" (ngModelChange)="onFormRouteChange()">
                  <option value="">—</option>
                  @for (p of s.ports(); track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </select>
              </label>
              <label class="field">
                <span>رايحة إلى</span>
                <select [(ngModel)]="formRoute.toPortId" (ngModelChange)="onFormRouteChange()">
                  <option value="">—</option>
                  @for (p of s.ports(); track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </select>
              </label>
              <div class="field wide">
                <span>الموانئ اللي هتعدي عليها</span>
                <div class="row">
                  <select [(ngModel)]="formRoute.viaPick">
                    <option value="">اختار ميناء</option>
                    @for (p of s.ports(); track p.id) {
                      <option [value]="p.id">{{ p.name }}</option>
                    }
                  </select>
                  <button type="button" class="btn btn-sm" (click)="addFormVia()">إضافة</button>
                </div>
                @for (id of formRoute.viaPortIds; track $index) {
                  <div class="row">
                    <span>{{ $index + 1 }}. {{ portName(id) }}</span>
                    <button type="button" class="btn btn-sm btn-ghost btn-danger" (click)="removeFormVia($index)">حذف</button>
                  </div>
                }
                @if (form.title) { <div class="hint">المسار: {{ form.title }}</div> }
              </div>
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
              <label class="field"><span>ميناء المغادرة</span><input type="text" [(ngModel)]="form.departurePort" /></label>
              <label class="field"><span>تاريخ ووقت المغادرة</span><input type="text" [(ngModel)]="form.departureAt" placeholder="2026-10-12 12:00" /></label>
              <label class="field"><span>ميناء الوصول</span><input type="text" [(ngModel)]="form.arrivalPort" /></label>
              <label class="field"><span>تاريخ ووقت الوصول</span><input type="text" [(ngModel)]="form.arrivalAt" /></label>
              <label class="field"><span>نوع الحمولة</span><input type="text" [(ngModel)]="form.cargoType" /></label>
              <label class="field"><span>كمية الحمولة</span><input type="number" min="0" step="any" [(ngModel)]="form.cargoQuantity" /></label>
              <label class="field"><span>وحدة الحمولة</span><input type="text" [(ngModel)]="form.cargoUnit" /></label>
              <label class="field"><span>المستأجر</span><input type="text" [(ngModel)]="form.charterer" /></label>
              <label class="field"><span>الوكيل</span><input type="text" [(ngModel)]="form.agent" /></label>
              <label class="field"><span>النولون (USD)</span><input type="number" min="0" step="any" [(ngModel)]="form.freightAmount" /></label>
              <label class="field"><span>حالة السفينة في الرحلة</span><input type="text" [(ngModel)]="form.currentState" placeholder="مخطاف" /></label>
              <label class="field"><span>تاريخ الحالة</span><input type="date" [(ngModel)]="form.currentStateAt" /></label>
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
  private readonly files = inject(ShipFiles);
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
  readonly payStates = ['مستحقة', 'مدفوعة', 'من ضمن حساب المركب', 'مؤجلة'];
  readonly num = num;
  da: {
    voyage: Voyage;
    stop: PortStop;
    actualFda: number;
    daProvider: string;
    daInvoice: string;
    daInvoiceDate: string;
    daDueDate: string;
    daPaymentStatus: string;
    daPaidBy: string;
    daNote: string;
  } | null = null;
  draft = { number: '', fromPortId: '', toPortId: '', viaPortIds: [] as string[], viaPick: '', status: 'planned' as VoyageStatus, startDate: today(), endDate: '' };
  formRoute = { fromPortId: '', toPortId: '', viaPortIds: [] as string[], viaPick: '' };

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
    out.push({ label: 'وقود وزيوت ومياه', value: c.bunker, color: '#d4a857' });
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

  changeStatus(v: Voyage, status: VoyageStatus): void {
    if (v.status === status) return;
    this.s.setVoyageStatus(v.id, status);
  }

  draftRoute(): string {
    return this.routeTitle(this.draft.fromPortId, this.draft.viaPortIds, this.draft.toPortId);
  }

  addVia(): void {
    if (!this.draft.viaPick) return;
    this.draft.viaPortIds = [...this.draft.viaPortIds, this.draft.viaPick];
    this.draft.viaPick = '';
  }

  removeVia(index: number): void {
    this.draft.viaPortIds = this.draft.viaPortIds.filter((_, i) => i !== index);
  }

  moveVia(index: number, step: number): void {
    const next = index + step;
    const ids = [...this.draft.viaPortIds];
    if (next < 0 || next >= ids.length) return;
    const [item] = ids.splice(index, 1);
    ids.splice(next, 0, item);
    this.draft.viaPortIds = ids;
  }

  addFormVia(): void {
    if (!this.formRoute.viaPick) return;
    this.formRoute.viaPortIds = [...this.formRoute.viaPortIds, this.formRoute.viaPick];
    this.formRoute.viaPick = '';
    this.onFormRouteChange();
  }

  removeFormVia(index: number): void {
    this.formRoute.viaPortIds = this.formRoute.viaPortIds.filter((_, i) => i !== index);
    this.onFormRouteChange();
  }

  onFormRouteChange(): void {
    const form = this.form;
    if (!form) return;
    form.title = this.routeTitle(this.formRoute.fromPortId, this.formRoute.viaPortIds, this.formRoute.toPortId);
    if ((this.isNew || !form.stops.length) && this.formRoute.fromPortId && this.formRoute.toPortId) {
      form.stops = this.stopsFromPorts(this.routePortIds(this.formRoute.fromPortId, this.formRoute.viaPortIds, this.formRoute.toPortId), form.startDate, form.endDate);
    }
  }

  createVoyage(): void {
    const number = this.draft.number.trim();
    const title = this.draftRoute();
    if (!this.draft.fromPortId || !this.draft.toPortId) {
      this.s.notify('اختار ميناء الخروج وميناء الوصول.', 'warn');
      return;
    }
    const n = this.s.voyages().length + 1;
    const start = this.draft.startDate || today();
    const voyage: Voyage = {
      id: this.s.nextVoyageId(),
      number: number || `V-${new Date().getFullYear()}-${String(n).padStart(2, '0')}`,
      title,
      status: this.draft.status,
      startDate: start,
      endDate: this.draft.endDate,
      stops: this.stopsFromPorts(this.routePortIds(this.draft.fromPortId, this.draft.viaPortIds, this.draft.toPortId), start, this.draft.endDate),
      notes: '',
      expectedHfo: 0,
      expectedMgo: 0,
      expectedLube: 0,
      consumptions: [],
    };
    this.s.saveVoyage(voyage);
    this.selected.set(voyage.id);
    this.draft = { number: '', fromPortId: '', toPortId: '', viaPortIds: [], viaPick: '', status: 'planned', startDate: today(), endDate: '' };
  }

  private routeTitle(fromId: string, viaIds: string[], toId: string): string {
    return this.routePortIds(fromId, viaIds, toId).map((id) => this.portName(id)).filter((name) => name !== '—').join(' ← ');
  }

  private routePortIds(fromId: string, viaIds: string[], toId: string): string[] {
    return [fromId, ...viaIds, toId].filter((id) => !!id);
  }

  private stopsFromPorts(portIds: string[], start: string, end: string): PortStop[] {
    const span = end && end > start ? Math.max(1, daysBetween(start, end)) : Math.max(1, portIds.length - 1);
    return portIds.map((portId, index) => {
      const offset = portIds.length <= 1 ? 0 : Math.round((span * index) / (portIds.length - 1));
      const eta = addDays(start || today(), offset);
      const stop: PortStop = {
        id: uid('stop'),
        portId,
        eta,
        etd: index === portIds.length - 1 ? eta : addDays(eta, 1),
        activities: index === 0 ? [] : index === portIds.length - 1 ? ['تفريغ'] : [],
        berthFee: 0,
        pilotFee: 0,
        canalFee: 0,
        agencyFee: 0,
        actualFda: 0,
        agent: '',
        legNm: null,
        legFuelT: null,
      };
      this.fill(stop);
      return stop;
    });
  }

  openEdit(v?: Voyage): void {
    this.isNew = !v;
    const n = this.s.voyages().length + 1;
    this.form = v
      ? { ...v, stops: v.stops.map((st) => ({ ...st, activities: [...st.activities] })) }
      : { id: this.s.nextVoyageId(), number: this.draft.number.trim() || `V-${new Date().getFullYear()}-${String(n).padStart(2, '0')}`, title: this.draftRoute(), status: this.draft.status, startDate: this.draft.startDate || today(), endDate: this.draft.endDate, stops: [], notes: '', expectedHfo: 0, expectedMgo: 0, expectedLube: 0, consumptions: [] };
    const ids = (v?.stops ?? []).map((stop) => stop.portId);
    this.formRoute = v
      ? { fromPortId: ids[0] ?? '', toPortId: ids.length > 1 ? ids[ids.length - 1] : '', viaPortIds: ids.slice(1, -1), viaPick: '' }
      : { fromPortId: this.draft.fromPortId, toPortId: this.draft.toPortId, viaPortIds: [...this.draft.viaPortIds], viaPick: '' };
    if (this.form) {
      this.form = { ...this.form, consumptions: this.consumptionOf(this.form) };
    }
    if (this.isNew && this.form) {
      this.onFormRouteChange();
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

  openDa(voyage: Voyage, stop: PortStop): void {
    this.da = {
      voyage,
      stop,
      actualFda: stop.actualFda,
      daProvider: stop.daProvider ?? stop.agent ?? '',
      daInvoice: stop.daInvoice ?? '',
      daInvoiceDate: stop.daInvoiceDate ?? '',
      daDueDate: stop.daDueDate ?? '',
      daPaymentStatus: stop.daPaymentStatus ?? '',
      daPaidBy: stop.daPaidBy ?? '',
      daNote: stop.daNote ?? '',
    };
  }

  /** الرسوم المرجعية المسجلة على الميناء، من غير الفعلي. */
  refFees(st: PortStop): number {
    return num(st.berthFee) + num(st.pilotFee) + num(st.canalFee) + num(st.agencyFee);
  }

  private daFile: File | null = null;

  onDaInvoice(ev: Event): void {
    this.daFile = (ev.target as HTMLInputElement).files?.[0] ?? null;
  }

  async saveDa(): Promise<void> {
    const d = this.da;
    if (!d) return;
    let daInvoiceFile = d.stop.daInvoiceFile ?? '';
    if (this.daFile) {
      daInvoiceFile = `da-${d.stop.id}`;
      await this.files.put(daInvoiceFile, this.daFile);
    }
    const stops = d.voyage.stops.map((st) =>
      st.id === d.stop.id
        ? {
            ...st,
            actualFda: num(d.actualFda),
            daProvider: d.daProvider,
            daInvoice: d.daInvoice,
            daInvoiceDate: d.daInvoiceDate,
            daDueDate: d.daDueDate,
            daPaymentStatus: d.daPaymentStatus,
            daPaidBy: d.daPaidBy,
            daInvoiceFile,
            daNote: d.daNote,
          }
        : st
    );
    this.s.saveVoyage({ ...d.voyage, stops });
    this.da = null;
    this.daFile = null;
  }

  toggleAct(st: PortStop, a: string): void {
    const i = st.activities.indexOf(a);
    if (i >= 0) st.activities.splice(i, 1);
    else st.activities.push(a);
  }

  save(): void {
    const f = this.form;
    if (!f) return;
    if (this.formRoute.fromPortId && this.formRoute.toPortId) {
      f.title = this.routeTitle(this.formRoute.fromPortId, this.formRoute.viaPortIds, this.formRoute.toPortId);
    }
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
      cargoQuantity: f.cargoQuantity == null ? null : num(f.cargoQuantity),
      freightAmount: f.freightAmount == null ? null : num(f.freightAmount),
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
