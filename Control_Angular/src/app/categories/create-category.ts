import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ProductListDto } from '../products/product.model';
import { ProductService } from '../products/product.service';
import { CategoryDto, categoryPath } from './category.model';
import { CategoriesService } from './categories.service';

@Component({
  selector: 'app-create-category',
  standalone: false,
  templateUrl: './create-category.html',
  styleUrl: './create-category.css',
})
export class CreateCategory implements OnInit {
  private readonly categoriesService = inject(CategoriesService);
  private readonly productService = inject(ProductService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);
  private readonly router = inject(Router);

  readonly loadingProducts = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly products = signal<ProductListDto[]>([]);
  readonly parentOptions = signal<CategoryDto[]>([]);

  name = '';
  description = '';
  parentCategoryId: string | null = null;
  parentChain: string[] = [];
  selectedProductIds: string[] = [];

  ngOnInit(): void {
    this.title.setTitle('Create Category | Ships Control');
    this.loadProducts();
    this.loadParents();
  }

  loadParents(): void {
    this.categoriesService
      .getAll(false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.parentOptions.set(result.succeeded && result.data ? result.data : []);
        },
        error: () => this.parentOptions.set([]),
      });
  }

  loadProducts(): void {
    this.loadingProducts.set(true);
    this.error.set(null);

    this.productService
      .getAll({ includeInactive: false })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loadingProducts.set(false);
          if (!result.succeeded || !result.data) {
            this.products.set([]);
            this.error.set(result.messages?.join(' ') || 'Failed to load products.');
            return;
          }
          this.products.set(
            result.data.map((item) => ({
              ...item,
              vesselNames: item.vesselNames ?? [],
            })),
          );
        },
        error: (err: HttpErrorResponse) => {
          this.loadingProducts.set(false);
          this.products.set([]);
          this.error.set(this.readError(err, 'Failed to load products.'));
        },
      });
  }

  isProductSelected(id: string): boolean {
    return this.selectedProductIds.includes(id);
  }

  toggleProduct(id: string): void {
    if (this.selectedProductIds.includes(id)) {
      this.selectedProductIds = this.selectedProductIds.filter((item) => item !== id);
      return;
    }
    this.selectedProductIds = [...this.selectedProductIds, id];
  }

  submit(): void {
    this.success.set(null);
    this.error.set(null);

    if (!this.name.trim()) {
      this.error.set('Category name is required.');
      return;
    }

    this.submitting.set(true);

    this.categoriesService
      .create({
        name: this.name,
        description: this.description,
        parentCategoryId: this.parentCategoryId,
        productIds: this.selectedProductIds,
        supplierIds: [],
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'Failed to create category.');
            return;
          }

          this.success.set(result.messages?.join(' ') || 'Category created successfully.');
          this.name = '';
          this.description = '';
          this.parentCategoryId = null;
          this.parentChain = [];
          this.selectedProductIds = [];
          this.loadParents();
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.error.set(this.readError(err, 'Failed to create category.'));
        },
      });
  }

  back(): void {
    void this.router.navigateByUrl('/categories');
  }

  parentLevels(): { key: string; options: CategoryDto[]; selectedId: string }[] {
    const levels: { key: string; options: CategoryDto[]; selectedId: string }[] = [];
    let parentId: string | null = null;

    for (let depth = 0; depth < 12; depth++) {
      const options = this.parentOptions().filter((item) => (item.parentCategoryId ?? null) === parentId);
      if (options.length === 0) {
        break;
      }

      const selectedId = this.parentChain[depth] ?? '';
      levels.push({ key: parentId ?? 'root', options, selectedId });
      if (!selectedId) {
        break;
      }

      parentId = selectedId;
    }

    return levels;
  }

  parentPathLabel(): string {
    if (!this.parentCategoryId) {
      return '';
    }

    const selected = this.parentOptions().find((item) => item.id === this.parentCategoryId);
    return selected ? categoryPath(selected) : '';
  }

  onParentLevelChange(depth: number, value: string): void {
    const next = this.parentChain.slice(0, depth);
    if (value) {
      next.push(value);
    }

    this.parentChain = next;
    this.parentCategoryId = next.length ? next[next.length - 1] : null;
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
