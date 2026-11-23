import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { categoryPath, descendantIds, num } from '../core/ship-calc';
import { fmt } from '../core/ship-format';
import { ShipStore } from '../core/ship-store';
import { Product } from '../core/ship.types';

interface CartLine {
  productId: string;
  qty: number;
  description: string;
}

@Component({
  selector: 'sh-request-new',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>طلب شراء جديد</h1>
          <p>اختار القسم أو القسم الفرعي، هتظهر الأصناف، حدّد الكمية والوصف وضيفها للطلب. بعد الإرسال الإدارة هي اللي تراجع وتبعت للموردين.</p>
        </div>
        <a class="btn" routerLink="/ship/requests"><sc-icon name="back" /> رجوع للطلبات</a>
      </div>

      @if (!s.can('request')) {
        <div class="readonly-note"><sc-icon name="lock" /> صلاحيتك الحالية للعرض فقط — غيّر الدور من القائمة الجانبية لإنشاء طلب.</div>
      }

      <div class="grid" style="grid-template-columns: 250px minmax(0, 1fr) 360px; align-items: start">
        <section class="card">
          <div class="card-head"><h3>الأقسام</h3></div>
          <div class="card-body">
            <sc-cat-tree [categories]="s.categories()" [selected]="catId()" [counts]="counts()" (picked)="catId.set($event)" />
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <h3>{{ catTitle() }}</h3>
            <div class="row">
              <input class="search" type="search" placeholder="بحث باسم الصنف أو الكود" [value]="q()" (input)="q.set($any($event.target).value)" />
              <button type="button" class="btn btn-sm" (click)="addLow()" [disabled]="!s.can('request')" title="يضيف الأصناف اللي أقل من الحد الأدنى في هذا القسم">
                <sc-icon name="sparkle" /> أضف الناقص
              </button>
            </div>
          </div>
          <div class="card-body stack">
            @for (p of products(); track p.id) {
              <div class="pick-item" [class.in-cart]="inCart(p.id)">
                <div>
                  <b>{{ p.name }}</b>
                  <div class="muted small">
                    {{ p.code }} · {{ path(p.categoryId) }} ·
                    الرصيد الحالي <b class="num">{{ fmt(stock(p.id), 1) }}</b> {{ p.unit }}
                    @if (p.minLevel > 0 && stock(p.id) < p.minLevel) {
                      <span class="badge bad">تحت الحد الأدنى ({{ p.minLevel }})</span>
                    }
                  </div>
                </div>
                @if (inCart(p.id)) {
                  <span class="badge ok"><sc-icon name="check" /> في الطلب</span>
                } @else {
                  <button type="button" class="btn btn-sm btn-primary" (click)="add(p)" [disabled]="!s.can('request')"><sc-icon name="plus" /> إضافة</button>
                }
              </div>
            }
            @if (!products().length) {
              <div class="empty"><sc-icon name="search" /> مفيش أصناف مطابقة. الأدمن يقدر يضيف أصناف جديدة من الكتالوج.</div>
            }
          </div>
        </section>

        <section class="card" style="position: sticky; top: 74px">
          <div class="card-head">
            <h3>سلة الطلب ({{ cart().length }})</h3>
            @if (cart().length) {
              <button type="button" class="btn btn-sm btn-ghost" (click)="cart.set([])">تفريغ</button>
            }
          </div>
          <div class="card-body stack">
            @for (l of cart(); track l.productId) {
              <div class="stack" style="padding-bottom:10px;border-bottom:1px solid var(--line)">
                <div class="between row">
                  <b>{{ name(l.productId) }}</b>
                  <button type="button" class="btn btn-sm btn-ghost btn-danger" (click)="remove(l.productId)" aria-label="حذف"><sc-icon name="trash" /></button>
                </div>
                <div class="row">
                  <div class="qty">
                    <button type="button" (click)="step(l.productId, -1)">−</button>
                    <input type="number" min="1" [value]="l.qty" (input)="setQty(l.productId, $any($event.target).value)" />
                    <button type="button" (click)="step(l.productId, 1)">+</button>
                  </div>
                  <span class="muted">{{ unit(l.productId) }}</span>
                </div>
                <input type="text" placeholder="وصف / مواصفات (اختياري)" [value]="l.description" (input)="setDesc(l.productId, $any($event.target).value)" />
              </div>
            }
            @if (!cart().length) {
              <div class="empty"><sc-icon name="cart" /> السلة فاضية — ضيف أصناف من القائمة.</div>
            }
            <label class="field">
              <span>الأولوية</span>
              <select [(ngModel)]="priority">
                <option value="normal">عادي</option>
                <option value="urgent">عاجل</option>
              </select>
            </label>
            <label class="field">
              <span>ملاحظات للإدارة</span>
              <textarea rows="2" [(ngModel)]="notes" placeholder="مثال: مطلوب قبل الوصول لميناء السويس"></textarea>
            </label>
            <button type="button" class="btn btn-primary btn-block" [disabled]="!cart().length || !s.can('request')" (click)="save(true)">
              <sc-icon name="send" /> إرسال للإدارة
            </button>
            <button type="button" class="btn btn-block" [disabled]="!cart().length || !s.can('request')" (click)="save(false)">حفظ كمسودة</button>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class ShRequestNew {
  readonly s = inject(ShipStore);
  private readonly router = inject(Router);
  readonly fmt = fmt;

  readonly catId = signal<string | null>(null);
  readonly q = signal('');
  readonly cart = signal<CartLine[]>([]);
  priority: 'normal' | 'urgent' = 'normal';
  notes = '';

  readonly counts = computed(() => {
    const cats = this.s.categories();
    const prods = this.s.products().filter((p) => p.active);
    const out: Record<string, number> = { '*': prods.length };
    for (const c of cats) {
      const ids = new Set(descendantIds(c.id, cats));
      out[c.id] = prods.filter((p) => ids.has(p.categoryId)).length;
    }
    return out;
  });

  readonly products = computed(() => {
    const cats = this.s.categories();
    const id = this.catId();
    const ids = id ? new Set(descendantIds(id, cats)) : null;
    const term = this.q().trim().toLowerCase();
    return this.s
      .products()
      .filter((p) => p.active && (!ids || ids.has(p.categoryId)) && (!term || p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term)));
  });

  readonly catTitle = computed(() => (this.catId() ? categoryPath(this.catId(), this.s.categories()) : 'كل الأصناف'));

  stock(id: string): number {
    return this.s.data().stock[id] ?? 0;
  }

  path(id: string): string {
    return categoryPath(id, this.s.categories());
  }

  name(id: string): string {
    return this.s.products().find((p) => p.id === id)?.name ?? '';
  }

  unit(id: string): string {
    return this.s.products().find((p) => p.id === id)?.unit ?? '';
  }

  inCart(id: string): boolean {
    return this.cart().some((l) => l.productId === id);
  }

  add(p: Product, qty = 1): void {
    if (this.inCart(p.id)) return;
    this.cart.update((c) => [...c, { productId: p.id, qty, description: '' }]);
  }

  addLow(): void {
    let added = 0;
    for (const p of this.products()) {
      if (p.minLevel > 0 && this.stock(p.id) < p.minLevel && !this.inCart(p.id)) {
        this.add(p, Math.max(1, Math.ceil(p.minLevel * 2 - this.stock(p.id))));
        added++;
      }
    }
    this.s.notify(added ? `تمت إضافة ${added} صنف ناقص بكميات مقترحة — عدّلها حسب الحاجة.` : 'لا توجد أصناف ناقصة في هذا القسم.', added ? 'ok' : 'warn');
  }

  remove(id: string): void {
    this.cart.update((c) => c.filter((l) => l.productId !== id));
  }

  step(id: string, delta: number): void {
    this.cart.update((c) => c.map((l) => (l.productId === id ? { ...l, qty: Math.max(1, num(l.qty) + delta) } : l)));
  }

  setQty(id: string, value: string): void {
    this.cart.update((c) => c.map((l) => (l.productId === id ? { ...l, qty: Math.max(0, num(value)) } : l)));
  }

  setDesc(id: string, value: string): void {
    this.cart.update((c) => c.map((l) => (l.productId === id ? { ...l, description: value } : l)));
  }

  save(submit: boolean): void {
    const id = this.s.createRequest(this.cart(), this.notes, this.priority, submit);
    if (id) {
      void this.router.navigate(['/ship/requests', id]);
    } else {
      this.s.notify('أضف صنفاً واحداً على الأقل بكمية أكبر من صفر.', 'warn');
    }
  }
}
