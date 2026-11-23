import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import {
  QUOTATION_STATUS_LABELS,
  QuotationStatus,
  OfferComparison,
  OfferSummary,
} from '../quotations/quotation.model';
import { QuotationService } from '../quotations/quotation.service';
import { RFQ_STATUS_LABELS, RfqRequestStatus } from './rfq.model';

interface DraftLine {
  id?: string | null;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

@Component({
  selector: 'app-rfq-offers',
  standalone: false,
  templateUrl: './rfq-offers.html',
  styleUrl: './rfq-offers.css',
})
export class RfqOffers implements OnInit {
  private readonly quotations = inject(QuotationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly board = signal<OfferComparison | null>(null);
  readonly statusLabels = RFQ_STATUS_LABELS;
  readonly offerLabels = QUOTATION_STATUS_LABELS;
  readonly RfqRequestStatus = RfqRequestStatus;

  rfqId = '';
  supplierId = '';
  notes = '';
  pdfPath = '';
  asDraft = false;
  editingId: string | null = null;
  deliveryDate = '';
  lines: DraftLine[] = [];
  receiveQty: Record<string, number> = {};

  ngOnInit(): void {
    this.title.setTitle('عروض طلب الشراء | Falcon Shipping');
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.rfqId = params.get('id')?.trim() ?? '';
      this.load();
    });
  }

  load(): void {
    if (!this.rfqId) {
      this.error.set('رقم الطلب غير موجود.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.quotations
      .comparison(this.rfqId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loading.set(false);
          if (!result.succeeded || !result.data) {
            this.board.set(null);
            this.error.set(result.messages?.join(' ') || 'تعذر جلب العروض.');
            return;
          }
          this.board.set(result.data);
          this.deliveryDate = this.toDateInput(result.data.deliveryDate);
          const qty: Record<string, number> = {};
          const approved = result.data.offers.find((offer) => offer.id === result.data?.approvedQuotationId);
          for (const line of result.data.lines) {
            const fromOffer = approved?.items.find((item) => item.productId === line.productId);
            qty[line.productId] = fromOffer?.quantity ?? line.requestedQuantity;
          }
          this.receiveQty = qty;
          if (!this.editingId) {
            this.resetDraft(result.data);
          }
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(this.readError(err, 'تعذر جلب العروض.'));
        },
      });
  }

  statusLabel(status: number): string {
    return this.statusLabels[status as RfqRequestStatus] ?? String(status);
  }

  offerLabel(status: number): string {
    return this.offerLabels[status as QuotationStatus] ?? String(status);
  }

  submittedAt(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    const date = new Date(/Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  priceFor(lineProductId: string, quotationId: string) {
    const line = this.board()?.lines.find((item) => item.productId === lineProductId);
    return line?.prices.find((price) => price.quotationId === quotationId) ?? null;
  }

  back(): void {
    void this.router.navigateByUrl('/rfq');
  }

  openEmail(): void {
    void this.router.navigate(['/rfq', this.rfqId, 'email']);
  }

  edit(offer: OfferSummary): void {
    this.editingId = offer.id;
    this.supplierId = offer.supplierId ?? '';
    this.notes = offer.notes ?? '';
    this.pdfPath = offer.pdfPath ?? '';
    this.asDraft = Number(offer.status) === QuotationStatus.Draft;
    const board = this.board();
    this.lines = (board?.lines ?? []).map((line) => {
      const item = offer.items.find((entry) => entry.productId === line.productId);
      return {
        id: item?.id ?? null,
        productId: line.productId,
        name: line.name,
        quantity: item?.quantity ?? line.requestedQuantity,
        unitPrice: item?.unitPriceUSD ?? 0,
      };
    });
  }

  cancelEdit(): void {
    this.editingId = null;
    const board = this.board();
    if (board) {
      this.resetDraft(board);
    }
  }

  saveOffer(): void {
    if (!this.supplierId) {
      this.error.set('اختار المورد.');
      return;
    }
    const items = this.lines.filter((line) => line.quantity > 0);
    if (items.length === 0) {
      this.error.set('العرض لازم يحتوي صنفاً بكمية.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.quotations
      .saveOffer({
        id: this.editingId,
        rfqRequestId: this.rfqId,
        supplierId: this.supplierId,
        notes: this.notes.trim() || null,
        pdfPath: this.pdfPath.trim() || null,
        asDraft: this.asDraft,
        items: items.map((line) => ({
          id: line.id ?? null,
          productId: line.productId,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
        })),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'تعذر حفظ العرض.');
            return;
          }
          this.success.set(result.messages?.join(' ') || 'تم حفظ العرض.');
          this.editingId = null;
          this.load();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.error.set(this.readError(err, 'تعذر حفظ العرض.'));
        },
      });
  }

  remove(offer: OfferSummary): void {
    this.saving.set(true);
    this.quotations
      .deleteOffer(offer.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'تعذر حذف العرض.');
            return;
          }
          this.success.set('تم حذف العرض.');
          this.load();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.error.set(this.readError(err, 'تعذر حذف العرض.'));
        },
      });
  }

  approve(offer: OfferSummary): void {
    if (!this.deliveryDate) {
      this.error.set('حدد تاريخ التسليم قبل اعتماد العرض.');
      return;
    }
    this.saving.set(true);
    this.quotations
      .approveOffer({
        rfqRequestId: this.rfqId,
        quotationId: offer.id,
        deliveryDate: `${this.deliveryDate}T00:00:00Z`,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'تعذر اعتماد العرض.');
            return;
          }
          this.success.set(result.messages?.join(' ') || 'تم اعتماد العرض.');
          this.load();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.error.set(this.readError(err, 'تعذر اعتماد العرض.'));
        },
      });
  }

  receive(): void {
    const items = Object.entries(this.receiveQty)
      .filter(([, quantity]) => Number(quantity) > 0)
      .map(([productId, quantity]) => ({ productId, quantity: Number(quantity) }));
    if (items.length === 0) {
      this.error.set('حدد كمية استلام أكبر من صفر.');
      return;
    }
    this.saving.set(true);
    this.quotations
      .receive({ id: this.rfqId, items })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'تعذر تأكيد الاستلام.');
            return;
          }
          this.success.set(result.messages?.join(' ') || 'تم الاستلام.');
          this.load();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.error.set(this.readError(err, 'تعذر تأكيد الاستلام.'));
        },
      });
  }

  awaitingReceipt(): boolean {
    return Number(this.board()?.status) === RfqRequestStatus.AwaitingReceipt;
  }

  private resetDraft(board: OfferComparison): void {
    this.supplierId = '';
    this.notes = '';
    this.pdfPath = '';
    this.asDraft = false;
    this.lines = board.lines.map((line) => ({
      productId: line.productId,
      name: line.name,
      quantity: line.requestedQuantity,
      unitPrice: 0,
    }));
  }

  private toDateInput(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    const date = new Date(/Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }

  private readError(err: HttpErrorResponse, fallback: string): string {
    const messages = err.error?.messages;
    if (Array.isArray(messages) && messages.length) {
      return messages.join(' ');
    }
    return fallback;
  }
}
