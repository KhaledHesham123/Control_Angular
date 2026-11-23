import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { resolveFileUrl } from '../core/api.config';
import {
  CategoryDto,
  CategoryProductLinkDto,
  CategorySupplierLinkDto,
} from './category.model';
import { CategoriesService } from './categories.service';

@Component({
  selector: 'app-categories-list',
  standalone: false,
  templateUrl: './categories-list.html',
  styleUrl: './categories-list.css',
})
export class CategoriesList implements OnInit {
  private readonly categoriesService = inject(CategoriesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly detailsLoadingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly categories = signal<CategoryDto[]>([]);
  readonly openedIds = signal<ReadonlySet<string>>(new Set());
  readonly linkedProducts = signal<Record<string, CategoryProductLinkDto[]>>({});
  readonly linkedSuppliers = signal<Record<string, CategorySupplierLinkDto[]>>({});
  readonly expandedId = signal<string | null>(null);
  readonly pendingDelete = signal<CategoryDto | null>(null);

  includeInactive = false;

  ngOnInit(): void {
    this.title.setTitle('Category Management | Falcon Shipping');
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading.set(true);
    this.error.set(null);

    this.categoriesService
      .getAll(this.includeInactive)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loading.set(false);
          if (!result.succeeded || !result.data) {
            this.categories.set([]);
            this.error.set(result.messages?.join(' ') || 'Failed to load categories.');
            return;
          }
          this.categories.set(result.data);
          const ids = new Set(result.data.map((item) => item.id));
          this.openedIds.set(new Set([...this.openedIds()].filter((id) => ids.has(id))));
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.categories.set([]);
          this.error.set(this.readError(err, 'Failed to load categories.'));
        },
      });
  }

  onIncludeInactiveChange(checked: boolean): void {
    this.includeInactive = checked;
    this.openedIds.set(new Set());
    this.expandedId.set(null);
    this.linkedProducts.set({});
    this.linkedSuppliers.set({});
    this.loadCategories();
  }

  toggleDetails(categoryId: string): void {
    if (this.expandedId() === categoryId) {
      this.expandedId.set(null);
      return;
    }

    this.expandedId.set(categoryId);
    if (!this.linkedProducts()[categoryId] || !this.linkedSuppliers()[categoryId]) {
      this.loadDetails(categoryId);
    }
  }

  loadDetails(categoryId: string): void {
    this.detailsLoadingId.set(categoryId);
    this.error.set(null);

    this.categoriesService
      .getProducts(categoryId, { includeInactive: false })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (!result.succeeded || !result.data) {
            this.error.set(result.messages?.join(' ') || 'Failed to load category products.');
          } else {
            this.linkedProducts.set({
              ...this.linkedProducts(),
              [categoryId]: result.data.filter((item) => item.isLinked),
            });
          }
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(this.readError(err, 'Failed to load category products.'));
        },
      });

    this.categoriesService
      .getSuppliers(categoryId, { includeInactive: false })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.detailsLoadingId.set(null);
          if (!result.succeeded || !result.data) {
            this.error.set(result.messages?.join(' ') || 'Failed to load category suppliers.');
            return;
          }
          this.linkedSuppliers.set({
            ...this.linkedSuppliers(),
            [categoryId]: result.data.filter((item) => item.isLinked),
          });
        },
        error: (err: HttpErrorResponse) => {
          this.detailsLoadingId.set(null);
          this.error.set(this.readError(err, 'Failed to load category suppliers.'));
        },
      });
  }

  imageUrl(path: string | null | undefined): string | null {
    return resolveFileUrl(path);
  }

  create(): void {
    void this.router.navigateByUrl('/categories/create');
  }

  edit(categoryId: string): void {
    void this.router.navigate(['/categories/edit', categoryId]);
  }

  categoryRows(): { category: CategoryDto; depth: number }[] {
    const rows: { category: CategoryDto; depth: number }[] = [];
    const walk = (items: CategoryDto[], depth: number): void => {
      for (const item of items) {
        rows.push({ category: item, depth });
        if (this.isOpen(item.id)) {
          walk(this.childrenOf(item), depth + 1);
        }
      }
    };

    walk(this.rootCategories(), 0);
    return rows;
  }

  rootCategories(): CategoryDto[] {
    const all = this.categories();
    const ids = new Set(all.map((item) => item.id));
    return all.filter((item) => !item.parentCategoryId || !ids.has(item.parentCategoryId));
  }

  childrenOf(category: CategoryDto): CategoryDto[] {
    return this.categories().filter((item) => item.parentCategoryId === category.id);
  }

  hasChildren(category: CategoryDto): boolean {
    return this.childrenOf(category).length > 0;
  }

  isOpen(id: string): boolean {
    return this.openedIds().has(id);
  }

  toggleChildren(category: CategoryDto): void {
    if (!this.hasChildren(category)) {
      return;
    }

    const next = new Set(this.openedIds());
    if (next.has(category.id)) {
      next.delete(category.id);
    } else {
      next.add(category.id);
    }
    this.openedIds.set(next);
  }

  askDelete(category: CategoryDto): void {
    this.error.set(null);
    this.success.set(null);
    this.pendingDelete.set(category);
  }

  cancelDelete(): void {
    if (this.deletingId()) {
      return;
    }
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const category = this.pendingDelete();
    if (!category) {
      return;
    }

    this.deletingId.set(category.id);
    this.error.set(null);
    this.success.set(null);

    this.categoriesService
      .delete(category.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.deletingId.set(null);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'Could not delete this category.');
            return;
          }

          this.pendingDelete.set(null);
          this.success.set(`“${category.name}” was deleted.`);
          if (this.expandedId() === category.id) {
            this.expandedId.set(null);
          }
          if (this.openedIds().has(category.id)) {
            const next = new Set(this.openedIds());
            next.delete(category.id);
            this.openedIds.set(next);
          }
          this.loadCategories();
        },
        error: (err: HttpErrorResponse) => {
          this.deletingId.set(null);
          this.error.set(this.readError(err, 'Could not delete this category.'));
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
