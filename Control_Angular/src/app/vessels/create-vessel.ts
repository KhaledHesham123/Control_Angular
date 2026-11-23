import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { resolveFileUrl } from '../core/api.config';
import { UserLookupDto } from './vessel.model';
import { UserLookupService } from './user-lookup.service';
import { VesselsService } from './vessels.service';

const EMPTY_VESSEL_ID = '00000000-0000-0000-0000-000000000000';

@Component({
  selector: 'app-create-vessel',
  standalone: false,
  templateUrl: './create-vessel.html',
  styleUrl: './create-vessel.css',
})
export class CreateVessel implements OnInit {
  private readonly vesselsService = inject(VesselsService);
  private readonly userLookup = inject(UserLookupService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);
  private readonly router = inject(Router);

  readonly loadingUsers = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly users = signal<UserLookupDto[]>([]);

  name = '';
  imoNumber = '';
  flag = '';
  notes = '';
  selectedUserIds: string[] = [];

  ngOnInit(): void {
    this.title.setTitle('Create Vessel | Falcon Shipping');
    this.loadUsers();
  }

  loadUsers(): void {
    this.loadingUsers.set(true);
    this.error.set(null);

    // Create has no vessel yet — Flag=false with empty VesselId for available users.
    this.userLookup
      .lookup(EMPTY_VESSEL_ID, false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loadingUsers.set(false);
          if (!result.succeeded || !result.data) {
            this.users.set([]);
            this.error.set(result.messages?.join(' ') || 'Failed to load users.');
            return;
          }
          this.users.set(result.data);
        },
        error: (err: HttpErrorResponse) => {
          this.loadingUsers.set(false);
          this.users.set([]);
          this.error.set(this.readError(err, 'Failed to load users.'));
        },
      });
  }

  imageUrl(path: string | null | undefined): string | null {
    return resolveFileUrl(path);
  }

  isUserSelected(id: string): boolean {
    return this.selectedUserIds.includes(id);
  }

  toggleUser(id: string): void {
    if (this.selectedUserIds.includes(id)) {
      this.selectedUserIds = this.selectedUserIds.filter((item) => item !== id);
      return;
    }
    this.selectedUserIds = [...this.selectedUserIds, id];
  }

  submit(): void {
    this.success.set(null);
    this.error.set(null);

    if (!this.name.trim()) {
      this.error.set('Vessel name is required.');
      return;
    }

    this.submitting.set(true);

    this.vesselsService
      .create({
        name: this.name,
        imoNumber: this.imoNumber,
        flag: this.flag,
        notes: this.notes,
        userIds: this.selectedUserIds,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'Failed to create vessel.');
            return;
          }

          this.success.set(result.messages?.join(' ') || 'Vessel created successfully.');
          this.resetForm();
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.error.set(this.readError(err, 'Failed to create vessel.'));
        },
      });
  }

  back(): void {
    void this.router.navigateByUrl('/vessels');
  }

  private resetForm(): void {
    this.name = '';
    this.imoNumber = '';
    this.flag = '';
    this.notes = '';
    this.selectedUserIds = [];
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
