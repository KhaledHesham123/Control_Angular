import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { resolveFileUrl } from '../core/api.config';
import {
  ProductDto,
  ProductScope,
  SHELF_LIFE_UNIT_LABELS,
  ShelfLifeUnit,
  VesselDto,
} from './product.model';
import { ProductService } from './product.service';
import { VesselService } from './vessel.service';

@Component({
  selector: 'app-edit-product',
  standalone: false,
  templateUrl: './edit-product.html',
  styleUrl: './edit-product.css',
})
export class EditProduct implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly vesselService = inject(VesselService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly ProductScope = ProductScope;
  readonly shelfLifeUnitLabels = SHELF_LIFE_UNIT_LABELS;
  readonly shelfLifeUnitOptions = Object.values(ShelfLifeUnit).filter(
    (value): value is ShelfLifeUnit => typeof value === 'number',
  );

  readonly loading = signal(false);
  readonly loadingVessels = signal(false);
  readonly submitting = signal(false);
  readonly linking = signal(false);
  readonly unlinking = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly product = signal<ProductDto | null>(null);
  readonly linkedVessels = signal<VesselDto[]>([]);
  readonly availableVessels = signal<VesselDto[]>([]);

  productId = '';
  name = '';
  code = '';
  defaultUnit = '';
  description = '';
  shelfLifeValue: number | null = null;
  shelfLifeUnit: ShelfLifeUnit | null = null;
  scope: ProductScope = ProductScope.General;
  isActive = true;
  image: File | null = null;
  imagePreview: string | null = null;
  currentImagePath: string | null = null;

  selectedLinkVesselIds: string[] = [];
  selectedUnlinkVesselIds: string[] = [];
  linkQuantityOnHand = 0;

  ngOnInit(): void {
    this.title.setTitle('Edit Product | Falcon Shipping');

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id')?.trim() ?? '';
      if (!id) {
        this.error.set('Product id is missing.');
        return;
      }
      this.productId = id;
      this.loadProduct();
    });
  }

  back(): void {
    void this.router.navigateByUrl('/products');
  }

  onScopeChange(value: ProductScope | string | number): void {
    this.scope = Number(value) as ProductScope;
    if (this.scope === ProductScope.General) {
      this.selectedLinkVesselIds = [];
      this.selectedUnlinkVesselIds = [];
      this.linkQuantityOnHand = 0;
      this.linkedVessels.set([]);
      this.availableVessels.set([]);
      return;
    }
    this.loadVesselLookups();
  }

  loadProduct(): void {
    if (!this.productId) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.productService
      .getById(this.productId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loading.set(false);
          if (!result.succeeded || !result.data) {
            this.product.set(null);
            this.error.set(result.messages?.join(' ') || 'Failed to load product.');
            return;
          }

          const data: ProductDto = {
            ...result.data,
            vesselStocks: result.data.vesselStocks ?? [],
          };
          this.product.set(data);
          this.patchForm(data);
          if (this.scope === ProductScope.VesselSpecific) {
            this.loadVesselLookups();
          } else {
            this.linkedVessels.set([]);
            this.availableVessels.set([]);
          }
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.product.set(null);
          this.error.set(this.readError(err, 'Failed to load product.'));
        },
      });
  }

  loadVesselLookups(): void {
    if (!this.productId) {
      return;
    }

    this.loadingVessels.set(true);

    forkJoin({
      linked: this.vesselService.lookup(this.productId, true),
      available: this.vesselService.lookup(this.productId, false),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ linked, available }) => {
          this.loadingVessels.set(false);

          if (!linked.succeeded || !linked.data) {
            this.linkedVessels.set([]);
            this.error.set(linked.messages?.join(' ') || 'Failed to load linked vessels.');
          } else {
            this.linkedVessels.set(linked.data);
          }

          if (!available.succeeded || !available.data) {
            this.availableVessels.set([]);
            this.error.set(available.messages?.join(' ') || 'Failed to load available vessels.');
          } else {
            this.availableVessels.set(available.data);
          }

          this.selectedLinkVesselIds = this.selectedLinkVesselIds.filter((id) =>
            this.availableVessels().some((vessel) => vessel.id === id),
          );
          this.selectedUnlinkVesselIds = this.selectedUnlinkVesselIds.filter((id) =>
            this.linkedVessels().some((vessel) => vessel.id === id),
          );
        },
        error: (err: HttpErrorResponse) => {
          this.loadingVessels.set(false);
          this.linkedVessels.set([]);
          this.availableVessels.set([]);
          this.error.set(this.readError(err, 'Failed to load vessel lists.'));
        },
      });
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

  isLinkSelected(id: string): boolean {
    return this.selectedLinkVesselIds.includes(id);
  }

  toggleLinkVessel(id: string): void {
    if (this.selectedLinkVesselIds.includes(id)) {
      this.selectedLinkVesselIds = this.selectedLinkVesselIds.filter((item) => item !== id);
      return;
    }
    this.selectedLinkVesselIds = [...this.selectedLinkVesselIds, id];
  }

  isUnlinkSelected(id: string): boolean {
    return this.selectedUnlinkVesselIds.includes(id);
  }

  toggleUnlinkVessel(id: string): void {
    if (this.selectedUnlinkVesselIds.includes(id)) {
      this.selectedUnlinkVesselIds = this.selectedUnlinkVesselIds.filter((item) => item !== id);
      return;
    }
    this.selectedUnlinkVesselIds = [...this.selectedUnlinkVesselIds, id];
  }

  submit(): void {
    this.success.set(null);
    this.error.set(null);

    if (!this.productId) {
      this.error.set('Product id is missing.');
      return;
    }

    if (!this.name.trim() || !this.defaultUnit.trim()) {
      this.error.set('Name and default unit are required.');
      return;
    }

    const shelfLifeError = this.validateShelfLife();
    if (shelfLifeError) {
      this.error.set(shelfLifeError);
      return;
    }

    this.submitting.set(true);

    this.productService
      .update({
        id: this.productId,
        name: this.name,
        code: this.code,
        defaultUnit: this.defaultUnit,
        description: this.description,
        shelfLifeValue: this.normalizedShelfLifeValue(),
        shelfLifeUnit: this.normalizedShelfLifeUnit(),
        scope: this.scope,
        isActive: this.isActive,
        image: this.image,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'Failed to update product.');
            return;
          }

          this.success.set(result.messages?.join(' ') || 'Product updated successfully.');
          this.clearImage();
          this.loadProduct();
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.error.set(this.readError(err, 'Failed to update product.'));
        },
      });
  }

  linkVessels(): void {
    this.success.set(null);
    this.error.set(null);

    if (this.scope === ProductScope.General) {
      this.error.set('Vessel linking is disabled when Scope is General.');
      return;
    }

    if (this.selectedLinkVesselIds.length === 0) {
      this.error.set('Select at least one vessel to link.');
      return;
    }

    if (this.linkQuantityOnHand < 0) {
      this.error.set('Quantity cannot be negative.');
      return;
    }

    this.linking.set(true);

    this.productService
      .linkVessel(this.productId, this.selectedLinkVesselIds, this.linkQuantityOnHand)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.linking.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'Failed to link vessels.');
            return;
          }

          this.success.set(result.messages?.join(' ') || 'Vessels linked successfully.');
          this.selectedLinkVesselIds = [];
          this.linkQuantityOnHand = 0;
          this.loadProduct();
        },
        error: (err: HttpErrorResponse) => {
          this.linking.set(false);
          this.error.set(this.readError(err, 'Failed to link vessels.'));
        },
      });
  }

  unlinkVessels(): void {
    this.success.set(null);
    this.error.set(null);

    if (this.scope === ProductScope.General) {
      this.error.set('Vessel unlinking is disabled when Scope is General.');
      return;
    }

    if (this.selectedUnlinkVesselIds.length === 0) {
      this.error.set('Select at least one vessel to unlink.');
      return;
    }

    this.unlinking.set(true);

    this.productService
      .unlinkVessel(this.productId, this.selectedUnlinkVesselIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.unlinking.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'Failed to unlink vessels.');
            return;
          }

          this.success.set(result.messages?.join(' ') || 'Vessels unlinked successfully.');
          this.selectedUnlinkVesselIds = [];
          this.loadProduct();
        },
        error: (err: HttpErrorResponse) => {
          this.unlinking.set(false);
          this.error.set(this.readError(err, 'Failed to unlink vessels.'));
        },
      });
  }

  imageUrl(path: string | null | undefined): string | null {
    if (path?.startsWith('blob:')) {
      return path;
    }
    return resolveFileUrl(path);
  }

  private patchForm(product: ProductDto): void {
    this.name = product.name;
    this.code = product.code ?? '';
    this.defaultUnit = product.defaultUnit;
    this.description = product.description ?? '';
    this.shelfLifeValue = product.shelfLifeValue ?? null;
    this.shelfLifeUnit =
      product.shelfLifeUnit == null ? null : (Number(product.shelfLifeUnit) as ShelfLifeUnit);
    this.scope =
      product.scope ??
      (product.vesselStocks.length > 0 ? ProductScope.VesselSpecific : ProductScope.General);
    this.isActive = product.isActive;
    this.currentImagePath = product.imagePath;

    if (this.scope === ProductScope.General) {
      this.selectedLinkVesselIds = [];
      this.selectedUnlinkVesselIds = [];
      this.linkQuantityOnHand = 0;
    }
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
