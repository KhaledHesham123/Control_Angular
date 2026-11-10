import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { resolveFileUrl } from '../core/api.config';
import { ProductDto, ProductListDto } from './product.model';
import { ProductService } from './product.service';

@Component({
  selector: 'app-products-list',
  standalone: false,
  templateUrl: './products-list.html',
  styleUrl: './products-list.css',
})
export class ProductsList implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly detailsLoadingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly products = signal<ProductListDto[]>([]);
  readonly details = signal<Record<string, ProductDto>>({});
  readonly expandedId = signal<string | null>(null);
  readonly pendingDelete = signal<ProductListDto | null>(null);

  categoryId = '';

  ngOnInit(): void {
    this.title.setTitle('Product Management | Ships Control');
    this.loadProducts();
  }

  onCategoryChange(categoryId: string): void {
    this.categoryId = categoryId || '';
    this.expandedId.set(null);
    this.details.set({});
    this.loadProducts();
  }

  onCategoryFailed(message: string): void {
    this.error.set(message);
  }

  loadProducts(): void {
    this.loading.set(true);
    this.error.set(null);

    this.productService
      .getAll({
        categoryId: this.categoryId || null,
        includeInactive: false,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loading.set(false);
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
          this.loading.set(false);
          this.products.set([]);
          this.error.set(this.readError(err, 'Failed to load products.'));
        },
      });
  }

  toggleDetails(productId: string): void {
    if (this.expandedId() === productId) {
      this.expandedId.set(null);
      return;
    }

    this.expandedId.set(productId);
    if (!this.details()[productId]) {
      this.loadDetails(productId);
    }
  }

  loadDetails(productId: string): void {
    this.detailsLoadingId.set(productId);
    this.error.set(null);

    this.productService
      .getById(productId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.detailsLoadingId.set(null);
          if (!result.succeeded || !result.data) {
            this.error.set(result.messages?.join(' ') || 'Failed to load product details.');
            return;
          }
          this.details.set({
            ...this.details(),
            [productId]: {
              ...result.data,
              vesselStocks: result.data.vesselStocks ?? [],
            },
          });
        },
        error: (err: HttpErrorResponse) => {
          this.detailsLoadingId.set(null);
          this.error.set(this.readError(err, 'Failed to load product details.'));
        },
      });
  }

  create(): void {
    void this.router.navigateByUrl('/products/create');
  }

  edit(productId: string): void {
    void this.router.navigate(['/products/edit', productId]);
  }

  askDelete(product: ProductListDto): void {
    this.error.set(null);
    this.success.set(null);
    this.pendingDelete.set(product);
  }

  cancelDelete(): void {
    if (this.deletingId()) {
      return;
    }
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const product = this.pendingDelete();
    if (!product) {
      return;
    }

    this.deletingId.set(product.id);
    this.error.set(null);
    this.success.set(null);

    this.productService
      .delete(product.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.deletingId.set(null);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'Could not delete this product.');
            return;
          }

          this.pendingDelete.set(null);
          this.success.set(`“${product.name}” was deleted.`);
          if (this.expandedId() === product.id) {
            this.expandedId.set(null);
          }
          const nextDetails = { ...this.details() };
          delete nextDetails[product.id];
          this.details.set(nextDetails);
          this.loadProducts();
        },
        error: (err: HttpErrorResponse) => {
          this.deletingId.set(null);
          this.error.set(this.readError(err, 'Could not delete this product.'));
        },
      });
  }

  back(): void {
    void this.router.navigateByUrl('/');
  }

  imageUrl(path: string | null | undefined): string | null {
    return resolveFileUrl(path);
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
