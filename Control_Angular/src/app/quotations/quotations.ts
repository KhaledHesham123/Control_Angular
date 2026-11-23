import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { QuotationListItem } from './quotation.model';
import { QuotationService } from './quotation.service';

@Component({
  selector: 'app-quotations',
  standalone: false,
  templateUrl: './quotations.html',
  styleUrl: './quotations.css',
})
export class Quotations implements OnInit {
  private readonly quotationService = inject(QuotationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);
  private requestId = 0;

  readonly pageSizes = [5, 10, 20, 50];
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly status = signal<string | null>(null);
  readonly quotations = signal<QuotationListItem[]>([]);
  readonly count = signal(0);
  readonly pageNumber = signal(1);
  readonly expandedId = signal<string | null>(null);

  searchTerm = '';
  pageSize = 10;

  ngOnInit(): void {
    this.title.setTitle('عروض الأسعار | Falcon Shipping');
    this.load();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.count() / this.pageSize));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  load(): void {
    const requestId = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);

    this.quotationService
      .getAll({
        searchTerm: this.searchTerm,
        pageNumber: this.pageNumber(),
        pageSize: this.pageSize,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.loading.set(false);
          const message = result.messages?.filter(Boolean).join(' ') || null;
          this.status.set(message);

          if (!result.succeeded || !result.data) {
            this.quotations.set([]);
            this.count.set(0);
            this.error.set(message ?? 'تعذر تحميل عروض الأسعار.');
            return;
          }

          this.quotations.set(
            (result.data.data ?? []).map((quotation) => ({
              ...quotation,
              items: [...(quotation.items ?? [])].sort((left, right) =>
                left.itemNo.localeCompare(right.itemNo, undefined, {
                  numeric: true,
                  sensitivity: 'base',
                }),
              ),
            })),
          );
          this.count.set(result.data.count ?? this.quotations().length);

          if (result.data.pageNumber > 0) {
            this.pageNumber.set(result.data.pageNumber);
          }

          if (result.data.pageSize > 0) {
            this.pageSize = result.data.pageSize;
          }
        },
        error: () => {
          if (requestId !== this.requestId) {
            return;
          }

          this.loading.set(false);
          this.quotations.set([]);
          this.count.set(0);
          this.status.set(null);
          this.error.set('تعذر الاتصال بالخادم. حاول مرة أخرى.');
        },
      });
  }

  search(): void {
    this.pageNumber.set(1);
    this.expandedId.set(null);
    this.load();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.search();
  }

  changePageSize(size: number): void {
    const nextSize = Number(size);
    if (!nextSize || nextSize === this.pageSize) {
      return;
    }

    this.pageSize = nextSize;
    this.pageNumber.set(1);
    this.expandedId.set(null);
    this.load();
  }

  goTo(page: number): void {
    const nextPage = Math.min(Math.max(1, page), this.totalPages);
    if (nextPage === this.pageNumber() || this.loading()) {
      return;
    }

    this.pageNumber.set(nextPage);
    this.expandedId.set(null);
    this.load();
  }

  toggle(id: string): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }

  rangeLabel(): string {
    const total = this.count();
    if (total === 0) {
      return 'لا توجد عروض';
    }

    const start = (this.pageNumber() - 1) * this.pageSize + 1;
    const end = Math.min(this.pageNumber() * this.pageSize, total);
    return `${start}–${end} / ${total}`;
  }

  pageItemsCount(): number {
    return this.quotations().reduce((sum, quotation) => sum + quotation.itemsCount, 0);
  }

  pageTotalLabel(): string {
    const rows = this.quotations();
    if (rows.length === 0) {
      return this.money(0, 'USD');
    }

    const currency = rows[0].currency;
    if (rows.some((row) => row.currency !== currency)) {
      return 'عملات متعددة';
    }

    const sum = rows.reduce((total, row) => total + row.total, 0);
    return this.money(sum, currency);
  }

  money(value: number, currency: string): string {
    const amount = value ?? 0;
    const code = /^[A-Z]{3}$/.test(currency) ? currency : 'USD';

    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  }

  dateLabel(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }
}
