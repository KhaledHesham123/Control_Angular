import { Component, computed, inject, signal } from '@angular/core';
import { priceTone, supplierPriceIndex, supplierRating, uid } from '../core/ship-calc';
import { dateLabel } from '../core/ship-format';
import { ShipStore } from '../core/ship-store';
import { Supplier } from '../core/ship.types';

@Component({
  selector: 'sh-suppliers',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>الموردون والتقييم</h1>
          <p>الموردون وأقسامهم والموانئ اللي بيغطوها. التقييم ومؤشر الغلاء بيدخلوا في توصية العروض ومخطط المسار.</p>
        </div>
        <div class="actions">
          <input class="search" type="search" placeholder="بحث باسم المورد أو الدولة" [value]="q()" (input)="q.set($any($event.target).value)" />
          @if (s.can('suppliers')) {
            <button type="button" class="btn btn-primary" (click)="openEdit()"><sc-icon name="plus" /> مورد جديد</button>
          }
        </div>
      </div>

      <section class="card">
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead><tr><th>المورد</th><th>التواصل</th><th>الأقسام</th><th>الموانئ</th><th>التقييم</th><th>مستوى الأسعار</th><th></th></tr></thead>
            <tbody>
              @for (x of rows(); track x.id) {
                <tr [class.dim]="!x.active">
                  <td><b>{{ x.company }}</b><div class="muted small">{{ x.country }}</div></td>
                  <td class="small">
                    {{ x.contact }}<br />
                    <span class="ltr">{{ x.email }}</span><br />
                    <span class="ltr">{{ x.phone }}</span>
                  </td>
                  <td>
                    <div class="chips">
                      @for (c of x.categoryIds; track c) {
                        <span class="badge muted">{{ catName(c) }}</span>
                      }
                    </div>
                  </td>
                  <td class="small">{{ portNames(x) }}</td>
                  <td>
                    @if (rating(x); as r) {
                      <span class="stars">{{ starText(r) }}</span> <b>{{ r }}</b> <span class="muted small">({{ x.reviews.length }})</span>
                    } @else {
                      <span class="muted small">بدون تقييم</span>
                    }
                  </td>
                  <td>
                    @if (index(x.id); as ix) {
                      <span class="badge" [class]="'badge ' + tone(ix).tone">{{ tone(ix).label }}</span>
                    } @else {
                      <span class="muted small">لا بيانات مقارنة</span>
                    }
                  </td>
                  <td class="end tight">
                    <div class="row" style="justify-content:flex-end">
                      <button type="button" class="btn btn-sm" (click)="reviewFor.set(x.id)"><sc-icon name="star" /> التقييمات</button>
                      @if (s.can('suppliers')) {
                        <button type="button" class="btn btn-sm" (click)="openEdit(x)"><sc-icon name="edit" /></button>
                        <button type="button" class="btn btn-sm btn-danger" (click)="remove(x)"><sc-icon name="trash" /></button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (!rows().length) {
            <div class="empty"><sc-icon name="truck" /> لا يوجد موردون.</div>
          }
        </div>
      </section>
    </div>

    @if (form) {
      <div class="modal-back" (click)="form = null">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head"><h3>{{ isNew ? 'مورد جديد' : 'تعديل المورد' }}</h3><button type="button" class="btn btn-sm btn-ghost" (click)="form = null"><sc-icon name="x" /></button></div>
          <div class="modal-body">
            <div class="form-grid">
              <label class="field wide"><span>اسم الشركة</span><input type="text" [(ngModel)]="form.company" /></label>
              <label class="field"><span>جهة الاتصال</span><input type="text" [(ngModel)]="form.contact" /></label>
              <label class="field"><span>الدولة</span><input type="text" [(ngModel)]="form.country" /></label>
              <label class="field"><span>الإيميل (لإرسال طلبات الأسعار)</span><input type="email" dir="ltr" [(ngModel)]="form.email" /></label>
              <label class="field"><span>الهاتف</span><input type="text" dir="ltr" [(ngModel)]="form.phone" /></label>
            </div>
            <div class="field">
              <span>الأقسام اللي بيورّدها</span>
              <div class="chips">
                @for (c of roots(); track c.id) {
                  <button type="button" class="chip" [class.on]="form.categoryIds.includes(c.id)" (click)="toggle(form.categoryIds, c.id)">{{ c.name }}</button>
                }
              </div>
            </div>
            <div class="field">
              <span>الموانئ اللي بيخدمها</span>
              <div class="chips">
                @for (p of s.ports(); track p.id) {
                  <button type="button" class="chip" [class.on]="form.portIds.includes(p.id)" (click)="toggle(form.portIds, p.id)">{{ p.name }}</button>
                }
              </div>
            </div>
            <label class="field"><span>ملاحظات</span><textarea rows="2" [(ngModel)]="form.notes"></textarea></label>
            <label class="check"><input type="checkbox" [(ngModel)]="form.active" /> مورد نشط</label>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="form = null">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="save()"><sc-icon name="check" /> حفظ</button>
          </div>
        </div>
      </div>
    }

    @if (current(); as sup) {
      <div class="modal-back" (click)="reviewFor.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head"><h3>تقييمات {{ sup.company }}</h3><button type="button" class="btn btn-sm btn-ghost" (click)="reviewFor.set(null)"><sc-icon name="x" /></button></div>
          <div class="modal-body">
            @if (s.can('suppliers') || s.can('receive')) {
              <div class="card">
                <div class="card-body stack">
                  <b>أضف تقييماً بعد التعامل</b>
                  <div class="star-pick">
                    @for (n of [1, 2, 3, 4, 5]; track n) {
                      <button type="button" [class.on]="stars >= n" (click)="stars = n">★</button>
                    }
                  </div>
                  <textarea rows="2" [(ngModel)]="comment" placeholder="جودة، التزام بالمواعيد، الأسعار…"></textarea>
                  <div><button type="button" class="btn btn-primary btn-sm" (click)="addReview(sup.id)">حفظ التقييم</button></div>
                </div>
              </div>
            }
            <ul class="timeline">
              @for (r of sup.reviews; track r.id) {
                <li>
                  <span class="stars">{{ starText(r.stars) }}</span> {{ r.comment || 'بدون تعليق' }}
                  <small>{{ r.by }} · {{ dateLabel(r.date) }}</small>
                </li>
              }
            </ul>
            @if (!sup.reviews.length) {
              <div class="empty">لا توجد تقييمات بعد.</div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class ShSuppliers {
  readonly s = inject(ShipStore);
  readonly dateLabel = dateLabel;
  readonly q = signal('');
  readonly reviewFor = signal<string | null>(null);
  readonly roots = computed(() => this.s.categories().filter((c) => !c.parentId));
  readonly current = computed(() => this.s.suppliers().find((x) => x.id === this.reviewFor()) ?? null);
  form: Supplier | null = null;
  isNew = false;
  stars = 5;
  comment = '';

  readonly rows = computed(() => {
    const t = this.q().trim().toLowerCase();
    return this.s.suppliers().filter((x) => !t || x.company.toLowerCase().includes(t) || x.country.toLowerCase().includes(t));
  });

  catName(id: string): string {
    return this.s.categories().find((c) => c.id === id)?.name ?? id;
  }

  portNames(x: Supplier): string {
    return (
      this.s
        .ports()
        .filter((p) => x.portIds.includes(p.id))
        .map((p) => p.name)
        .join('، ') || '—'
    );
  }

  rating(x: Supplier): number | null {
    return supplierRating(x);
  }

  index(id: string): number | null {
    const all = Object.values(this.s.state().data).flatMap((d) => d.requests);
    return supplierPriceIndex(id, all);
  }

  tone(ix: number) {
    return priceTone(ix);
  }

  starText(n: number): string {
    const on = Math.round(n);
    return '★'.repeat(on) + '☆'.repeat(5 - on);
  }

  toggle(list: string[], id: string): void {
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    else list.push(id);
  }

  openEdit(x?: Supplier): void {
    this.isNew = !x;
    this.form = x
      ? { ...x, categoryIds: [...x.categoryIds], portIds: [...x.portIds], reviews: [...x.reviews] }
      : { id: uid('sup'), company: '', contact: '', email: '', phone: '', country: '', categoryIds: [], portIds: [], reviews: [], notes: '', active: true };
  }

  save(): void {
    const f = this.form;
    if (!f) return;
    if (!f.company.trim()) {
      this.s.notify('اكتب اسم الشركة.', 'warn');
      return;
    }
    if (!f.email.trim()) {
      this.s.notify('الإيميل مطلوب علشان نبعت له طلبات الأسعار.', 'warn');
      return;
    }
    this.s.saveSupplier(f);
    this.form = null;
  }

  remove(x: Supplier): void {
    if (window.confirm(`حذف المورد «${x.company}»؟`)) this.s.deleteSupplier(x.id);
  }

  addReview(id: string): void {
    this.s.addReview(id, this.stars, this.comment.trim());
    this.comment = '';
    this.stars = 5;
  }
}
