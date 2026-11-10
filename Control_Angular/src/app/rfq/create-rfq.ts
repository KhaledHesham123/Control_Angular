import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ProductDto } from '../products/product.model';
import { ProductService } from '../products/product.service';
import { RfqRequestService } from './rfq-request.service';
import {
  GeneratedSupplierRfqEmail,
  RfqRequest,
  SelectedRfqProduct,
} from './rfq.model';

type WizardStep = 1 | 2;

@Component({
  selector: 'app-create-rfq',
  standalone: false,
  templateUrl: './create-rfq.html',
  styleUrl: './create-rfq.css',
})
export class CreateRfq implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly rfqRequestService = inject(RfqRequestService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);

  readonly loadingProducts = signal(false);
  readonly creating = signal(false);
  readonly loadingRfq = signal(false);
  readonly generating = signal(false);

  readonly error = signal<string | null>(null);
  readonly status = signal<string | null>(null);

  readonly products = signal<ProductDto[]>([]);
  readonly categoryOptions = signal<Array<{ id: string; name: string }>>([]);
  readonly selectedCategoryId = signal<string>('');
  readonly selectedCategoryName = signal<string>('');
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

  ngOnInit(): void {
    this.title.setTitle('إنشاء RFQ | Ships Control');
  }

  onCategoryChange(categoryId: string): void {
    this.selectedCategoryId.set(categoryId || '');
    this.selectedProducts.set({});
    this.products.set([]);
    this.error.set(null);

    const selected = this.categoryOptions().find((item) => item.id === categoryId);
    this.selectedCategoryName.set(selected?.name ?? '');

    if (!categoryId) {
      return;
    }

    this.loadProducts();
  }

  onCategoryLoaded(categories: Array<{ id: string; name: string }>): void {
    this.categoryOptions.set(categories);
    const selected = categories.find((item) => item.id === this.selectedCategoryId());
    if (selected) {
      this.selectedCategoryName.set(selected.name);
    }
  }

  onCategoryFailed(message: string): void {
    this.error.set(message);
  }

  loadProducts(): void {
    const categoryId = this.selectedCategoryId();
    if (!categoryId) {
      return;
    }

    this.loadingProducts.set(true);
    this.error.set(null);

    this.productService
      .getByCategory(categoryId, false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loadingProducts.set(false);
          this.status.set(result.messages?.filter(Boolean).join(' ') || null);

          if (!result.succeeded || !result.data) {
            this.products.set([]);
            this.error.set(result.messages?.join(' ') || 'تعذر تحميل المنتجات.');
            return;
          }

          const items = result.data.filter((product) => product.isActive);
          this.products.set(items);
          if (items[0]?.categoryName) {
            this.selectedCategoryName.set(items[0].categoryName);
          }
        },
        error: (err: HttpErrorResponse) => {
          this.loadingProducts.set(false);
          this.products.set([]);
          this.error.set(this.readError(err, 'تعذر تحميل المنتجات.'));
        },
      });
  }

  isProductSelected(productId: string): boolean {
    return !!this.selectedProducts()[productId];
  }

  selectedProduct(productId: string): SelectedRfqProduct | null {
    return this.selectedProducts()[productId] ?? null;
  }

  toggleProduct(product: ProductDto): void {
    if (this.creating() || this.step() !== 1 || !this.selectedCategoryId()) {
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
    this.selectedCategoryId.set('');
    this.selectedCategoryName.set('');
    this.selectedProducts.set({});
    this.products.set([]);
  }

  createRfq(): void {
    const categoryId = this.selectedCategoryId();
    const items = Object.values(this.selectedProducts());

    if (!categoryId) {
      this.error.set('اختر فئة واحدةً وحدد منتجاتها.');
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
        categoryId,
        notes: this.requestNotes().trim() || null,
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

          if (!result.succeeded || !result.data) {
            this.error.set(result.messages?.join(' ') || 'تعذر إنشاء طلب RFQ.');
            return;
          }

          this.rfqId.set(result.data);
          this.step.set(2);
          this.loadRfq(result.data);
        },
        error: (err: HttpErrorResponse) => {
          this.creating.set(false);
          this.error.set(this.readError(err, 'تعذر إنشاء طلب RFQ.'));
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

    this.generating.set(true);
    this.error.set(null);

    this.rfqRequestService
      .generateContent({ id })
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
    this.requestNotes.set('');
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
