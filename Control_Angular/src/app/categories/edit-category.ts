import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { resolveFileUrl } from '../core/api.config';
import {
  CategoryDto,
  categoryPath,
  CategoryProductLinkDto,
  CategorySupplierLinkDto,
} from './category.model';
import { CategoriesService } from './categories.service';

@Component({
  selector: 'app-edit-category',
  standalone: false,
  templateUrl: './edit-category.html',
  styleUrl: './edit-category.css',
})
export class EditCategory implements OnInit {
  private readonly categoriesService = inject(CategoriesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly loadingLinks = signal(false);
  readonly submitting = signal(false);
  readonly linkingProducts = signal(false);
  readonly unlinkingProducts = signal(false);
  readonly linkingSuppliers = signal(false);
  readonly unlinkingSuppliers = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly category = signal<CategoryDto | null>(null);
  readonly products = signal<CategoryProductLinkDto[]>([]);
  readonly suppliers = signal<CategorySupplierLinkDto[]>([]);

  readonly linkedProducts = computed(() => this.products().filter((item) => item.isLinked));
  readonly availableProducts = computed(() => this.products().filter((item) => !item.isLinked));
  readonly linkedSuppliers = computed(() => this.suppliers().filter((item) => item.isLinked));
  readonly availableSuppliers = computed(() => this.suppliers().filter((item) => !item.isLinked));

  readonly parentOptions = signal<CategoryDto[]>([]);

  categoryId = '';
  name = '';
  description = '';
  isActive = true;
  parentCategoryId: string | null = null;
  parentChain: string[] = [];
  productSearch = '';
  supplierSearch = '';

  selectedLinkProductIds: string[] = [];
  selectedUnlinkProductIds: string[] = [];
  selectedLinkSupplierIds: string[] = [];
  selectedUnlinkSupplierIds: string[] = [];

  ngOnInit(): void {
    this.title.setTitle('Edit Category | Ships Control');

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id')?.trim() ?? '';
      if (!id) {
        this.error.set('Category id is missing.');
        return;
      }
      this.categoryId = id;
      this.loadCategory();
    });
  }

  back(): void {
    void this.router.navigateByUrl('/categories');
  }

  loadCategory(): void {
    if (!this.categoryId) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.categoriesService
      .getAll(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loading.set(false);
          if (!result.succeeded || !result.data) {
            this.category.set(null);
            this.error.set(result.messages?.join(' ') || 'Failed to load category.');
            return;
          }

          const found = result.data.find((item) => item.id === this.categoryId) ?? null;
          if (!found) {
            this.category.set(null);
            this.error.set('Category not found.');
            return;
          }

          this.category.set(found);
          this.name = found.name;
          this.description = found.description ?? '';
          this.isActive = found.isActive;
          this.parentCategoryId = found.parentCategoryId ?? null;
          this.parentOptions.set(this.allowedParents(result.data, this.categoryId));
          this.placeBrowser();
          this.loadLinks();
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.category.set(null);
          this.error.set(this.readError(err, 'Failed to load category.'));
        },
      });
  }

  loadLinks(): void {
    if (!this.categoryId) {
      return;
    }

    this.loadingLinks.set(true);

    forkJoin({
      products: this.categoriesService.getProducts(this.categoryId, {
        search: this.productSearch,
        includeInactive: false,
      }),
      suppliers: this.categoriesService.getSuppliers(this.categoryId, {
        search: this.supplierSearch,
        includeInactive: false,
      }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ products, suppliers }) => {
          this.loadingLinks.set(false);

          if (!products.succeeded || !products.data) {
            this.products.set([]);
            this.error.set(products.messages?.join(' ') || 'Failed to load products.');
          } else {
            this.products.set(products.data);
          }

          if (!suppliers.succeeded || !suppliers.data) {
            this.suppliers.set([]);
            this.error.set(suppliers.messages?.join(' ') || 'Failed to load suppliers.');
          } else {
            this.suppliers.set(suppliers.data);
          }

          this.selectedLinkProductIds = this.selectedLinkProductIds.filter((id) =>
            this.availableProducts().some((item) => item.id === id),
          );
          this.selectedUnlinkProductIds = this.selectedUnlinkProductIds.filter((id) =>
            this.linkedProducts().some((item) => item.id === id),
          );
          this.selectedLinkSupplierIds = this.selectedLinkSupplierIds.filter((id) =>
            this.availableSuppliers().some((item) => item.id === id),
          );
          this.selectedUnlinkSupplierIds = this.selectedUnlinkSupplierIds.filter((id) =>
            this.linkedSuppliers().some((item) => item.id === id),
          );
        },
        error: (err: HttpErrorResponse) => {
          this.loadingLinks.set(false);
          this.products.set([]);
          this.suppliers.set([]);
          this.error.set(this.readError(err, 'Failed to load linked items.'));
        },
      });
  }

  searchProducts(): void {
    this.loadLinks();
  }

  searchSuppliers(): void {
    this.loadLinks();
  }

  imageUrl(path: string | null | undefined): string | null {
    return resolveFileUrl(path);
  }

  isSelected(list: string[], id: string): boolean {
    return list.includes(id);
  }

  toggleId(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
  }

  toggleLinkProduct(id: string): void {
    this.selectedLinkProductIds = this.toggleId(this.selectedLinkProductIds, id);
  }

  toggleUnlinkProduct(id: string): void {
    this.selectedUnlinkProductIds = this.toggleId(this.selectedUnlinkProductIds, id);
  }

  toggleLinkSupplier(id: string): void {
    this.selectedLinkSupplierIds = this.toggleId(this.selectedLinkSupplierIds, id);
  }

  toggleUnlinkSupplier(id: string): void {
    this.selectedUnlinkSupplierIds = this.toggleId(this.selectedUnlinkSupplierIds, id);
  }

  submit(): void {
    this.success.set(null);
    this.error.set(null);

    if (!this.categoryId) {
      this.error.set('Category id is missing.');
      return;
    }

    if (!this.name.trim()) {
      this.error.set('Category name is required.');
      return;
    }

    this.submitting.set(true);

    this.categoriesService
      .update({
        id: this.categoryId,
        name: this.name,
        description: this.description,
        isActive: this.isActive,
        parentCategoryId: this.parentCategoryId,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'Failed to update category.');
            return;
          }

          this.success.set(result.messages?.join(' ') || 'Category updated successfully.');
          this.loadCategory();
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.error.set(this.readError(err, 'Failed to update category.'));
        },
      });
  }

  linkProducts(): void {
    this.runLinkAction(
      this.selectedLinkProductIds,
      'Select at least one product to link.',
      this.linkingProducts,
      () => this.categoriesService.linkProducts(this.categoryId, this.selectedLinkProductIds),
      'Products linked successfully.',
      'Failed to link products.',
      () => {
        this.selectedLinkProductIds = [];
      },
    );
  }

  unlinkProducts(): void {
    this.runLinkAction(
      this.selectedUnlinkProductIds,
      'Select at least one product to unlink.',
      this.unlinkingProducts,
      () => this.categoriesService.unlinkProducts(this.categoryId, this.selectedUnlinkProductIds),
      'Products unlinked successfully.',
      'Failed to unlink products.',
      () => {
        this.selectedUnlinkProductIds = [];
      },
    );
  }

  linkSuppliers(): void {
    this.runLinkAction(
      this.selectedLinkSupplierIds,
      'Select at least one supplier to link.',
      this.linkingSuppliers,
      () => this.categoriesService.linkSuppliers(this.categoryId, this.selectedLinkSupplierIds),
      'Suppliers linked successfully.',
      'Failed to link suppliers.',
      () => {
        this.selectedLinkSupplierIds = [];
      },
    );
  }

  unlinkSuppliers(): void {
    this.runLinkAction(
      this.selectedUnlinkSupplierIds,
      'Select at least one supplier to unlink.',
      this.unlinkingSuppliers,
      () => this.categoriesService.unlinkSuppliers(this.categoryId, this.selectedUnlinkSupplierIds),
      'Suppliers unlinked successfully.',
      'Failed to unlink suppliers.',
      () => {
        this.selectedUnlinkSupplierIds = [];
      },
    );
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

  categoryPath(category: CategoryDto): string {
    return categoryPath(category);
  }

  onParentLevelChange(depth: number, value: string): void {
    const next = this.parentChain.slice(0, depth);
    if (value) {
      next.push(value);
    }

    this.parentChain = next;
    this.parentCategoryId = next.length ? next[next.length - 1] : null;
  }

  private placeBrowser(): void {
    const ancestors = [...(this.category()?.ancestors ?? [])].reverse().map((item) => item.id);
    this.parentChain = ancestors.length
      ? ancestors
      : this.chainTo(this.parentCategoryId).map((item) => item.id);
  }

  private allowedParents(all: CategoryDto[], selfId: string): CategoryDto[] {
    const children = new Map<string, string[]>();
    for (const item of all) {
      if (!item.parentCategoryId) {
        continue;
      }
      const list = children.get(item.parentCategoryId) ?? [];
      list.push(item.id);
      children.set(item.parentCategoryId, list);
    }

    const blocked = new Set<string>([selfId]);
    const stack = [selfId];
    while (stack.length) {
      const id = stack.pop();
      if (!id) {
        continue;
      }
      for (const childId of children.get(id) ?? []) {
        if (!blocked.has(childId)) {
          blocked.add(childId);
          stack.push(childId);
        }
      }
    }

    return all.filter((item) => !blocked.has(item.id));
  }

  private chainTo(id: string | null): CategoryDto[] {
    const byId = new Map(this.parentOptions().map((item) => [item.id, item]));
    const chain: CategoryDto[] = [];
    const seen = new Set<string>();
    let currentId = id;

    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const node = byId.get(currentId);
      if (!node) {
        break;
      }
      chain.unshift(node);
      currentId = node.parentCategoryId;
    }

    return chain;
  }

  private runLinkAction(
    ids: string[],
    emptyMessage: string,
    busy: ReturnType<typeof signal<boolean>>,
    request: () => ReturnType<CategoriesService['linkProducts']>,
    successMessage: string,
    failMessage: string,
    onSuccess: () => void,
  ): void {
    this.success.set(null);
    this.error.set(null);

    if (ids.length === 0) {
      this.error.set(emptyMessage);
      return;
    }

    busy.set(true);

    request()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          busy.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || failMessage);
            return;
          }

          this.success.set(result.messages?.join(' ') || successMessage);
          onSuccess();
          this.loadLinks();
        },
        error: (err: HttpErrorResponse) => {
          busy.set(false);
          this.error.set(this.readError(err, failMessage));
        },
      });
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
