import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { CategoryCatalogService } from '../products/category-catalog.service';
import { ProductDto } from '../products/product.model';
import { ProductService } from '../products/product.service';
import { categoryPath, descendantIds } from '../ship/core/ship-calc';
import { Category } from '../ship/core/ship.types';
import { CategoryService } from './category.service';
import { RfqRequestService } from './rfq-request.service';
import {
  formatCategoryLabel,
  GeneratedSupplierRfqEmail,
  RfqRequest,
  SelectedRfqProduct,
} from './rfq.model';

interface CatalogProduct {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  unit: string;
  description: string | null;
}

type WizardStep = 1 | 2;

@Component({
  selector: 'app-create-rfq',
  standalone: false,
  templateUrl: './create-rfq.html',
  styleUrl: './create-rfq.css',
})
export class CreateRfq implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly categoryCatalog = inject(CategoryCatalogService);
  private readonly categoryService = inject(CategoryService);
  private readonly rfqRequestService = inject(RfqRequestService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loadingProducts = signal(false);
  readonly creating = signal(false);
  readonly loadingRfq = signal(false);
  readonly generating = signal(false);

  readonly error = signal<string | null>(null);
  readonly status = signal<string | null>(null);

  readonly products = signal<ProductDto[]>([]);
  readonly categoryOptions = signal<Array<{ id: string; name: string }>>([]);
  readonly checkedCategoryIds = signal<string[]>([]);
  readonly selectedProducts = signal<Record<string, SelectedRfqProduct>>({});
  readonly requestNotes = signal('');

  readonly step = signal<WizardStep>(1);
  readonly rfqId = signal<string | null>(null);
  readonly rfq = signal<RfqRequest | null>(null);

  readonly emailSubject = signal('');
  readonly emailBody = signal('');
  readonly generatedEmails = signal<GeneratedSupplierRfqEmail[]>([]);
  readonly generatedTitle = signal<string | null>(null);

  readonly selectedCount = computed(() => Object.keys(this.selectedProducts()).length);
  readonly rfqStatusLabel = computed(() => this.statusLabel(this.rfq()?.status));

  readonly loadingCatalog = signal(false);
  readonly catId = signal<string | null>(null);
  readonly q = signal('');
  readonly tree = signal<Category[]>([]);
  readonly catalog = signal<CatalogProduct[]>([]);

  readonly cartLines = computed(() => Object.values(this.selectedProducts()));

  readonly counts = computed(() => {
    const cats = this.tree();
    const prods = this.catalog();
    const out: Record<string, number> = { '*': prods.length };
    for (const category of cats) {
      const ids = new Set(descendantIds(category.id, cats));
      out[category.id] = prods.filter((product) => ids.has(product.categoryId)).length;
    }
    return out;
  });

  readonly visibleProducts = computed(() => {
    const cats = this.tree();
    const id = this.catId();
    const ids = id ? new Set(descendantIds(id, cats)) : null;
    const term = this.q().trim().toLowerCase();
    return this.catalog().filter(
      (product) =>
        (!ids || ids.has(product.categoryId)) &&
        (!term ||
          product.name.toLowerCase().includes(term) ||
          product.code.toLowerCase().includes(term)),
    );
  });

  readonly catTitle = computed(() =>
    this.catId() ? categoryPath(this.catId(), this.tree()) : 'كل الأصناف',
  );

  ngOnInit(): void {
    this.title.setTitle('طلب شراء جديد | Falcon Shipping');
    this.loadCatalog();

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id')?.trim() ?? '';
      if (!id) {
        return;
      }
      this.rfqId.set(id);
      this.step.set(2);
      this.loadRfq(id);
    });
  }

  onCategoriesChange(categoryIds: string[]): void {
    this.checkedCategoryIds.set(categoryIds);
    this.error.set(null);
    this.loadProducts();
  }

  onCategoryLoaded(categories: Array<{ id: string; name: string }>): void {
    this.categoryOptions.set(categories);
  }

  onCategoryFailed(message: string): void {
    this.error.set(message);
  }

  loadProducts(): void {
    const categoryIds = this.checkedCategoryIds();
    if (categoryIds.length === 0) {
      this.products.set([]);
      this.loadingProducts.set(false);
      return;
    }

    this.loadingProducts.set(true);
    this.error.set(null);

    forkJoin(categoryIds.map((categoryId) => this.productService.getByCategory(categoryId, false)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (results) => {
          this.loadingProducts.set(false);
          const failed = results.find((result) => !result.succeeded || !result.data);
          if (failed) {
            this.products.set([]);
            this.error.set(failed.messages?.join(' ') || 'تعذر تحميل المنتجات.');
            return;
          }

          const merged = new Map<string, ProductDto>();
          for (const result of results) {
            for (const product of result.data ?? []) {
              if (product.isActive) {
                merged.set(product.id, product);
              }
            }
          }
          this.products.set([...merged.values()]);
        },
        error: (err: HttpErrorResponse) => {
          this.loadingProducts.set(false);
          this.products.set([]);
          this.error.set(this.readError(err, 'تعذر تحميل المنتجات.'));
        },
      });
  }

  productGroups(): { categoryId: string; categoryName: string; products: ProductDto[] }[] {
    const groups = new Map<string, { categoryId: string; categoryName: string; products: ProductDto[] }>();
    for (const product of this.products()) {
      const categoryId = product.categoryId || 'none';
      const group = groups.get(categoryId) ?? {
        categoryId,
        categoryName: product.categoryName || 'منتجات',
        products: [],
      };
      group.products.push(product);
      groups.set(categoryId, group);
    }
    return [...groups.values()];
  }

  loadCatalog(): void {
    this.loadingCatalog.set(true);
    forkJoin({
      categories: this.categoryCatalog.lookup(),
      withProducts: this.categoryService.getWithProducts(false),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ categories, withProducts }) => {
          this.loadingCatalog.set(false);
          const tree = (categories.data ?? [])
            .filter((category) => category.id)
            .map((category) => ({
              id: category.id,
              name: category.name,
              parentId: category.parentCategoryId,
              icon: 'tag',
            }));
          this.tree.set(tree);

          const products: CatalogProduct[] = [];
          for (const category of withProducts.data ?? []) {
            for (const product of category.products ?? []) {
              if (!product.isActive) {
                continue;
              }
              products.push({
                id: product.id,
                categoryId: category.id,
                name: product.name,
                code: product.code ?? '',
                unit: product.defaultUnit,
                description: product.description,
              });
            }
          }
          this.catalog.set(products);
          if (!categories.succeeded && !withProducts.succeeded) {
            this.error.set('تعذر تحميل الأقسام والأصناف.');
          }
        },
        error: (err: HttpErrorResponse) => {
          this.loadingCatalog.set(false);
          this.error.set(this.readError(err, 'تعذر تحميل الأقسام والأصناف.'));
        },
      });
  }

  path(id: string): string {
    return categoryPath(id, this.tree());
  }

  inCart(id: string): boolean {
    return !!this.selectedProducts()[id];
  }

  addProduct(product: CatalogProduct): void {
    if (this.creating() || this.inCart(product.id)) {
      return;
    }
    const current = { ...this.selectedProducts() };
    current[product.id] = {
      productId: product.id,
      name: product.name,
      code: product.code,
      unit: product.unit,
      quantity: 1,
      notes: '',
      categoryId: product.categoryId,
      categoryName: this.path(product.categoryId) || 'قسم',
    };
    this.selectedProducts.set(current);
  }

  removeLine(productId: string): void {
    const current = { ...this.selectedProducts() };
    delete current[productId];
    this.selectedProducts.set(current);
  }

  stepQty(productId: string, delta: number): void {
    const line = this.selectedProducts()[productId];
    if (!line) {
      return;
    }
    this.updateQuantity(productId, line.quantity + delta);
  }

  isProductSelected(productId: string): boolean {
    return !!this.selectedProducts()[productId];
  }

  selectedProduct(productId: string): SelectedRfqProduct | null {
    return this.selectedProducts()[productId] ?? null;
  }

  toggleProduct(product: ProductDto): void {
    if (this.creating() || this.step() !== 1) {
      return;
    }

    const current = { ...this.selectedProducts() };
    if (current[product.id]) {
      delete current[product.id];
      this.selectedProducts.set(current);
      return;
    }

    current[product.id] = {
      productId: product.id,
      name: product.name,
      code: product.code,
      unit: product.defaultUnit,
      quantity: 1,
      notes: '',
      categoryId: product.categoryId || '',
      categoryName: product.categoryName || 'Category',
    };
    this.selectedProducts.set(current);
  }

  updateQuantity(productId: string, value: string | number): void {
    const quantity = Math.max(1, Number(value) || 1);
    this.patchSelected(productId, { quantity });
  }

  updateItemNotes(productId: string, notes: string): void {
    this.patchSelected(productId, { notes });
  }

  clearCategorySelection(): void {
    this.checkedCategoryIds.set([]);
    this.products.set([]);
  }

  checkedCategoryLabel(): string {
    const names = this.checkedCategoryIds()
      .map((id) => this.categoryOptions().find((item) => item.id === id)?.name)
      .filter((name): name is string => !!name);
    return names.join(' · ') || '—';
  }

  clearSelectedProducts(): void {
    this.selectedProducts.set({});
  }

  selectedCategoryIds(): string[] {
    return [...new Set(Object.values(this.selectedProducts()).map((item) => item.categoryId).filter(Boolean))];
  }

  selectedCategoryLabel(): string {
    const names = [...new Set(Object.values(this.selectedProducts()).map((item) => item.categoryName).filter(Boolean))];
    return names.join(' · ') || '—';
  }

  categoryNames(categories: { id: string; name: string }[] | null | undefined): string {
    return (categories ?? []).map((c) => formatCategoryLabel(c)).filter(Boolean).join(' · ') || '—';
  }

  createRfq(): void {
    const items = Object.values(this.selectedProducts());
    const categoryIds = this.selectedCategoryIds();

    if (categoryIds.length === 0) {
      this.error.set('اختَر منتجات من فئة واحدة على الأقل.');
      return;
    }

    if (items.length === 0) {
      this.error.set('اختر منتجًا واحدًا على الأقل.');
      return;
    }

    if (items.some((item) => item.quantity < 1)) {
      this.error.set('كمية كل منتج يجب أن تكون أكبر من صفر.');
      return;
    }

    this.creating.set(true);
    this.error.set(null);

    this.rfqRequestService
      .create({
        categoryIds,
        title: null,
        notes: this.requestNotes().trim() || null,
        startDate: null,
        deliveryDate: null,
        latestDeliveryDate: null,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          notes: item.notes.trim() || null,
        })),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.creating.set(false);
          this.status.set(result.messages?.filter(Boolean).join(' ') || null);

          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'Failed to create RFQ request.');
            return;
          }

          void this.router.navigateByUrl('/rfq');
        },
        error: (err: HttpErrorResponse) => {
          this.creating.set(false);
          this.error.set(this.readError(err, 'Failed to create RFQ request.'));
        },
      });
  }

  loadRfq(id: string): void {
    this.loadingRfq.set(true);
    this.error.set(null);

    this.rfqRequestService
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loadingRfq.set(false);
          this.status.set(result.messages?.filter(Boolean).join(' ') || null);

          if (!result.succeeded || !result.data) {
            this.rfq.set(null);
            this.error.set(result.messages?.join(' ') || 'تعذر تحميل تفاصيل RFQ.');
            return;
          }

          this.rfq.set({
            ...result.data,
            items: [...(result.data.items ?? [])].sort((left, right) =>
              left.itemNo.localeCompare(right.itemNo, undefined, {
                numeric: true,
                sensitivity: 'base',
              }),
            ),
            supplierEmails: [...(result.data.supplierEmails ?? [])],
          });

          this.emailSubject.set(result.data.subject ?? '');
          this.emailBody.set(result.data.body ?? '');
        },
        error: (err: HttpErrorResponse) => {
          this.loadingRfq.set(false);
          this.rfq.set(null);
          this.error.set(this.readError(err, 'تعذر تحميل تفاصيل RFQ.'));
        },
      });
  }

  generateByAi(): void {
    const id = this.rfqId();
    if (!id || this.generating()) {
      return;
    }

    const supplierIds = (this.rfq()?.supplierEmails ?? [])
      .map((email) => email.supplierId)
      .filter((supplierId) => !!supplierId);

    if (supplierIds.length === 0) {
      this.error.set('لا يوجد موردين مرتبطين بهذا الطلب لتوليد الإيميل.');
      return;
    }

    this.generating.set(true);
    this.error.set(null);

    this.rfqRequestService
      .generateEmailContentForSuppliers({ id, supplierIds })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.generating.set(false);
          this.status.set(result.messages?.filter(Boolean).join(' ') || null);

          if (!result.succeeded || !result.data) {
            this.error.set(result.messages?.join(' ') || 'تعذر توليد محتوى الإيميل بالـ AI.');
            return;
          }

          this.generatedTitle.set(result.data.title);
          this.emailSubject.set(result.data.subject ?? '');
          this.generatedEmails.set(result.data.emails ?? []);

          if (!this.emailBody().trim() && result.data.emails?.length) {
            this.emailBody.set(result.data.emails[0].body ?? '');
          }
        },
        error: (err: HttpErrorResponse) => {
          this.generating.set(false);
          this.error.set(this.readError(err, 'تعذر توليد محتوى الإيميل بالـ AI.'));
        },
      });
  }

  goToStep(step: WizardStep): void {
    if (step === 2 && !this.rfqId()) {
      return;
    }
    this.step.set(step);
    if (step === 2 && this.rfqId() && !this.rfq()) {
      this.loadRfq(this.rfqId()!);
    }
  }

  startNew(): void {
    this.step.set(1);
    this.rfqId.set(null);
    this.rfq.set(null);
    this.generatedEmails.set([]);
    this.generatedTitle.set(null);
    this.emailSubject.set('');
    this.emailBody.set('');
    this.clearCategorySelection();
    this.clearSelectedProducts();
    this.requestNotes.set('');
    this.catId.set(null);
    this.q.set('');
    void this.router.navigateByUrl('/rfq/create');
    this.error.set(null);
    this.status.set(null);
  }

  supplierEmailCards(): Array<{
    supplierId: string;
    supplierName: string;
    supplierEmail: string | null;
    subject: string;
    body: string;
    source: 'generated' | 'draft';
  }> {
    const generated = this.generatedEmails();
    if (generated.length > 0) {
      return generated.map((email) => ({
        supplierId: email.supplierId,
        supplierName: email.supplierName,
        supplierEmail: email.supplierEmail ?? null,
        subject: email.subject,
        body: email.body,
        source: 'generated' as const,
      }));
    }

    return (this.rfq()?.supplierEmails ?? []).map((email) => ({
      supplierId: email.supplierId,
      supplierName: email.supplierName,
      supplierEmail: email.supplierEmail,
      subject: email.subject || '',
      body: email.body || '',
      source: 'draft' as const,
    }));
  }

  statusLabel(value: number | string | null | undefined): string {
    const map: Record<string, string> = {
      '1': 'Draft',
      '2': 'ReadyToSend',
      '3': 'Sent',
      '4': 'OffersReceived',
      '5': 'UnderAnalysis',
      '6': 'DecisionPending',
      '7': 'Closed',
      Draft: 'Draft',
      ReadyToSend: 'ReadyToSend',
      Sent: 'Sent',
      OffersReceived: 'OffersReceived',
      UnderAnalysis: 'UnderAnalysis',
      DecisionPending: 'DecisionPending',
      Closed: 'Closed',
    };

    if (value === null || value === undefined || value === '') {
      return '—';
    }

    return map[String(value)] ?? String(value);
  }

  private patchSelected(productId: string, patch: Partial<SelectedRfqProduct>): void {
    const current = this.selectedProducts()[productId];
    if (!current) {
      return;
    }

    this.selectedProducts.set({
      ...this.selectedProducts(),
      [productId]: { ...current, ...patch },
    });
  }

  private readError(err: HttpErrorResponse, fallback: string): string {
    const payload = err.error as { messages?: string[]; title?: string; detail?: string } | string | null;
    if (typeof payload === 'string' && payload.trim()) {
      return payload;
    }

    if (payload && typeof payload === 'object') {
      if (payload.messages?.length) {
        return payload.messages.join(' ');
      }
      if (payload.detail) {
        return payload.detail;
      }
      if (payload.title) {
        return payload.title;
      }
    }

    return fallback;
  }
}
