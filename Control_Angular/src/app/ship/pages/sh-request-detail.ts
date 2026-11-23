import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import {
  activeLines,
  addDays,
  groupsOf,
  num,
  OfferView,
  priceTone,
  purchaseValue,
  scoreOffers,
  supplierPriceIndex,
  supplierRating,
  today,
  uid,
} from '../core/ship-calc';
import { dateLabel, fmt, usd } from '../core/ship-format';
import { mailtoFor, rfqPrint } from '../core/ship-print';
import { ShipStore } from '../core/ship-store';
import { Offer, REQ_STATUS, ReqLine, Requisition, Supplier } from '../core/ship.types';

interface OfferForm {
  id: string;
  groupId: string;
  supplierId: string;
  date: string;
  deliveryDays: number;
  validityDays: number;
  payment: string;
  notes: string;
  prices: Record<string, string>;
}

interface ReceiveRow {
  line: ReqLine;
  qty: number;
  ok: boolean;
}

@Component({
  selector: 'sh-request-detail',
  standalone: false,
  template: `
    @if (req(); as r) {
      <div class="page">
        <div class="page-head">
          <div>
            <h1>
              {{ r.no }}
              <span class="badge" [class]="'badge ' + meta().tone">{{ meta().label }}</span>
              @if (r.priority === 'urgent') {
                <span class="badge bad">عاجل</span>
              }
            </h1>
            <p>
              أنشأه {{ r.createdBy }} بتاريخ {{ dateLabel(r.createdAt) }}
              @if (voyageLabel()) {
                · {{ voyageLabel() }}
              }
            </p>
          </div>
          <div class="actions">
            <a class="btn" routerLink="/ship/requests"><sc-icon name="back" /> الطلبات</a>
            @if (r.status === 'draft' && s.can('request')) {
              <button type="button" class="btn btn-primary" (click)="s.submitRequest(r.id)"><sc-icon name="send" /> إرسال للإدارة</button>
            }
            @if (r.status === 'submitted' && s.can('review')) {
              <button type="button" class="btn btn-primary" [disabled]="!liveLines().length" (click)="s.markReady(r.id)"><sc-icon name="check" /> اعتماد وجاهز للإرسال</button>
            }
            @if (r.status === 'ready' && s.can('review')) {
              <button type="button" class="btn" (click)="s.returnToDraft(r.id)">إرجاع للمراجعة</button>
            }
            @if (canCancel()) {
              <button type="button" class="btn btn-danger" (click)="confirmCancel = true"><sc-icon name="x" /> إلغاء الطلب</button>
            }
          </div>
        </div>

        @if (r.status === 'cancelled') {
          <div class="alert bad"><sc-icon name="alert" /> هذا الطلب ملغي.</div>
        } @else {
          <div class="card">
            <div class="card-body">
              <div class="steps">
                @for (st of steps(); track st.label; let i = $index) {
                  <div class="step" [class.done]="st.done" [class.now]="st.now"><i>{{ st.done ? '✓' : i + 1 }}</i>{{ st.label }}</div>
                }
              </div>
            </div>
          </div>
        }

        @if (r.notes) {
          <div class="hint"><b>ملاحظات الطلب:</b> {{ r.notes }}</div>
        }
        @if (r.status === 'submitted' && !s.can('review')) {
          <div class="alert"><sc-icon name="info" /> الطلب عند الإدارة للمراجعة. هتظهر هنا حالته وموعد التوريد بعد الموافقة.</div>
        }

        <section class="card">
          <div class="card-head">
            <h2>بنود الطلب</h2>
            <small>{{ liveLines().length }} بند @if (removedCount()) { · {{ removedCount() }} محذوف }</small>
          </div>
          <div class="card-body flush table-wrap">
            <table class="tbl">
              <thead>
                <tr><th>الصنف</th><th>القسم</th><th>الوصف</th><th>الكمية</th><th>الرصيد بالسفينة</th>@if (anyReceived()) { <th>المستلم</th> }<th></th></tr>
              </thead>
              <tbody>
                @for (l of r.lines; track l.id) {
                  <tr [class.dim]="l.removed">
                    <td><b>{{ l.name }}</b></td>
                    <td><span class="badge muted">{{ catName(l.groupId) }}</span></td>
                    <td>
                      @if (editable() && !l.removed) {
                        <input type="text" [value]="l.description" (change)="s.setLineDescription(r.id, l.id, $any($event.target).value)" />
                      } @else {
                        {{ l.description || '—' }}
                      }
                    </td>
                    <td class="tight">
                      @if (editable() && !l.removed) {
                        <input type="number" min="0" style="width:90px" [value]="l.qty" (change)="s.setLineQty(r.id, l.id, $any($event.target).value)" />
                      } @else {
                        <span class="num">{{ l.qty }}</span>
                      }
                      {{ l.unit }}
                    </td>
                    <td class="num">{{ fmt(s.data().stock[l.productId] ?? 0, 1) }}</td>
                    @if (anyReceived()) {
                      <td class="num">{{ l.received ?? '—' }}</td>
                    }
                    <td class="end tight">
                      @if (editable()) {
                        @if (l.removed) {
                          <button type="button" class="btn btn-sm" (click)="s.removeLine(r.id, l.id, false)">استعادة</button>
                        } @else {
                          <button type="button" class="btn btn-sm btn-danger" (click)="s.removeLine(r.id, l.id, true)"><sc-icon name="trash" /></button>
                        }
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (editable()) {
            <div class="card-body row" style="border-top:1px solid var(--line)">
              <select style="max-width:320px" [(ngModel)]="addProduct">
                <option value="">إضافة صنف للطلب…</option>
                @for (p of s.products(); track p.id) {
                  @if (p.active) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                }
              </select>
              <input type="number" min="1" style="width:100px" [(ngModel)]="addQty" />
              <button type="button" class="btn btn-sm btn-primary" [disabled]="!addProduct" (click)="doAdd()"><sc-icon name="plus" /> إضافة</button>
            </div>
          }
        </section>

        @if (showGroups()) {
          <div class="tabs">
            @for (g of groups(); track g) {
              <button type="button" class="tab" [class.on]="group() === g" (click)="pickGroup(g)">
                {{ catName(g) }} <span class="pill-note">· {{ groupState(g) }}</span>
              </button>
            }
          </div>

          @if (group(); as g) {
            @let approval = approvalOf(g);
            @let views = offerViews(g);
            <section class="card">
              <div class="card-head">
                <h2>{{ catName(g) }} — {{ groupLines(g).length }} صنف</h2>
                <div class="actions">
                  @if (s.can('review')) {
                    <button type="button" class="btn btn-sm" (click)="pdf(g)"><sc-icon name="print" /> ملف PDF للموردين</button>
                  }
                </div>
              </div>

              <div class="card-body stack">
                @if (approval) {
                  <div class="alert ok">
                    <sc-icon name="check" />
                    <div>
                      <b>تمت الموافقة على عرض {{ approvedOffer(g)?.supplierName }}</b>
                      — التوريد المتوقع <b>{{ dateLabel(approval.expectedDate) }}</b>
                      <div class="small">اعتمده {{ approval.approvedBy }} في {{ dateLabel(approval.approvedAt) }}</div>
                    </div>
                  </div>
                  @if (isGroupReceived(g)) {
                    <div class="alert"><sc-icon name="box" /> تم استلام هذا القسم وتحديث المخزن.</div>
                  } @else {
                    <div class="row">
                      @if (s.can('receive')) {
                        <button type="button" class="btn btn-primary" (click)="openReceive(g)"><sc-icon name="down" /> تأكيد الاستلام وتحديث المخزن</button>
                      }
                      @if (s.can('approve')) {
                        <button type="button" class="btn btn-danger" (click)="s.revokeApproval(r.id, g)">سحب الموافقة</button>
                      }
                    </div>
                  }
                } @else if (!s.can('review')) {
                  <div class="alert"><sc-icon name="clock" /> {{ groupState(g) }}</div>
                }

                @if (s.can('review')) {
                  @if (r.status === 'submitted' || r.status === 'draft') {
                    <div class="alert warn"><sc-icon name="info" /> اعتمد الطلب أولاً (جاهز للإرسال) علشان تقدر تبعته للموردين.</div>
                  } @else {
                    <h3>1) إرسال طلب عرض السعر</h3>
                    <div class="table-wrap">
                      <table class="tbl">
                        <thead><tr><th>المورد</th><th>التقييم</th><th>الميناء</th><th>الإيميل</th><th>الحالة</th><th></th></tr></thead>
                        <tbody>
                          @for (sup of suppliersFor(g); track sup.id) {
                            <tr>
                              <td><b>{{ sup.company }}</b><div class="muted small">{{ sup.contact }}</div></td>
                              <td>{{ rating(sup) ?? '—' }} ★</td>
                              <td class="small">{{ supPorts(sup) }}</td>
                              <td class="small"><span class="ltr">{{ sup.email }}</span></td>
                              <td>
                                @if (sentAt(g, sup.id); as at) {
                                  <span class="badge info"><sc-icon name="check" /> أُرسل {{ dateLabel(at) }}</span>
                                } @else {
                                  <span class="badge muted">لم يُرسل</span>
                                }
                              </td>
                              <td class="end tight">
                                <a class="btn btn-sm" [href]="mail(g, sup)" (click)="s.recordSend(r.id, g, sup)"><sc-icon name="mail" /> فتح البريد وتسجيل الإرسال</a>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                      @if (!suppliersFor(g).length) {
                        <div class="empty">لا يوجد موردون مرتبطون بهذا القسم. أضفهم من صفحة الموردين.</div>
                      }
                    </div>
                    <div class="pill-note">ارفق ملف الـ PDF في الإيميل. لما العروض تيجي سجّلها من زر «إضافة عرض» (لاحقاً هتتسجل تلقائياً من الإيميلات).</div>

                    <div class="between row">
                      <h3>2) العروض والمقارنة</h3>
                      <button type="button" class="btn btn-sm btn-primary" (click)="openOffer(g)"><sc-icon name="plus" /> إضافة عرض</button>
                    </div>

                    @if (views.length) {
                      @let best = views[0];
                      <div class="alert ok" style="background:linear-gradient(135deg,#e2f4ea,#f1f9f4)">
                        <sc-icon name="sparkle" />
                        <div>
                          <b>توصية النظام: {{ best.offer.supplierName }}</b> — إجمالي {{ usd(best.total) }}، توريد خلال {{ best.offer.deliveryDays }} يوم، درجة {{ best.score }}/100
                          <div class="small">السبب: {{ best.reasons.join(' · ') }}</div>
                          @if (indexOf(best.offer.supplierId); as ix) {
                            <div class="small">مؤشر غلاء المورد تاريخياً: {{ fmt((ix - 1) * 100, 0) }}% فوق أقل عرض</div>
                          }
                        </div>
                      </div>

                      <div class="table-wrap">
                        <table class="tbl">
                          <thead>
                            <tr>
                              <th>الصنف</th>
                              <th>الكمية</th>
                              @for (v of views; track v.offer.id) {
                                <th>
                                  {{ v.offer.supplierName }}
                                  <div class="chips" style="margin-top:4px">
                                    @if (v.best) { <span class="badge ok">الأفضل</span> }
                                    @if (v.cheapest) { <span class="badge gold">الأرخص</span> }
                                    @if (v.fastest) { <span class="badge info">الأسرع</span> }
                                    @if (approval?.offerId === v.offer.id) { <span class="badge done">معتمد</span> }
                                  </div>
                                </th>
                              }
                            </tr>
                          </thead>
                          <tbody>
                            @for (l of groupLines(g); track l.id) {
                              <tr>
                                <td>{{ l.name }}</td>
                                <td class="num">{{ l.qty }} {{ l.unit }}</td>
                                @for (v of views; track v.offer.id) {
                                  <td [style.background]="isMin(g, l.id, v.offer) ? '#e2f4ea' : null" [style.font-weight]="isMin(g, l.id, v.offer) ? 800 : 600">
                                    @if (priceOf(v.offer, l.id); as p) {
                                      <span class="num">{{ usd(p, 2) }}</span>
                                    } @else {
                                      <span class="muted">—</span>
                                    }
                                  </td>
                                }
                              </tr>
                            }
                          </tbody>
                          <tfoot>
                            <tr><td colspan="2">الإجمالي</td>@for (v of views; track v.offer.id) { <td class="num">{{ usd(v.total) }}</td> }</tr>
                            <tr><td colspan="2">تغطية الأصناف</td>@for (v of views; track v.offer.id) { <td>{{ v.priced }} من {{ v.of }}</td> }</tr>
                            <tr><td colspan="2">مدة التوريد</td>@for (v of views; track v.offer.id) { <td>{{ v.offer.deliveryDays }} يوم</td> }</tr>
                            <tr><td colspan="2">الدفع / الصلاحية</td>@for (v of views; track v.offer.id) { <td class="small">{{ v.offer.payment || '—' }} · {{ v.offer.validityDays }} يوم</td> }</tr>
                            <tr><td colspan="2">تقييم المورد</td>@for (v of views; track v.offer.id) { <td>{{ v.rating ?? '—' }} ★ <span class="badge" [class]="'badge ' + tone(v, views).tone">{{ tone(v, views).label }}</span></td> }</tr>
                            <tr><td colspan="2">درجة التوصية</td>@for (v of views; track v.offer.id) { <td><b class="num">{{ v.score }}</b>/100</td> }</tr>
                            <tr>
                              <td colspan="2"></td>
                              @for (v of views; track v.offer.id) {
                                <td>
                                  <div class="row">
                                    @if (s.can('approve') && !isGroupReceived(g)) {
                                      <button type="button" class="btn btn-sm btn-primary" [disabled]="approval?.offerId === v.offer.id" (click)="openApprove(g, v)">
                                        <sc-icon name="check" /> {{ approval?.offerId === v.offer.id ? 'معتمد' : 'اعتماد' }}
                                      </button>
                                    }
                                    <button type="button" class="btn btn-sm" (click)="openOffer(g, v.offer)" [disabled]="isGroupReceived(g)"><sc-icon name="edit" /></button>
                                    <button type="button" class="btn btn-sm btn-danger" (click)="s.deleteOffer(r.id, v.offer.id)" [disabled]="isGroupReceived(g)"><sc-icon name="trash" /></button>
                                  </div>
                                </td>
                              }
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <div class="pill-note">الدرجة = السعر 50٪ + مدة التوريد 20٪ + تقييم المورد 15٪ + تغطية الأصناف 15٪. هي مجرد توصية — القرار للإدارة.</div>
                    } @else {
                      <div class="empty"><sc-icon name="mail" /> لسه مفيش عروض لهذا القسم.</div>
                    }
                  }
                }
              </div>
            </section>
          }
        }

        <section class="card">
          <div class="card-head"><h2>سجل الطلب</h2></div>
          <div class="card-body">
            <ul class="timeline">
              @for (e of events(); track $index) {
                <li>{{ e.text }}<small>{{ e.by }} · {{ dateLabel(e.at) }}</small></li>
              }
            </ul>
          </div>
        </section>
      </div>

      @if (confirmCancel) {
        <div class="modal-back" (click)="confirmCancel = false">
          <div class="modal narrow" (click)="$event.stopPropagation()">
            <div class="modal-head"><h3>إلغاء الطلب {{ r.no }}؟</h3></div>
            <div class="modal-body">لن يمكن استكمال الطلب بعد الإلغاء. هل أنت متأكد؟</div>
            <div class="modal-foot">
              <button type="button" class="btn" (click)="confirmCancel = false">رجوع</button>
              <button type="button" class="btn btn-danger" (click)="s.cancelRequest(r.id); confirmCancel = false">نعم، إلغاء</button>
            </div>
          </div>
        </div>
      }

      @if (offerForm) {
        <div class="modal-back" (click)="offerForm = null">
          <div class="modal wide" (click)="$event.stopPropagation()">
            <div class="modal-head"><h3>عرض سعر — {{ catName(offerForm.groupId) }}</h3><button type="button" class="btn btn-sm btn-ghost" (click)="offerForm = null"><sc-icon name="x" /></button></div>
            <div class="modal-body">
              <div class="form-grid">
                <label class="field">
                  <span>المورد</span>
                  <select [(ngModel)]="offerForm.supplierId">
                    <option value="">اختر المورد</option>
                    @for (sup of s.suppliers(); track sup.id) {
                      <option [value]="sup.id">{{ sup.company }}</option>
                    }
                  </select>
                </label>
                <label class="field"><span>تاريخ العرض</span><input type="date" [(ngModel)]="offerForm.date" /></label>
                <label class="field"><span>مدة التوريد (يوم)</span><input type="number" min="0" [(ngModel)]="offerForm.deliveryDays" /></label>
                <label class="field"><span>صلاحية العرض (يوم)</span><input type="number" min="0" [(ngModel)]="offerForm.validityDays" /></label>
                <label class="field wide"><span>شروط الدفع</span><input type="text" [(ngModel)]="offerForm.payment" placeholder="مثال: 30 يوم بعد الاستلام" /></label>
              </div>
              <div class="table-wrap">
                <table class="tbl">
                  <thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الوحدة (USD)</th><th>الإجمالي</th></tr></thead>
                  <tbody>
                    @for (l of groupLines(offerForm.groupId); track l.id) {
                      <tr>
                        <td>{{ l.name }}</td>
                        <td class="num">{{ l.qty }} {{ l.unit }}</td>
                        <td><input type="number" min="0" step="0.01" style="width:130px" [(ngModel)]="offerForm.prices[l.id]" placeholder="غير مسعّر" /></td>
                        <td class="num">{{ usd(num(offerForm.prices[l.id]) * l.qty, 2) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <label class="field"><span>ملاحظات</span><textarea rows="2" [(ngModel)]="offerForm.notes"></textarea></label>
            </div>
            <div class="modal-foot">
              <button type="button" class="btn" (click)="offerForm = null">إلغاء</button>
              <button type="button" class="btn btn-primary" (click)="saveOffer()"><sc-icon name="check" /> حفظ العرض</button>
            </div>
          </div>
        </div>
      }

      @if (approveFor) {
        <div class="modal-back" (click)="approveFor = null">
          <div class="modal narrow" (click)="$event.stopPropagation()">
            <div class="modal-head"><h3>اعتماد عرض {{ approveFor.view.offer.supplierName }}</h3></div>
            <div class="modal-body">
              <div class="alert ok"><sc-icon name="check" /> الإجمالي {{ usd(approveFor.view.total) }} · درجة {{ approveFor.view.score }}/100</div>
              <label class="field">
                <span>موعد التوريد المتوقع (هيظهر للسفينة)</span>
                <input type="date" [(ngModel)]="approveFor.date" [min]="todayIso" />
              </label>
            </div>
            <div class="modal-foot">
              <button type="button" class="btn" (click)="approveFor = null">إلغاء</button>
              <button type="button" class="btn btn-primary" [disabled]="!approveFor.date" (click)="doApprove()">اعتماد</button>
            </div>
          </div>
        </div>
      }

      @if (receiveRows) {
        <div class="modal-back" (click)="receiveRows = null">
          <div class="modal wide" (click)="$event.stopPropagation()">
            <div class="modal-head"><h3>استلام {{ catName(receiveGroup) }} — تأكيد الكمية والصنف</h3></div>
            <div class="modal-body">
              <div class="hint">راجع كل صنف على الطبيعة: لو الصنف مطابق ثبّت الكمية المستلمة فعلاً. أي صنف غير مطابق بيتسجل بصفر ولا يدخل المخزن.</div>
              <div class="table-wrap">
                <table class="tbl">
                  <thead><tr><th>الصنف</th><th>المطلوب</th><th>مطابق؟</th><th>الكمية المستلمة</th></tr></thead>
                  <tbody>
                    @for (row of receiveRows; track row.line.id) {
                      <tr>
                        <td><b>{{ row.line.name }}</b><div class="muted small">{{ row.line.description }}</div></td>
                        <td class="num">{{ row.line.qty }} {{ row.line.unit }}</td>
                        <td><label class="check"><input type="checkbox" [(ngModel)]="row.ok" /> مطابق</label></td>
                        <td><input type="number" min="0" style="width:110px" [disabled]="!row.ok" [(ngModel)]="row.qty" /></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <label class="field"><span>ملاحظات الاستلام</span><textarea rows="2" [(ngModel)]="receiveNote" placeholder="مثال: كسر في كرتونة واحدة"></textarea></label>
            </div>
            <div class="modal-foot">
              <button type="button" class="btn" (click)="receiveRows = null">إلغاء</button>
              <button type="button" class="btn btn-primary" (click)="doReceive()"><sc-icon name="check" /> تأكيد وتحديث المخزن</button>
            </div>
          </div>
        </div>
      }
    } @else {
      <div class="page"><div class="empty card"><sc-icon name="search" /> الطلب غير موجود. <a routerLink="/ship/requests">رجوع للطلبات</a></div></div>
    }
  `,
})
export class ShRequestDetail {
  readonly s = inject(ShipStore);
  private readonly route = inject(ActivatedRoute);
  readonly usd = usd;
  readonly fmt = fmt;
  readonly num = num;
  readonly dateLabel = dateLabel;
  readonly todayIso = today();

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), { initialValue: this.route.snapshot.paramMap.get('id') });
  readonly req = computed<Requisition | undefined>(() => this.s.requests().find((r) => r.id === this.id()));
  readonly meta = computed(() => REQ_STATUS[this.req()?.status ?? 'draft']);
  readonly groups = computed(() => (this.req() ? groupsOf(this.req()!) : []));
  readonly liveLines = computed(() => this.req()?.lines.filter((l) => !l.removed) ?? []);
  readonly removedCount = computed(() => this.req()?.lines.filter((l) => l.removed).length ?? 0);
  readonly anyReceived = computed(() => this.req()?.lines.some((l) => l.received != null) ?? false);
  readonly events = computed(() => [...(this.req()?.events ?? [])].reverse());
  private readonly picked = signal<string | null>(null);
  readonly group = computed(() => {
    const g = this.groups();
    const p = this.picked();
    return p && g.includes(p) ? p : (g[0] ?? null);
  });

  readonly showGroups = computed(() => {
    const r = this.req();
    return !!r && ['ready', 'sent', 'offers', 'approved', 'received'].includes(r.status) && this.groups().length > 0;
  });

  readonly editable = computed(() => {
    const r = this.req();
    if (!r) return false;
    if (r.status === 'draft') return this.s.can('request') || this.s.can('review');
    return (r.status === 'submitted' || r.status === 'ready') && this.s.can('review');
  });

  readonly steps = computed(() => {
    const r = this.req();
    if (!r) return [];
    const order = REQ_STATUS[r.status].order;
    const list = [
      { label: 'تقديم الطلب', done: order >= 1 },
      { label: 'مراجعة الإدارة', done: order >= 2 },
      { label: 'إرسال للموردين', done: r.sends.length > 0 || order >= 3 },
      { label: 'وصول العروض', done: r.offers.length > 0 || order >= 4 },
      { label: 'اعتماد العرض', done: order >= 5 },
      { label: 'الاستلام', done: order >= 6 },
    ];
    const firstOpen = list.findIndex((x) => !x.done);
    return list.map((x, i) => ({ ...x, now: i === firstOpen }));
  });

  confirmCancel = false;
  addProduct = '';
  addQty = 1;
  offerForm: OfferForm | null = null;
  approveFor: { groupId: string; view: OfferView; date: string } | null = null;
  receiveRows: ReceiveRow[] | null = null;
  receiveGroup = '';
  receiveNote = '';

  voyageLabel(): string {
    const id = this.req()?.voyageId;
    const v = this.s.voyages().find((x) => x.id === id);
    return v ? `رحلة ${v.number}` : '';
  }

  canCancel(): boolean {
    const r = this.req();
    if (!r || r.status === 'received' || r.status === 'cancelled') return false;
    return this.s.can('review') || (r.status === 'draft' && this.s.can('request'));
  }

  catName(id: string): string {
    return this.s.categories().find((c) => c.id === id)?.name ?? id;
  }

  pickGroup(g: string): void {
    this.picked.set(g);
  }

  groupLines(g: string): ReqLine[] {
    const r = this.req();
    return r ? activeLines(r, g) : [];
  }

  approvalOf(g: string) {
    return this.req()?.approvals.find((a) => a.groupId === g) ?? null;
  }

  approvedOffer(g: string): Offer | undefined {
    const a = this.approvalOf(g);
    return a ? this.req()?.offers.find((o) => o.id === a.offerId) : undefined;
  }

  isGroupReceived(g: string): boolean {
    const lines = this.groupLines(g);
    return lines.length > 0 && lines.every((l) => l.received != null);
  }

  groupState(g: string): string {
    const r = this.req();
    if (!r) return '';
    if (this.isGroupReceived(g)) return 'تم الاستلام';
    const a = this.approvalOf(g);
    if (a) return `معتمد · توريد ${dateLabel(a.expectedDate)}`;
    if (r.offers.some((o) => o.groupId === g)) return 'عروض وصلت';
    if (r.sends.some((x) => x.groupId === g)) return 'أُرسل للموردين';
    return 'جاهز للإرسال';
  }

  offerViews(g: string): OfferView[] {
    const r = this.req();
    return r ? scoreOffers(r, g, this.s.suppliers()) : [];
  }

  priceOf(offer: Offer, lineId: string): number {
    return offer.lines.find((l) => l.lineId === lineId)?.unitPrice ?? 0;
  }

  isMin(g: string, lineId: string, offer: Offer): boolean {
    const r = this.req();
    if (!r) return false;
    const mine = this.priceOf(offer, lineId);
    if (mine <= 0) return false;
    const prices = r.offers.filter((o) => o.groupId === g).map((o) => this.priceOf(o, lineId)).filter((p) => p > 0);
    return prices.length > 1 && mine === Math.min(...prices);
  }

  tone(v: OfferView, all: OfferView[]) {
    const min = Math.min(...all.map((x) => x.effective));
    return priceTone(min > 0 && Number.isFinite(v.effective) ? v.effective / min : 9);
  }

  indexOf(supplierId: string): number | null {
    const idx = supplierPriceIndex(supplierId, this.s.requests());
    return idx && idx > 1.005 ? idx : null;
  }

  rating(sup: Supplier): number | null {
    return supplierRating(sup);
  }

  suppliersFor(g: string): Supplier[] {
    const all = this.s.suppliers().filter((x) => x.active);
    const match = all.filter((x) => x.categoryIds.includes(g));
    return (match.length ? match : all).sort((a, b) => (supplierRating(b) ?? 0) - (supplierRating(a) ?? 0));
  }

  supPorts(sup: Supplier): string {
    return this.s
      .ports()
      .filter((p) => sup.portIds.includes(p.id))
      .map((p) => p.name)
      .join('، ') || '—';
  }

  sentAt(g: string, supplierId: string): string | null {
    return this.req()?.sends.find((x) => x.groupId === g && x.supplierId === supplierId)?.sentAt ?? null;
  }

  mail(g: string, sup: Supplier): string {
    const r = this.req();
    return r ? mailtoFor(this.s.vessel(), r, g, this.catName(g), sup) : '#';
  }

  pdf(g: string): void {
    const r = this.req();
    if (r) rfqPrint(this.s.vessel(), r, g, this.catName(g));
  }

  doAdd(): void {
    const r = this.req();
    if (r && this.addProduct) {
      this.s.addLine(r.id, this.addProduct, this.addQty);
      this.addProduct = '';
      this.addQty = 1;
    }
  }

  openOffer(g: string, offer?: Offer): void {
    const prices: Record<string, string> = {};
    for (const l of this.groupLines(g)) {
      const p = offer ? this.priceOf(offer, l.id) : 0;
      prices[l.id] = p > 0 ? String(p) : '';
    }
    this.offerForm = {
      id: offer?.id ?? uid('of'),
      groupId: g,
      supplierId: offer?.supplierId ?? '',
      date: offer?.date ?? today(),
      deliveryDays: offer?.deliveryDays ?? 7,
      validityDays: offer?.validityDays ?? 30,
      payment: offer?.payment ?? '',
      notes: offer?.notes ?? '',
      prices,
    };
  }

  saveOffer(): void {
    const f = this.offerForm;
    const r = this.req();
    if (!f || !r) return;
    const sup = this.s.suppliers().find((x) => x.id === f.supplierId);
    if (!sup) {
      this.s.notify('اختر المورد أولاً.', 'warn');
      return;
    }
    const lines = this.groupLines(f.groupId).map((l) => ({ lineId: l.id, unitPrice: num(f.prices[l.id]) > 0 ? num(f.prices[l.id]) : null }));
    if (!lines.some((l) => l.unitPrice)) {
      this.s.notify('أدخل سعر صنف واحد على الأقل.', 'warn');
      return;
    }
    const offer: Offer = {
      id: f.id,
      groupId: f.groupId,
      supplierId: sup.id,
      supplierName: sup.company,
      date: f.date,
      deliveryDays: num(f.deliveryDays),
      validityDays: num(f.validityDays),
      payment: f.payment,
      lines,
      notes: f.notes,
    };
    this.s.saveOffer(r.id, offer);
    this.offerForm = null;
  }

  openApprove(g: string, view: OfferView): void {
    this.approveFor = { groupId: g, view, date: addDays(today(), Math.max(1, view.offer.deliveryDays)) };
  }

  doApprove(): void {
    const a = this.approveFor;
    const r = this.req();
    if (a && r) {
      this.s.approveOffer(r.id, a.groupId, a.view.offer.id, a.date);
      this.approveFor = null;
    }
  }

  openReceive(g: string): void {
    this.receiveGroup = g;
    this.receiveNote = '';
    this.receiveRows = this.groupLines(g).map((line) => ({ line, qty: line.qty, ok: true }));
  }

  doReceive(): void {
    const r = this.req();
    const rows = this.receiveRows;
    if (!r || !rows) return;
    const received: Record<string, number> = {};
    const bad: string[] = [];
    for (const row of rows) {
      received[row.line.id] = row.ok ? Math.max(0, num(row.qty)) : 0;
      if (!row.ok) bad.push(row.line.name);
    }
    const note = [this.receiveNote, bad.length ? `غير مطابق: ${bad.join('، ')}` : ''].filter(Boolean).join(' — ');
    this.s.receiveGroup(r.id, this.receiveGroup, received, note);
    this.receiveRows = null;
  }

  /** قيمة المجموعة المعتمدة (لعرض سريع) */
  value(g: string): number {
    const r = this.req();
    if (!r) return 0;
    const v = purchaseValue(r, g);
    return v.actual + v.committed;
  }
}
