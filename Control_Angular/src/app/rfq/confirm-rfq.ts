import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { formatShelfLife } from '../products/product.model';
import {
  RFQ_STATUS_LABELS,
  RfqRequestConfirmDto,
  RfqRequestConfirmItemDto,
  RfqRequestStatus,
  formatCategoryLabel,
} from './rfq.model';
import { RfqRequestService } from './rfq-request.service';

type FieldKey = 'title' | 'startDate' | 'deliveryDate' | 'latestDeliveryDate' | string;

@Component({
  selector: 'app-confirm-rfq',
  standalone: false,
  templateUrl: './confirm-rfq.html',
  styleUrl: './confirm-rfq.css',
})
export class ConfirmRfq implements OnInit {
  private readonly rfqRequestService = inject(RfqRequestService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly RfqRequestStatus = RfqRequestStatus;
  readonly statusLabels = RFQ_STATUS_LABELS;
  readonly statusOptions = Object.values(RfqRequestStatus).filter(
    (value): value is RfqRequestStatus => typeof value === 'number',
  );

  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly detail = signal<RfqRequestConfirmDto | null>(null);
  readonly invalidFields = signal<ReadonlySet<FieldKey>>(new Set());

  rfqId = '';
  titleValue = '';
  notes = '';
  startDate = '';
  deliveryDate = '';
  latestDeliveryDate = '';
  status: RfqRequestStatus = RfqRequestStatus.Draft;
  items: RfqRequestConfirmItemDto[] = [];

  ngOnInit(): void {
    this.title.setTitle('Confirm RFQ | Ships Control');

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id')?.trim() ?? '';
      if (!id) {
        this.error.set('RFQ id is missing.');
        return;
      }
      this.rfqId = id;
      this.loadConfirm();
    });
  }

  back(): void {
    void this.router.navigateByUrl('/rfq');
  }

  isInvalid(field: FieldKey): boolean {
    return this.invalidFields().has(field);
  }

  clearFieldError(field: FieldKey): void {
    if (!this.invalidFields().has(field)) {
      return;
    }
    const next = new Set(this.invalidFields());
    next.delete(field);
    this.invalidFields.set(next);
  }

  onDatesChanged(): void {
    const issues = this.collectDateIssues();
    const next = new Set(
      [...this.invalidFields()].filter(
        (key) =>
          key !== 'startDate' &&
          key !== 'deliveryDate' &&
          key !== 'latestDeliveryDate' &&
          !String(key).startsWith('item-'),
      ),
    );
    for (const key of issues.invalid) {
      next.add(key);
    }
    this.invalidFields.set(next);
    this.error.set(issues.messages.length ? issues.messages.join('\n\n') : null);
  }

  qtyField(itemId: string): string {
    return `qty-${itemId}`;
  }

  shelfLifeText(item: RfqRequestConfirmItemDto): string | null {
    return formatShelfLife(item.shelfLifeValue, item.shelfLifeUnit);
  }

  loadConfirm(): void {
    if (!this.rfqId) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.invalidFields.set(new Set());

    this.rfqRequestService
      .getForConfirm(this.rfqId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loading.set(false);
          if (!result.succeeded || !result.data) {
            this.detail.set(null);
            this.error.set(result.messages?.join(' ') || 'Failed to load RFQ for confirm.');
            return;
          }

          const data: RfqRequestConfirmDto = {
            ...result.data,
            items: (result.data.items ?? []).map((item) => ({ ...item })),
          };
          this.detail.set(data);
          this.patchForm(data);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.detail.set(null);
          this.error.set(this.readError(err, 'Failed to load RFQ for confirm.'));
        },
      });
  }

  categoryNames(categories: { id: string; name: string }[] | null | undefined): string {
    return (categories ?? []).map((c) => formatCategoryLabel(c)).filter(Boolean).join(' · ') || '—';
  }

  statusLabel(status: RfqRequestStatus | number): string {
    return this.statusLabels[status as RfqRequestStatus] ?? String(status);
  }

  trackItem(_index: number, item: RfqRequestConfirmItemDto): string {
    return item.id;
  }

  submit(): void {
    this.success.set(null);
    this.error.set(null);

    if (!this.rfqId) {
      this.error.set('RFQ id is missing.');
      return;
    }

    const startDateIso = this.resolveStartDateIso();
    const deliveryDateIso = this.toUtcIso(this.deliveryDate);
    const latestDeliveryDateIso = this.toUtcIso(this.latestDeliveryDate);
    const { invalid, message } = this.validate(startDateIso, deliveryDateIso, latestDeliveryDateIso);

    this.invalidFields.set(invalid);
    if (invalid.size > 0) {
      this.error.set(message);
      this.scrollToFirstInvalid(invalid);
      return;
    }

    this.submitting.set(true);

    this.rfqRequestService
      .confirm({
        id: this.rfqId,
        title: this.titleValue.trim(),
        notes: this.notes.trim() || null,
        startDate: startDateIso!,
        deliveryDate: deliveryDateIso!,
        latestDeliveryDate: latestDeliveryDateIso!,
        status: this.status,
        items: this.items.map((item) => this.normalizeItem(item)),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'Failed to confirm RFQ.');
            return;
          }

          this.success.set(result.messages?.join(' ') || 'RFQ confirmed successfully.');
          void this.router.navigateByUrl('/rfq');
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.error.set(this.readError(err, 'Failed to confirm RFQ.'));
        },
      });
  }

  private validate(
    startDateIso: string | null,
    deliveryDateIso: string | null,
    latestDeliveryDateIso: string | null,
  ): { invalid: Set<FieldKey>; message: string } {
    const invalid = new Set<FieldKey>();
    const messages: string[] = [];

    if (!this.titleValue.trim()) {
      invalid.add('title');
      messages.push('Title is required.');
    }

    if (this.startDate.trim() && !startDateIso) {
      invalid.add('startDate');
      messages.push('Invalid start date format.');
    }

    if (!this.deliveryDate.trim()) {
      invalid.add('deliveryDate');
      messages.push('Delivery date is required.');
    } else if (!deliveryDateIso) {
      invalid.add('deliveryDate');
      messages.push('Invalid delivery date format.');
    }

    if (!this.latestDeliveryDate.trim()) {
      invalid.add('latestDeliveryDate');
      messages.push('Latest delivery date is required.');
    } else if (!latestDeliveryDateIso) {
      invalid.add('latestDeliveryDate');
      messages.push('Invalid latest delivery date format.');
    }

    const dateIssues = this.collectDateIssues();
    for (const key of dateIssues.invalid) {
      invalid.add(key);
    }
    messages.push(...dateIssues.messages);

    for (const item of this.items) {
      if (!item.quantity || item.quantity < 1) {
        invalid.add(this.qtyField(item.id));
      }
    }
    if ([...invalid].some((key) => String(key).startsWith('qty-'))) {
      messages.push('Each item quantity must be at least 1.');
    }

    return {
      invalid,
      message: messages.join('\n\n') || 'Please fix the highlighted fields.',
    };
  }

  private collectDateIssues(): { invalid: Set<FieldKey>; messages: string[] } {
    const invalid = new Set<FieldKey>();
    const messages: string[] = [];
    const startDateIso = this.resolveStartDateIso();
    const deliveryDateIso = this.deliveryDate.trim() ? this.toUtcIso(this.deliveryDate) : null;
    const latestDeliveryDateIso = this.latestDeliveryDate.trim()
      ? this.toUtcIso(this.latestDeliveryDate)
      : null;

    if (
      startDateIso &&
      deliveryDateIso &&
      new Date(deliveryDateIso).getTime() < new Date(startDateIso).getTime()
    ) {
      invalid.add('startDate');
      invalid.add('deliveryDate');
      messages.push('Delivery must be on or after the start date.');
    }

    if (
      deliveryDateIso &&
      latestDeliveryDateIso &&
      new Date(latestDeliveryDateIso).getTime() < new Date(deliveryDateIso).getTime()
    ) {
      invalid.add('deliveryDate');
      invalid.add('latestDeliveryDate');
      messages.push('Latest delivery must be on or after delivery.');
    }

    return { invalid, messages };
  }

  private resolveStartDateIso(): string | null {
    if (!this.startDate.trim()) {
      return this.toUtcIso(this.todayUtcDate());
    }
    return this.toUtcIso(this.startDate);
  }

  private todayUtcDate(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
  }

  private scrollToFirstInvalid(invalid: Set<FieldKey>): void {
    const order: FieldKey[] = [
      'title',
      'startDate',
      'deliveryDate',
      'latestDeliveryDate',
      ...this.items.map((item) => this.qtyField(item.id)),
    ];
    const first = order.find((key) => invalid.has(key));
    if (!first) {
      return;
    }

    queueMicrotask(() => {
      const el = document.getElementById(`field-${first}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
        el.focus({ preventScroll: true });
      }
    });
  }

  private patchForm(data: RfqRequestConfirmDto): void {
    this.titleValue = data.title ?? '';
    this.notes = data.notes ?? '';
    this.status = Number(data.status) as RfqRequestStatus;
    this.startDate = this.toDateTimeLocal(data.startDate);
    this.deliveryDate = this.toDateTimeLocal(data.deliveryDate);
    this.latestDeliveryDate = this.toDateTimeLocal(data.latestDeliveryDate);
    this.items = data.items.map((item) => ({
      ...item,
      shelfLifeValue: item.shelfLifeValue ?? null,
      shelfLifeUnit: item.shelfLifeUnit == null ? null : Number(item.shelfLifeUnit),
    }));
    this.onDatesChanged();
  }

  private normalizeItem(item: RfqRequestConfirmItemDto): RfqRequestConfirmItemDto {
    return {
      ...item,
      notes: item.notes?.trim() || null,
      productDescription: item.productDescription?.trim() || null,
      code: item.code?.trim() || null,
      shelfLifeValue: item.shelfLifeValue ?? null,
      shelfLifeUnit: item.shelfLifeUnit ?? null,
    };
  }

  private toDateTimeLocal(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const raw = String(value).trim();
    if (!raw || raw.startsWith('0001-01-01')) {
      return '';
    }

    const date = new Date(/Z$|[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}Z`);
    if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 2000) {
      return '';
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }

  private toUtcIso(localValue: string): string | null {
    const trimmed = localValue?.trim() ?? '';
    if (!trimmed) {
      return null;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      Number.isNaN(date.getTime()) ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return date.toISOString();
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
