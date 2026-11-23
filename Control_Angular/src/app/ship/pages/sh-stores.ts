import { Component, computed, inject, signal } from '@angular/core';
import { categoryPath, descendantIds, gaugeOf, num, rootOf, today } from '../core/ship-calc';
import { dateLabel, downloadCsv, fmt } from '../core/ship-format';
import { ShipStore } from '../core/ship-store';
import { DEPARTMENTS, Product } from '../core/ship.types';

type Mode = 'issue' | 'in' | 'adjust';
type Tab = 'stock' | 'issues';

interface StoreForm {
  mode: Mode;
  productId: string;
  qty: number;
  department: string;
  by: string;
  date: string;
  note: string;
}

@Component({
  selector: 'sh-stores',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>المخزن والصرف</h1>
          <p>كل صنف ليه رصيد وحد أدنى. «صرف» بيخصم من الرصيد ويسجل مين أخد وإيه القسم، و«استلام» بيزود الرصيد (الاستلام من طلبات الشراء بيتم من الطلب نفسه).</p>
        </div>
        <div class="actions">
          @if (s.can('issue')) {
            <button type="button" class="btn btn-primary" (click)="open('issue')"><sc-icon name="up" /> صرف صنف</button>
          }
          @if (s.can('request')) {
            <a class="btn" routerLink="/ship/requests/new"><sc-icon name="cart" /> طلب شراء</a>
          }
        </div>
      </div>

      <div class="kpis">
        <div class="kpi"><label>عدد الأصناف</label><strong>{{ activeCount() }}</strong></div>
        <div class="kpi warn"><label>تحت الحد الأدنى</label><strong>{{ lowCount() }}</strong></div>
        <div class="kpi bad"><label>رصيد صفر</label><strong>{{ zeroCount() }}</strong></div>
        <div class="kpi gold"><label>عمليات صرف آخر 7 أيام</label><strong>{{ weekIssues() }}</strong></div>
      </div>

      <div class="row between">
        <div class="tabs">
          <button type="button" class="tab" [class.on]="tab() === 'stock'" (click)="tab.set('stock')">أرصدة المخزن</button>
          <button type="button" class="tab" [class.on]="tab() === 'issues'" (click)="tab.set('issues')">سجل الصرف (من أخذ ماذا)</button>
        </div>
        <input class="search" type="search" placeholder="بحث بالاسم أو الكود" [value]="q()" (input)="q.set($any($event.target).value)" />
      </div>

      @if (tab() === 'stock') {
        <div class="grid" style="grid-template-columns: 250px minmax(0, 1fr); align-items: start">
          <section class="card">
            <div class="card-head"><h3>الأقسام</h3></div>
            <div class="card-body"><sc-cat-tree [categories]="s.categories()" [selected]="catId()" [counts]="counts()" (picked)="catId.set($event)" /></div>
          </section>

          <section class="card">
            <div class="card-head">
              <h3>{{ catId() ? path(catId()!) : 'كل الأصناف' }}</h3>
              <label class="check"><input type="checkbox" [checked]="lowOnly()" (change)="lowOnly.set($any($event.target).checked)" /> الناقص فقط</label>
            </div>
            <div class="card-body flush table-wrap">
              <table class="tbl">
                <thead><tr><th>الصنف</th><th>الرصيد</th><th>الحد الأدنى</th><th style="min-width:130px">المستوى</th><th></th></tr></thead>
                <tbody>
                  @for (p of rows(); track p.id) {
                    <tr>
                      <td><b>{{ p.name }}</b><div class="muted small">{{ p.code }} · {{ path(p.categoryId) }}</div></td>
                      <td><b class="num">{{ fmt(stock(p), 2) }}</b> {{ p.unit }}</td>
                      <td class="num">{{ p.minLevel || '—' }}</td>
                      <td>
                        @if (p.minLevel > 0) {
                          <div class="gauge" [class]="'gauge ' + level(p).tone"><i [style.width.%]="level(p).percent"></i></div>
                          @if (stock(p) <= 0) { <span class="badge bad">نفد</span> }
                          @else if (stock(p) < p.minLevel) { <span class="badge warn">ناقص</span> }
                        } @else {
                          <span class="muted small">بدون حد</span>
                        }
                      </td>
                      <td class="end tight">
                        <div class="row" style="justify-content:flex-end">
                          @if (s.can('issue')) {
                            <button type="button" class="btn btn-sm btn-primary" [disabled]="stock(p) <= 0" (click)="open('issue', p)"><sc-icon name="up" /> صرف</button>
                          }
                          @if (s.can('receive')) {
                            <button type="button" class="btn btn-sm" (click)="open('in', p)"><sc-icon name="down" /> استلام</button>
                          }
                          @if (s.can('review')) {
                            <button type="button" class="btn btn-sm" (click)="open('adjust', p)" title="جرد وتصحيح الرصيد"><sc-icon name="edit" /></button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
              @if (!rows().length) {
                <div class="empty"><sc-icon name="box" /> لا توجد أصناف مطابقة.</div>
              }
            </div>
          </section>
        </div>
      } @else {
        <section class="card">
          <div class="card-head">
            <h3>عمليات الصرف</h3>
            <div class="row">
              <select [value]="dept()" (change)="dept.set($any($event.target).value)">
                <option value="">كل الأقسام</option>
                @for (d of departments; track d) {
                  <option [value]="d">{{ d }}</option>
                }
              </select>
              <button type="button" class="btn btn-sm" (click)="exportIssues()"><sc-icon name="down" /> CSV</button>
            </div>
          </div>
          <div class="card-body flush table-wrap">
            <table class="tbl">
              <thead><tr><th>اليوم</th><th>الصنف</th><th>الكمية</th><th>القسم</th><th>أخذه</th><th>الرصيد بعد</th><th>ملاحظة</th></tr></thead>
              <tbody>
                @for (m of issues(); track m.id) {
                  <tr>
                    <td>{{ dateLabel(m.date) }}</td>
                    <td><b>{{ m.name }}</b></td>
                    <td class="num">{{ m.qty }} {{ m.unit }}</td>
                    <td><span class="badge muted">{{ m.department }}</span></td>
                    <td>{{ m.by }}</td>
                    <td class="num">{{ m.balanceAfter }}</td>
                    <td class="small">{{ m.note || '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
            @if (!issues().length) {
              <div class="empty">لا توجد عمليات صرف مسجلة.</div>
            }
          </div>
        </section>
      }
    </div>

    @if (form) {
      <div class="modal-back" (click)="form = null">
        <div class="modal narrow" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>{{ form.mode === 'issue' ? 'صرف من المخزن' : form.mode === 'in' ? 'استلام يدوي في المخزن' : 'جرد وتصحيح الرصيد' }}</h3>
            <button type="button" class="btn btn-sm btn-ghost" (click)="form = null"><sc-icon name="x" /></button>
          </div>
          <div class="modal-body">
            <label class="field">
              <span>الصنف</span>
              <select [(ngModel)]="form.productId" (ngModelChange)="onProduct($event)">
                @for (p of allProducts(); track p.id) {
                  <option [value]="p.id">{{ p.name }} — الرصيد {{ fmt(stock(p), 1) }} {{ p.unit }}</option>
                }
              </select>
            </label>
            <label class="field">
              <span>{{ form.mode === 'adjust' ? 'الرصيد الفعلي بعد الجرد' : 'الكمية' }}</span>
              <input type="number" min="0" step="any" [(ngModel)]="form.qty" />
            </label>
            @if (form.mode === 'issue') {
              <label class="field">
                <span>القسم اللي أخذ الصنف</span>
                <select [(ngModel)]="form.department">
                  @for (d of departments; track d) {
                    <option [value]="d">{{ d }}</option>
                  }
                </select>
              </label>
              <label class="field">
                <span>اسم الشخص</span>
                <input type="text" list="crew-names" [(ngModel)]="form.by" placeholder="اختر أو اكتب الاسم" />
                <datalist id="crew-names">
                  @for (c of s.crewOnBoard(); track c.id) {
                    <option [value]="c.name">{{ c.rank }}</option>
                  }
                </datalist>
              </label>
              <label class="field"><span>تاريخ الصرف</span><input type="date" [(ngModel)]="form.date" [max]="todayIso" /></label>
            }
            <label class="field"><span>ملاحظة</span><input type="text" [(ngModel)]="form.note" [placeholder]="form.mode === 'issue' ? 'مثال: صيانة ونش 2' : ''" /></label>
            @if (preview(); as pv) {
              <div class="alert" [class]="'alert ' + pv.tone"><sc-icon name="info" /> {{ pv.text }}</div>
            }
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="form = null">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="submit()"><sc-icon name="check" /> حفظ وتحديث المخزن</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ShStores {
  readonly s = inject(ShipStore);
  readonly fmt = fmt;
  readonly dateLabel = dateLabel;
  readonly departments = DEPARTMENTS;
  readonly todayIso = today();

  readonly tab = signal<Tab>('stock');
  readonly catId = signal<string | null>(null);
  readonly q = signal('');
  readonly lowOnly = signal(false);
  readonly dept = signal('');
  form: StoreForm | null = null;

  readonly allProducts = computed(() => this.s.products().filter((p) => p.active));
  readonly activeCount = computed(() => this.allProducts().length);
  readonly lowCount = computed(() => this.allProducts().filter((p) => p.minLevel > 0 && this.stock(p) < p.minLevel).length);
  readonly zeroCount = computed(() => this.allProducts().filter((p) => this.stock(p) <= 0).length);
  readonly weekIssues = computed(() => {
    const from = new Date();
    from.setDate(from.getDate() - 7);
    const iso = from.toISOString().slice(0, 10);
    return this.s.movements().filter((m) => m.kind === 'out' && m.source === 'item' && m.date >= iso).length;
  });

  readonly counts = computed(() => {
    const cats = this.s.categories();
    const prods = this.allProducts();
    const out: Record<string, number> = { '*': prods.length };
    for (const c of cats) {
      const ids = new Set(descendantIds(c.id, cats));
      out[c.id] = prods.filter((p) => ids.has(p.categoryId)).length;
    }
    return out;
  });

  readonly rows = computed(() => {
    const cats = this.s.categories();
    const id = this.catId();
    const ids = id ? new Set(descendantIds(id, cats)) : null;
    const term = this.q().trim().toLowerCase();
    return this.allProducts().filter(
      (p) =>
        (!ids || ids.has(p.categoryId)) &&
        (!term || p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term)) &&
        (!this.lowOnly() || (p.minLevel > 0 && this.stock(p) < p.minLevel)),
    );
  });

  readonly issues = computed(() => {
    const term = this.q().trim().toLowerCase();
    const d = this.dept();
    return this.s
      .movements()
      .filter((m) => m.kind === 'out' && m.source === 'item')
      .filter((m) => (!d || m.department === d) && (!term || m.name.toLowerCase().includes(term) || m.by.toLowerCase().includes(term)));
  });

  stock(p: Product): number {
    return this.s.data().stock[p.id] ?? 0;
  }

  level(p: Product) {
    return gaugeOf(this.stock(p), p.minLevel * 2.5);
  }

  path(id: string): string {
    return categoryPath(id, this.s.categories());
  }

  open(mode: Mode, p?: Product): void {
    const first = p ?? this.rows()[0] ?? this.allProducts()[0];
    this.form = {
      mode,
      productId: first?.id ?? '',
      qty: mode === 'adjust' && first ? this.stock(first) : 1,
      department: first ? this.deptFor(first) : DEPARTMENTS[0],
      by: this.s.actor(),
      date: today(),
      note: '',
    };
  }

  /** القسم الافتراضي اللي بيصرف الصنف، حسب القسم الرئيسي للصنف. */
  deptFor(p: Product): string {
    const root = rootOf(p.categoryId, this.s.categories())?.name ?? '';
    const rules: [string, string][] = [
      ['المطبخ', 'المطبخ'],
      ['الكوبري', 'الكوبري (الملاحة)'],
      ['السطح', 'السطح'],
      ['السلامة', 'السلامة'],
      ['الزيوت', 'غرفة المحركات'],
      ['قطع الغيار', 'غرفة المحركات'],
    ];
    const hit = rules.find(([key]) => root.includes(key));
    return hit && DEPARTMENTS.includes(hit[1]) ? hit[1] : DEPARTMENTS[0];
  }

  onProduct(id: string): void {
    const f = this.form;
    const p = this.allProducts().find((x) => x.id === id);
    if (!f || !p) return;
    f.department = this.deptFor(p);
    if (f.mode === 'adjust') f.qty = this.stock(p);
  }

  preview(): { text: string; tone: string } | null {
    const f = this.form;
    const p = this.allProducts().find((x) => x.id === f?.productId);
    if (!f || !p) return null;
    const cur = this.stock(p);
    const q = num(f.qty);
    if (f.mode === 'issue') {
      if (q > cur) return { text: `الكمية أكبر من الرصيد (${fmt(cur, 2)} ${p.unit}).`, tone: 'bad' };
      const after = cur - q;
      return { text: `الرصيد بعد الصرف: ${fmt(after, 2)} ${p.unit}${p.minLevel > 0 && after < p.minLevel ? ' — تحت الحد الأدنى، جهّز طلب شراء.' : ''}`, tone: p.minLevel > 0 && after < p.minLevel ? 'warn' : 'ok' };
    }
    if (f.mode === 'in') return { text: `الرصيد بعد الاستلام: ${fmt(cur + q, 2)} ${p.unit}`, tone: 'ok' };
    return { text: `الرصيد الحالي ${fmt(cur, 2)} ← الجديد ${fmt(q, 2)} ${p.unit}`, tone: 'warn' };
  }

  submit(): void {
    const f = this.form;
    if (!f) return;
    const err =
      f.mode === 'issue'
        ? this.s.issueItem(f.productId, f.qty, f.by, f.department, f.note, f.date)
        : f.mode === 'in'
          ? this.s.receiveItem(f.productId, f.qty, f.note || 'استلام يدوي', today())
          : this.s.adjustItem(f.productId, f.qty, f.note);
    if (err) {
      this.s.notify(err, 'bad');
    } else {
      this.form = null;
    }
  }

  exportIssues(): void {
    downloadCsv('issues.csv', [
      ['اليوم', 'الصنف', 'الكمية', 'الوحدة', 'القسم', 'أخذه', 'الرصيد بعد', 'ملاحظة'],
      ...this.issues().map((m) => [m.date, m.name, m.qty, m.unit, m.department, m.by, m.balanceAfter, m.note]),
    ]);
  }
}
