import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { resolveFileUrl } from '../core/api.config';
import {
  RfqRequestEmailSupplierDto,
  RfqRequestForEmailDto,
  SUPPLIER_RFQ_EMAIL_STATUS_LABELS,
  SendSupplierRfqEmailItemResultDto,
  SendSupplierRfqEmailsResultDto,
  SupplierRfqEmailStatus,
  formatCategoryLabel,
} from './rfq.model';
import { RfqRequestService } from './rfq-request.service';

interface SupplierEmailDraft extends RfqRequestEmailSupplierDto {
  supplierName: string;
  subject: string;
  body: string;
}

@Component({
  selector: 'app-rfq-email',
  standalone: false,
  templateUrl: './rfq-email.html',
  styleUrl: './rfq-email.css',
})
export class RfqEmail implements OnInit {
  private readonly rfqRequestService = inject(RfqRequestService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly generating = signal(false);
  readonly generatingPdf = signal(false);
  readonly sending = signal(false);
  readonly pdfUrl = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly sendResult = signal<SendSupplierRfqEmailsResultDto | null>(null);
  readonly detail = signal<RfqRequestForEmailDto | null>(null);
  readonly suppliers = signal<SupplierEmailDraft[]>([]);

  rfqId = '';

  ngOnInit(): void {
    this.title.setTitle('RFQ Email | Ships Control');

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id')?.trim() ?? '';
      if (!id) {
        this.error.set('RFQ id is missing.');
        return;
      }
      this.rfqId = id;
      this.loadEmail();
    });
  }

  back(): void {
    void this.router.navigateByUrl('/rfq');
  }

  categoryNames(categories: { id: string; name: string }[] | null | undefined): string {
    return (categories ?? []).map((c) => formatCategoryLabel(c)).filter(Boolean).join(' · ') || '—';
  }

  hideSupplier(id: string): void {
    this.suppliers.update((items) => items.filter((item) => item.id !== id));
  }

  generateEmail(): void {
    const supplierIds = this.suppliers().map((supplier) => supplier.id);
    if (!this.rfqId || supplierIds.length === 0 || this.generating()) {
      if (supplierIds.length === 0) {
        this.error.set('Keep at least one supplier to generate the email.');
      }
      return;
    }

    this.generating.set(true);
    this.error.set(null);
    this.notice.set(null);

    this.rfqRequestService
      .generateEmailContentForSuppliers({
        id: this.rfqId,
        supplierIds,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.generating.set(false);
          if (!result.succeeded || !result.data) {
            this.error.set(result.messages?.join(' ') || 'Failed to generate email.');
            return;
          }

          const emails = result.data.emails ?? [];
          this.suppliers.update((items) =>
            items.map((supplier) => {
              const email = emails.find((item) => item.supplierId === supplier.id);
              if (!email) {
                return supplier;
              }
              return {
                ...supplier,
                supplierName: email.supplierName || supplier.supplierName,
                subject: email.subject ?? '',
                body: email.body ?? '',
              };
            }),
          );
        },
        error: (err: HttpErrorResponse) => {
          this.generating.set(false);
          this.error.set(this.readError(err, 'Failed to generate email.'));
        },
      });
  }

  sendEmails(): void {
    const items = this.suppliers().map((supplier) => ({
      supplierId: supplier.id,
      subject: supplier.subject.trim(),
      body: supplier.body.trim(),
    }));

    if (!this.rfqId || this.sending()) {
      return;
    }

    if (items.length === 0) {
      this.error.set('Keep at least one supplier to send.');
      this.notice.set(null);
      return;
    }

    if (items.some((item) => !item.subject || !item.body)) {
      this.error.set('Each supplier needs a subject and body before sending.');
      this.notice.set(null);
      return;
    }

    this.sending.set(true);
    this.error.set(null);
    this.notice.set(null);

    this.rfqRequestService
      .sendSupplierEmails({
        rfqRequestId: this.rfqId,
        items,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.sending.set(false);
          this.sendResult.set(result.data);
          const summary = result.data
            ? `Sent ${result.data.sentCount}, failed ${result.data.failedCount}.`
            : null;

          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || summary || 'Failed to send emails.');
            return;
          }

          this.notice.set(result.messages?.join(' ') || summary || 'Emails sent.');
        },
        error: (err: HttpErrorResponse) => {
          this.sending.set(false);
          const payload = err.error as { data?: SendSupplierRfqEmailsResultDto } | null;
          if (payload && typeof payload === 'object' && payload.data) {
            this.sendResult.set(payload.data);
          }
          this.error.set(this.readError(err, 'Failed to send emails.'));
        },
      });
  }

  sendResultFor(supplierId: string): SendSupplierRfqEmailItemResultDto | null {
    return this.sendResult()?.items.find((item) => item.supplierId === supplierId) ?? null;
  }

  statusLabel(status: SupplierRfqEmailStatus | null | undefined): string {
    if (status == null) {
      return 'Unknown';
    }
    return SUPPLIER_RFQ_EMAIL_STATUS_LABELS[status] ?? 'Unknown';
  }

  generatePdf(): void {
    if (!this.rfqId || this.generatingPdf()) {
      return;
    }

    this.generatingPdf.set(true);
    this.error.set(null);

    this.rfqRequestService
      .generateProvisionPdf(this.rfqId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (!result.succeeded || result.data !== true) {
            this.generatingPdf.set(false);
            this.error.set(result.messages?.join(' ') || 'Failed to generate PDF.');
            return;
          }

          this.loadProvisionPdf();
        },
        error: (err: HttpErrorResponse) => {
          this.generatingPdf.set(false);
          this.error.set(this.readError(err, 'Failed to generate PDF.'));
        },
      });
  }

  private loadProvisionPdf(): void {
    this.rfqRequestService
      .getProvisionPdf(this.rfqId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.generatingPdf.set(false);
          if (!result.succeeded || !result.data) {
            this.error.set(result.messages?.join(' ') || 'Failed to load PDF.');
            return;
          }

          const url = resolveFileUrl(result.data);
          if (!url) {
            this.error.set('PDF path is missing.');
            return;
          }

          this.pdfUrl.set(url);
          window.open(url, '_blank', 'noopener');
        },
        error: (err: HttpErrorResponse) => {
          this.generatingPdf.set(false);
          this.error.set(this.readError(err, 'Failed to load PDF.'));
        },
      });
  }

  loadEmail(): void {
    if (!this.rfqId) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.rfqRequestService
      .getForEmail(this.rfqId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loading.set(false);
          if (!result.succeeded || !result.data) {
            this.detail.set(null);
            this.suppliers.set([]);
            this.error.set(result.messages?.join(' ') || 'Failed to load RFQ email.');
            return;
          }

          this.detail.set(result.data);
          this.suppliers.set(
            (result.data.suppliers ?? []).map((supplier) => ({
              ...supplier,
              supplierName: '',
              subject: '',
              body: '',
            })),
          );
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.detail.set(null);
          this.suppliers.set([]);
          this.error.set(this.readError(err, 'Failed to load RFQ email.'));
        },
      });
  }

  private readError(err: HttpErrorResponse, fallback: string): string {
    const payload = err.error as
      | { messages?: string[]; title?: string; detail?: string }
      | string
      | null;

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
