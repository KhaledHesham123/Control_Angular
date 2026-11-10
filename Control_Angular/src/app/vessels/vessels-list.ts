import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { VesselDetailsDto, VesselListDto } from './vessel.model';
import { VesselsService } from './vessels.service';

@Component({
  selector: 'app-vessels-list',
  standalone: false,
  templateUrl: './vessels-list.html',
  styleUrl: './vessels-list.css',
})
export class VesselsList implements OnInit {
  private readonly vesselsService = inject(VesselsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly detailsLoadingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly vessels = signal<VesselListDto[]>([]);
  readonly details = signal<Record<string, VesselDetailsDto>>({});
  readonly expandedId = signal<string | null>(null);
  readonly pendingDelete = signal<VesselListDto | null>(null);

  includeInactive = false;

  ngOnInit(): void {
    this.title.setTitle('Vessel Management | Ships Control');
    this.loadVessels();
  }

  loadVessels(): void {
    this.loading.set(true);
    this.error.set(null);

    this.vesselsService
      .getAll(this.includeInactive)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loading.set(false);
          if (!result.succeeded || !result.data) {
            this.vessels.set([]);
            this.error.set(result.messages?.join(' ') || 'Failed to load vessels.');
            return;
          }
          this.vessels.set(result.data);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.vessels.set([]);
          this.error.set(this.readError(err, 'Failed to load vessels.'));
        },
      });
  }

  onIncludeInactiveChange(checked: boolean): void {
    this.includeInactive = checked;
    this.expandedId.set(null);
    this.details.set({});
    this.loadVessels();
  }

  toggleDetails(vesselId: string): void {
    if (this.expandedId() === vesselId) {
      this.expandedId.set(null);
      return;
    }

    this.expandedId.set(vesselId);
    if (!this.details()[vesselId]) {
      this.loadDetails(vesselId);
    }
  }

  loadDetails(vesselId: string): void {
    this.detailsLoadingId.set(vesselId);
    this.error.set(null);

    this.vesselsService
      .getById(vesselId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.detailsLoadingId.set(null);
          if (!result.succeeded || !result.data) {
            this.error.set(result.messages?.join(' ') || 'Failed to load vessel details.');
            return;
          }
          this.details.set({
            ...this.details(),
            [vesselId]: {
              ...result.data,
              users: result.data.users ?? [],
            },
          });
        },
        error: (err: HttpErrorResponse) => {
          this.detailsLoadingId.set(null);
          this.error.set(this.readError(err, 'Failed to load vessel details.'));
        },
      });
  }

  create(): void {
    void this.router.navigateByUrl('/vessels/create');
  }

  edit(vesselId: string): void {
    void this.router.navigate(['/vessels/edit', vesselId]);
  }

  askDelete(vessel: VesselListDto): void {
    this.error.set(null);
    this.success.set(null);
    this.pendingDelete.set(vessel);
  }

  cancelDelete(): void {
    if (this.deletingId()) {
      return;
    }
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const vessel = this.pendingDelete();
    if (!vessel) {
      return;
    }

    this.deletingId.set(vessel.id);
    this.error.set(null);
    this.success.set(null);

    this.vesselsService
      .delete(vessel.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.deletingId.set(null);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'Could not delete this vessel.');
            return;
          }

          this.pendingDelete.set(null);
          this.success.set(`“${vessel.name}” was deleted.`);
          if (this.expandedId() === vessel.id) {
            this.expandedId.set(null);
          }
          const nextDetails = { ...this.details() };
          delete nextDetails[vessel.id];
          this.details.set(nextDetails);
          this.loadVessels();
        },
        error: (err: HttpErrorResponse) => {
          this.deletingId.set(null);
          this.error.set(this.readError(err, 'Could not delete this vessel.'));
        },
      });
  }

  back(): void {
    void this.router.navigateByUrl('/');
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
