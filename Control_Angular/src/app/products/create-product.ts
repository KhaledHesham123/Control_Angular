import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ProductService } from './product.service';
import {
  ProductScope,
  SHELF_LIFE_UNIT_LABELS,
  ShelfLifeUnit,
  VesselDto,
} from './product.model';
import { VesselService } from './vessel.service';

@Component({
  selector: 'app-create-product',
  standalone: false,
  templateUrl: './create-product.html',
  styleUrl: './create-product.css',
})
export class CreateProduct implements OnInit {
  private readonly vesselService = inject(VesselService);
  private readonly productService = inject(ProductService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);

  readonly ProductScope = ProductScope;
  readonly shelfLifeUnitLabels = SHELF_LIFE_UNIT_LABELS;
  readonly shelfLifeUnitOptions = Object.values(ShelfLifeUnit).filter(
    (value): value is ShelfLifeUnit => typeof value === 'number',
  );

  readonly loadingLookups = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly vessels = signal<VesselDto[]>([]);

  scope: ProductScope = ProductScope.General;
  categoryId = '';
  name = '';
  code = '';
  defaultUnit = '';
  description = '';
  shelfLifeValue: number | null = null;
  shelfLifeUnit: ShelfLifeUnit | null = null;
  quantityOnHand = 0;
  selectedVesselIds: string[] = [];
  image: File | null = null;
  imagePreview: string | null = null;

  ngOnInit(): void {
    this.title.setTitle('Create Product | Falcon Shipping');
    this.loadLookups();
  }

  loadLookups(): void {
    this.loadingLookups.set(true);
    this.error.set(null);

    // Create flow: product does not exist yet, so Vessel Lookup(ProductId) cannot be used.
    this.vesselService
      .getAll(false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loadingLookups.set(false);
          if (!result.succeeded || !result.data) {
            this.vessels.set([]);
            this.error.set(result.messages?.join(' ') || 'Failed to load vessels.');
            return;
          }
          this.vessels.set(result.data);
        },
        error: (err: HttpErrorResponse) => {
          this.loadingLookups.set(false);
          this.vessels.set([]);
          this.error.set(this.readError(err, 'Failed to load vessels.'));
        },
      });
  }

  onCategoryFailed(message: string): void {
    this.error.set(message);
  }

  onScopeChange(value: string | number): void {
    this.scope = Number(value) as ProductScope;
    if (this.scope === ProductScope.General) {
      this.selectedVesselIds = [];
    }
  }

  isVesselSelected(id: string): boolean {
    return this.selectedVesselIds.includes(id);
  }

  toggleVessel(id: string): void {
    if (this.selectedVesselIds.includes(id)) {
      this.selectedVesselIds = this.selectedVesselIds.filter((item) => item !== id);
      return;
    }
    this.selectedVesselIds = [...this.selectedVesselIds, id];
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.image = file;

    if (this.imagePreview) {
      URL.revokeObjectURL(this.imagePreview);
      this.imagePreview = null;
    }

    if (file) {
      this.imagePreview = URL.createObjectURL(file);
    }
  }

  clearImage(input?: HTMLInputElement): void {
    this.image = null;
    if (this.imagePreview) {
      URL.revokeObjectURL(this.imagePreview);
      this.imagePreview = null;
    }
    if (input) {
      input.value = '';
    }
  }

  submit(): void {
    this.success.set(null);
    this.error.set(null);

    if (!this.categoryId) {
      this.error.set('Select a category.');
      return;
    }

    if (!this.name.trim()) {
      this.error.set('Product name is required.');
      return;
    }

    if (!this.defaultUnit.trim()) {
      this.error.set('Default unit is required.');
      return;
    }

    if (this.quantityOnHand < 0) {
      this.error.set('Quantity cannot be negative.');
      return;
    }

    const shelfLifeError = this.validateShelfLife();
    if (shelfLifeError) {
      this.error.set(shelfLifeError);
      return;
    }

    if (this.scope === ProductScope.VesselSpecific && this.selectedVesselIds.length === 0) {
      this.error.set('Select at least one vessel when Scope is VesselSpecific.');
      return;
    }

    this.submitting.set(true);

    this.productService
      .create({
        scope: this.scope,
        vesselIds: this.selectedVesselIds,
        categoryId: this.categoryId,
        name: this.name,
        code: this.code,
        defaultUnit: this.defaultUnit,
        description: this.description,
        shelfLifeValue: this.normalizedShelfLifeValue(),
        shelfLifeUnit: this.normalizedShelfLifeUnit(),
        quantityOnHand: this.quantityOnHand,
        image: this.image,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'Failed to create product.');
            return;
          }

          this.success.set(result.messages?.join(' ') || 'Product created successfully.');
          this.resetForm();
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.error.set(this.readError(err, 'Failed to create product.'));
        },
      });
  }

  private resetForm(): void {
    this.scope = ProductScope.General;
    this.categoryId = '';
    this.name = '';
    this.code = '';
    this.defaultUnit = '';
    this.description = '';
    this.shelfLifeValue = null;
    this.shelfLifeUnit = null;
    this.quantityOnHand = 0;
    this.selectedVesselIds = [];
    this.clearImage();
  }

  private validateShelfLife(): string | null {
    const value = this.normalizedShelfLifeValue();
    const unit = this.normalizedShelfLifeUnit();

    if (this.shelfLifeValue != null && Number(this.shelfLifeValue) <= 0) {
      return 'Shelf life value must be greater than 0.';
    }

    if (value != null && unit == null) {
      return 'Select a shelf life unit.';
    }

    if (unit != null && value == null) {
      return 'Enter a shelf life value.';
    }

    return null;
  }

  private normalizedShelfLifeValue(): number | null {
    if (this.shelfLifeValue == null) {
      return null;
    }
    const value = Number(this.shelfLifeValue);
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }
    return Math.trunc(value);
  }

  private normalizedShelfLifeUnit(): ShelfLifeUnit | null {
    if (this.shelfLifeUnit == null) {
      return null;
    }
    return Number(this.shelfLifeUnit) as ShelfLifeUnit;
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
