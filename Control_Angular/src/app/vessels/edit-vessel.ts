import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { resolveFileUrl } from '../core/api.config';
import { UserLookupDto, VesselDetailsDto } from './vessel.model';
import { UserLookupService } from './user-lookup.service';
import { VesselsService } from './vessels.service';

@Component({
  selector: 'app-edit-vessel',
  standalone: false,
  templateUrl: './edit-vessel.html',
  styleUrl: './edit-vessel.css',
})
export class EditVessel implements OnInit {
  private readonly vesselsService = inject(VesselsService);
  private readonly userLookup = inject(UserLookupService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly loadingUsers = signal(false);
  readonly submitting = signal(false);
  readonly linking = signal(false);
  readonly unlinking = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly vessel = signal<VesselDetailsDto | null>(null);
  readonly linkedUsers = signal<UserLookupDto[]>([]);
  readonly availableUsers = signal<UserLookupDto[]>([]);

  vesselId = '';
  name = '';
  imoNumber = '';
  flag = '';
  notes = '';
  isActive = true;

  selectedLinkUserIds: string[] = [];
  selectedUnlinkUserIds: string[] = [];

  ngOnInit(): void {
    this.title.setTitle('Edit Vessel | Ships Control');

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id')?.trim() ?? '';
      if (!id) {
        this.error.set('Vessel id is missing.');
        return;
      }
      this.vesselId = id;
      this.loadVessel();
    });
  }

  back(): void {
    void this.router.navigateByUrl('/vessels');
  }

  loadVessel(): void {
    if (!this.vesselId) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.vesselsService
      .getById(this.vesselId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loading.set(false);
          if (!result.succeeded || !result.data) {
            this.vessel.set(null);
            this.error.set(result.messages?.join(' ') || 'Failed to load vessel.');
            return;
          }

          const data: VesselDetailsDto = {
            ...result.data,
            users: result.data.users ?? [],
          };
          this.vessel.set(data);
          this.patchForm(data);
          this.loadUserLookups();
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.vessel.set(null);
          this.error.set(this.readError(err, 'Failed to load vessel.'));
        },
      });
  }

  loadUserLookups(): void {
    if (!this.vesselId) {
      return;
    }

    this.loadingUsers.set(true);

    forkJoin({
      linked: this.userLookup.lookup(this.vesselId, true),
      available: this.userLookup.lookup(this.vesselId, false),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ linked, available }) => {
          this.loadingUsers.set(false);

          if (!linked.succeeded || !linked.data) {
            this.linkedUsers.set([]);
            this.error.set(linked.messages?.join(' ') || 'Failed to load linked users.');
          } else {
            this.linkedUsers.set(linked.data);
          }

          if (!available.succeeded || !available.data) {
            this.availableUsers.set([]);
            this.error.set(available.messages?.join(' ') || 'Failed to load available users.');
          } else {
            this.availableUsers.set(available.data);
          }

          this.selectedLinkUserIds = this.selectedLinkUserIds.filter((id) =>
            this.availableUsers().some((user) => user.id === id),
          );
          this.selectedUnlinkUserIds = this.selectedUnlinkUserIds.filter((id) =>
            this.linkedUsers().some((user) => user.id === id),
          );
        },
        error: (err: HttpErrorResponse) => {
          this.loadingUsers.set(false);
          this.linkedUsers.set([]);
          this.availableUsers.set([]);
          this.error.set(this.readError(err, 'Failed to load user lists.'));
        },
      });
  }

  imageUrl(path: string | null | undefined): string | null {
    return resolveFileUrl(path);
  }

  isLinkSelected(id: string): boolean {
    return this.selectedLinkUserIds.includes(id);
  }

  toggleLinkUser(id: string): void {
    if (this.selectedLinkUserIds.includes(id)) {
      this.selectedLinkUserIds = this.selectedLinkUserIds.filter((item) => item !== id);
      return;
    }
    this.selectedLinkUserIds = [...this.selectedLinkUserIds, id];
  }

  isUnlinkSelected(id: string): boolean {
    return this.selectedUnlinkUserIds.includes(id);
  }

  toggleUnlinkUser(id: string): void {
    if (this.selectedUnlinkUserIds.includes(id)) {
      this.selectedUnlinkUserIds = this.selectedUnlinkUserIds.filter((item) => item !== id);
      return;
    }
    this.selectedUnlinkUserIds = [...this.selectedUnlinkUserIds, id];
  }

  submit(): void {
    this.success.set(null);
    this.error.set(null);

    if (!this.vesselId) {
      this.error.set('Vessel id is missing.');
      return;
    }

    if (!this.name.trim()) {
      this.error.set('Vessel name is required.');
      return;
    }

    this.submitting.set(true);

    this.vesselsService
      .update({
        id: this.vesselId,
        name: this.name,
        imoNumber: this.imoNumber,
        flag: this.flag,
        notes: this.notes,
        isActive: this.isActive,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'Failed to update vessel.');
            return;
          }

          this.success.set(result.messages?.join(' ') || 'Vessel updated successfully.');
          this.loadVessel();
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.error.set(this.readError(err, 'Failed to update vessel.'));
        },
      });
  }

  linkUsers(): void {
    this.success.set(null);
    this.error.set(null);

    if (this.selectedLinkUserIds.length === 0) {
      this.error.set('Select at least one user to link.');
      return;
    }

    this.linking.set(true);

    this.vesselsService
      .linkUsers(this.vesselId, this.selectedLinkUserIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.linking.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'Failed to link users.');
            return;
          }

          this.success.set(result.messages?.join(' ') || 'Users linked successfully.');
          this.selectedLinkUserIds = [];
          this.loadVessel();
        },
        error: (err: HttpErrorResponse) => {
          this.linking.set(false);
          this.error.set(this.readError(err, 'Failed to link users.'));
        },
      });
  }

  unlinkUsers(): void {
    this.success.set(null);
    this.error.set(null);

    if (this.selectedUnlinkUserIds.length === 0) {
      this.error.set('Select at least one user to unlink.');
      return;
    }

    this.unlinking.set(true);

    this.vesselsService
      .unlinkUsers(this.vesselId, this.selectedUnlinkUserIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.unlinking.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'Failed to unlink users.');
            return;
          }

          this.success.set(result.messages?.join(' ') || 'Users unlinked successfully.');
          this.selectedUnlinkUserIds = [];
          this.loadVessel();
        },
        error: (err: HttpErrorResponse) => {
          this.unlinking.set(false);
          this.error.set(this.readError(err, 'Failed to unlink users.'));
        },
      });
  }

  private patchForm(vessel: VesselDetailsDto): void {
    this.name = vessel.name;
    this.imoNumber = vessel.imoNumber ?? '';
    this.flag = vessel.flag ?? '';
    this.notes = vessel.notes ?? '';
    this.isActive = vessel.isActive;
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
