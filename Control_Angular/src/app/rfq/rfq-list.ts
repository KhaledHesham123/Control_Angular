import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { VesselDto } from '../products/product.model';
import { VesselService } from '../products/vessel.service';
import {
  RFQ_STATUS_LABELS,
  formatCategoryLabel,
  RfqRequestCategoryDto,
  RfqRequestListItemDto,
  RfqRequestStatus,
} from './rfq.model';
import { RfqRequestService } from './rfq-request.service';

@Component({
  selector: 'app-rfq-list',
  standalone: false,
  templateUrl: './rfq-list.html',
  styleUrl: './rfq-list.css',
})
export class RfqList implements OnInit {
  private readonly rfqRequestService = inject(RfqRequestService);
  private readonly vesselService = inject(VesselService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);
  private readonly router = inject(Router);

  private timerId: ReturnType<typeof setInterval> | null = null;

  readonly RfqRequestStatus = RfqRequestStatus;
  readonly statusLabels = RFQ_STATUS_LABELS;
  readonly statusOptions = Object.values(RfqRequestStatus).filter(
    (value): value is RfqRequestStatus => typeof value === 'number',
  );

  readonly loading = signal(false);
  readonly loadingVessels = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<RfqRequestListItemDto[]>([]);
  readonly vessels = signal<VesselDto[]>([]);
  /** Tick every second so Draft timers refresh against Date.UTC now. */
  readonly nowUtcMs = signal(Date.now());

  statusFilter: RfqRequestStatus | '' = '';
  categoryId = '';
  vesselId = '';

  ngOnInit(): void {
    this.title.setTitle('RFQ Requests | Ships Control');
    this.startUtcTimer();
    this.loadVessels();
    this.loadRequests();
  }

  loadVessels(): void {
    this.loadingVessels.set(true);

    this.vesselService
      .getAll(false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loadingVessels.set(false);
          this.vessels.set(result.succeeded && result.data ? result.data : []);
        },
        error: () => {
          this.loadingVessels.set(false);
          this.vessels.set([]);
        },
      });
  }

  loadRequests(): void {
    this.loading.set(true);
    this.error.set(null);

    this.rfqRequestService
      .getAll({
        status: this.statusFilter === '' ? null : this.statusFilter,
        categoryId: this.categoryId || null,
        vesselId: this.vesselId || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loading.set(false);
          if (!result.succeeded || !result.data) {
            this.items.set([]);
            this.error.set(result.messages?.join(' ') || 'Failed to load RFQ requests.');
            return;
          }
          this.items.set(result.data);
          this.nowUtcMs.set(Date.now());
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.items.set([]);
          this.error.set(this.readError(err, 'Failed to load RFQ requests.'));
        },
      });
  }

  onCategoryChange(categoryId: string): void {
    this.categoryId = categoryId || '';
    this.loadRequests();
  }

  onCategoryFailed(message: string): void {
    this.error.set(message);
  }

  onStatusChange(value: RfqRequestStatus | '' | null): void {
    this.statusFilter = value === null || value === undefined ? '' : value;
    this.loadRequests();
  }

  onVesselChange(value: string): void {
    this.vesselId = value || '';
    this.loadRequests();
  }

  isDraft(status: RfqRequestStatus | number): boolean {
    return Number(status) === RfqRequestStatus.Draft;
  }

  isReadyToSend(status: RfqRequestStatus | number): boolean {
    return Number(status) === RfqRequestStatus.ReadyToSend;
  }

  categoryNames(categories: RfqRequestCategoryDto[] | null | undefined): string {
    return (categories ?? []).map((c) => formatCategoryLabel(c)).filter(Boolean).join(' · ') || '—';
  }

  statusLabel(status: RfqRequestStatus | number): string {
    return this.statusLabels[status as RfqRequestStatus] ?? String(status);
  }

  /**
   * Elapsed time from CreatedAt (UTC) to Date.now() (UTC) for Draft RFQs.
   */
  draftAgeParts(createdAt: string): Array<{ value: string; unit: string }> {
    const created = this.parseUtc(createdAt);
    // Touch nowUtcMs so the template refreshes every second.
    let totalSeconds = created
      ? Math.floor((this.nowUtcMs() - created.getTime()) / 1000)
      : 0;
    if (totalSeconds < 0) {
      totalSeconds = 0;
    }

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [
      { value: String(days), unit: 'd' },
      { value: String(hours).padStart(2, '0'), unit: 'h' },
      { value: String(minutes).padStart(2, '0'), unit: 'm' },
      { value: String(seconds).padStart(2, '0'), unit: 's' },
    ];
  }

  create(): void {
    void this.router.navigateByUrl('/rfq/create');
  }

  confirm(id: string): void {
    void this.router.navigate(['/rfq', id, 'confirm']);
  }

  openEmail(id: string): void {
    void this.router.navigate(['/rfq', id, 'email']);
  }

  private startUtcTimer(): void {
    this.nowUtcMs.set(Date.now());
    this.timerId = setInterval(() => {
      this.nowUtcMs.set(Date.now());
    }, 1000);

    this.destroyRef.onDestroy(() => {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    });
  }

  private parseUtc(value: string): Date | null {
    if (!value) {
      return null;
    }

    const normalized =
      /Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value.replace(/ ?UTC$/i, '')}Z`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date;
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
