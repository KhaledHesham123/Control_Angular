import { Component, computed, inject, signal } from '@angular/core';
import { categoryPath, descendantIds, num, uid } from '../core/ship-calc';
import { ShipStore } from '../core/ship-store';
import { Category, Product, UNITS } from '../core/ship.types';

const ICONS = ['utensils', 'compass', 'anchor', 'shield', 'wrench', 'fuel', 'box', 'cube', 'tag', 'bolt', 'water'];

@Component({
  selector: 'sh-catalog',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>كتالوج الأقسام والأصناف</h1>
          <p>الأدمن بس هو اللي يضيف الأقسام والأصناف (قطع غيار، مأكولات، دهانات…). السفينة بتختار منها وهي بتعمل طلب الشراء أو بتصرف من المخزن.</p>
        </div>
        <div class="actions">
          <button type="button" class="btn" (click)="openCat(null)"><sc-icon name="plus" /> قسم رئيسي</button>
          <button type="button" class="btn btn-primary" (click)="openProduct()"><sc-icon name="plus" /> صنف جديد</button>
        </div>
      </div>

      <div class="grid" style="grid-template-columns: 290px minmax(0, 1fr); align-items: start">
        <section class="card">
          <div class="card-head"><h3>الأقسام</h3></div>
          <div class="card-body stack">
            <sc-cat-tree [categories]="s.categories()" [selected]="catId()" [counts]="counts()" (picked)="catId.set($event)" />
            @if (current(); as c) {
              <div class="row" style="border-top:1px solid var(--line);padding-top:10px">
                <button type="button" class="btn btn-sm" (click)="openCat(c)"><sc-icon name="edit" /> تعديل</button>
                @if (!c.parentId) {
                  <button type="button" class="btn btn-sm" (click)="openCat(null, c.id)"><sc-icon name="plus" /> فرعي</button>
                }
                <button type="button" class="btn btn-sm btn-danger" (click)="removeCat(c)"><sc-icon name="trash" /></button>
              </div>
            }
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <h3>{{ catId() ? path(catId()!) : 'كل الأصناف' }} ({{ rows().length }})</h3>
            <input class="search" type="search" placeholder="بحث" [value]="q()" (input)="q.set($any($event.target).value)" />
          </div>
          <div class="card-body flush table-wrap">
            <table class="tbl">
              <thead><tr><th>الصنف</th><th>الكود</th><th>القسم</th><th>الوحدة</th><th>الحد الأدنى</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                @for (p of rows(); track p.id) {
                  <tr [class.dim]="!p.active">
                    <td><b>{{ p.name }}</b></td>
                    <td class="small">{{ p.code }}</td>
                    <td class="small">{{ path(p.categoryId) }}</td>
                    <td>{{ p.unit }}</td>
                    <td class="num">{{ p.minLevel }}</td>
                    <td><span class="badge" [class]="'badge ' + (p.active ? 'ok' : 'muted')">{{ p.active ? 'نشط' : 'موقوف' }}</span></td>
                    <td class="end tight">
                      <button type="button" class="btn btn-sm" (click)="openProduct(p)"><sc-icon name="edit" /></button>
                      @if (p.active) {
                        <button type="button" class="btn btn-sm btn-danger" (click)="s.deleteProduct(p.id)" title="إيقاف"><sc-icon name="x" /></button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            @if (!rows().length) {
              <div class="empty"><sc-icon name="tag" /> لا توجد أصناف في هذا القسم.</div>
            }
          </div>
        </section>
      </div>
    </div>

    @if (catForm) {
      <div class="modal-back" (click)="catForm = null">
        <div class="modal narrow" (click)="$event.stopPropagation()">
          <div class="modal-head"><h3>{{ catIsNew ? 'قسم جديد' : 'تعديل القسم' }}</h3></div>
          <div class="modal-body">
            <label class="field"><span>اسم القسم</span><input type="text" [(ngModel)]="catForm.name" /></label>
            <label class="field">
              <span>يتبع القسم الرئيسي</span>
              <select [(ngModel)]="catForm.parentId">
                <option [ngValue]="null">— قسم رئيسي —</option>
                @for (r of roots(); track r.id) {
                  @if (r.id !== catForm.id) {
                    <option [ngValue]="r.id">{{ r.name }}</option>
                  }
                }
              </select>
            </label>
            @if (!catForm.parentId) {
              <label class="field">
                <span>الأيقونة</span>
                <select [(ngModel)]="catForm.icon">
                  @for (i of icons; track i) {
                    <option [value]="i">{{ i }}</option>
                  }
                </select>
              </label>
            }
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="catForm = null">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="saveCat()">حفظ</button>
          </div>
        </div>
      </div>
    }

    @if (prodForm) {
      <div class="modal-back" (click)="prodForm = null">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head"><h3>{{ prodIsNew ? 'صنف جديد' : 'تعديل الصنف' }}</h3></div>
          <div class="modal-body">
            <div class="form-grid">
              <label class="field wide"><span>اسم الصنف</span><input type="text" [(ngModel)]="prodForm.name" /></label>
              <label class="field">
                <span>القسم</span>
                <select [(ngModel)]="prodForm.categoryId">
                  @for (c of s.categories(); track c.id) {
                    <option [value]="c.id">{{ path(c.id) }}</option>
                  }
                </select>
              </label>
              <label class="field"><span>الكود</span><input type="text" [(ngModel)]="prodForm.code" /></label>
              <label class="field">
                <span>الوحدة</span>
                <select [(ngModel)]="prodForm.unit">
                  @for (u of units; track u) {
                    <option [value]="u">{{ u }}</option>
                  }
                </select>
              </label>
              <label class="field"><span>الحد الأدنى للمخزون</span><input type="number" min="0" [(ngModel)]="prodForm.minLevel" /></label>
            </div>
            <label class="check"><input type="checkbox" [(ngModel)]="prodForm.active" /> نشط (يظهر في الطلبات)</label>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="prodForm = null">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="saveProduct()">حفظ</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ShCatalog {
  readonly s = inject(ShipStore);
  readonly icons = ICONS;
  readonly units = UNITS;
  readonly catId = signal<string | null>(null);
  readonly q = signal('');
  catForm: Category | null = null;
  catIsNew = false;
  prodForm: Product | null = null;
  prodIsNew = false;

  readonly roots = computed(() => this.s.categories().filter((c) => !c.parentId));
  readonly current = computed(() => this.s.categories().find((c) => c.id === this.catId()) ?? null);

  readonly counts = computed(() => {
    const cats = this.s.categories();
    const out: Record<string, number> = { '*': this.s.products().length };
    for (const c of cats) {
      const ids = new Set(descendantIds(c.id, cats));
      out[c.id] = this.s.products().filter((p) => ids.has(p.categoryId)).length;
    }
    return out;
  });

  readonly rows = computed(() => {
    const cats = this.s.categories();
    const id = this.catId();
    const ids = id ? new Set(descendantIds(id, cats)) : null;
    const t = this.q().trim().toLowerCase();
    return this.s.products().filter((p) => (!ids || ids.has(p.categoryId)) && (!t || p.name.toLowerCase().includes(t) || p.code.toLowerCase().includes(t)));
  });

  path(id: string): string {
    return categoryPath(id, this.s.categories());
  }

  openCat(c: Category | null, parentId: string | null = null): void {
    this.catIsNew = !c;
    this.catForm = c ? { ...c } : { id: uid('c'), name: '', parentId, icon: 'tag' };
  }

  saveCat(): void {
    const f = this.catForm;
    if (!f || !f.name.trim()) {
      this.s.notify('اكتب اسم القسم.', 'warn');
      return;
    }
    this.s.saveCategory({ ...f, name: f.name.trim(), icon: f.parentId ? 'tag' : f.icon });
    this.catForm = null;
  }

  removeCat(c: Category): void {
    if (!window.confirm(`حذف القسم «${c.name}»؟`)) return;
    const err = this.s.deleteCategory(c.id);
    if (err) this.s.notify(err, 'bad');
    else this.catId.set(null);
  }

  openProduct(p?: Product): void {
    this.prodIsNew = !p;
    this.prodForm = p ? { ...p } : { id: uid('p'), categoryId: this.catId() ?? this.s.categories()[0]?.id ?? '', name: '', code: '', unit: UNITS[0], minLevel: 0, active: true };
  }

  saveProduct(): void {
    const f = this.prodForm;
    if (!f || !f.name.trim() || !f.categoryId) {
      this.s.notify('الاسم والقسم مطلوبان.', 'warn');
      return;
    }
    this.s.saveProduct({ ...f, name: f.name.trim(), minLevel: num(f.minLevel) });
    this.prodForm = null;
  }
}
