import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CategoryCatalogService } from '../products/category-catalog.service';
import { CategoryLookupDto } from '../products/product.model';

@Component({
  selector: 'app-category-lookup',
  standalone: false,
  templateUrl: './category-lookup.html',
  styleUrl: './category-lookup.css',
})
export class CategoryLookup implements OnInit {
  private readonly categoryService = inject(CategoryCatalogService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() label = 'Category Lookup';
  @Input() placeholder = 'Select category';
  @Input() required = false;
  @Input() disabled = false;
  @Input() name = 'categoryId';
  @Input() tree = false;

  @Input() set categoryId(value: string) {
    this.selectedId = value || '';
  }
  get categoryId(): string {
    return this.selectedId;
  }

  @Input() set selectionIds(value: string[] | null | undefined) {
    if (!this.tree) {
      return;
    }

    const next = new Set(value ?? []);
    const current = this.checkedIds();
    if (next.size === current.size && [...next].every((id) => current.has(id))) {
      return;
    }

    this.checkedIds.set(next);
  }

  @Output() categoryIdChange = new EventEmitter<string>();
  @Output() categoryIdsChange = new EventEmitter<string[]>();
  @Output() loaded = new EventEmitter<CategoryLookupDto[]>();
  @Output() failed = new EventEmitter<string>();

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly categories = signal<CategoryLookupDto[]>([]);
  readonly openedIds = signal<ReadonlySet<string>>(new Set());
  readonly checkedIds = signal<ReadonlySet<string>>(new Set());

  selectedId = '';

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);

    this.categoryService
      .lookup()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loading.set(false);

          if (!result.succeeded || !result.data) {
            this.categories.set([]);
            const message = result.messages?.join(' ') || 'Failed to load categories.';
            this.error.set(message);
            this.failed.emit(message);
            return;
          }

          this.categories.set(result.data);
          this.loaded.emit(result.data);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.categories.set([]);
          const message = this.readError(err);
          this.error.set(message);
          this.failed.emit(message);
        },
      });
  }

  onChange(value: string): void {
    this.selectedId = value || '';
    this.categoryIdChange.emit(this.selectedId);
  }

  roots(): CategoryLookupDto[] {
    return this.childrenOf(null);
  }

  childCategories(parentId: string): CategoryLookupDto[] {
    return this.childrenOf(parentId);
  }

  childCount(category: CategoryLookupDto): number {
    return this.childCategories(category.id).length;
  }

  hasChildren(category: CategoryLookupDto): boolean {
    return this.childCount(category) > 0;
  }

  isOpen(id: string): boolean {
    return this.openedIds().has(id);
  }

  isChecked(id: string): boolean {
    return this.checkedIds().has(id);
  }

  toggleOpen(id: string): void {
    const next = new Set(this.openedIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.openedIds.set(next);
  }

  allChecked(category: CategoryLookupDto): boolean {
    const children = this.childCategories(category.id);
    return children.length > 0 && children.every((child) => this.isChecked(child.id));
  }

  partial(category: CategoryLookupDto): boolean {
    const children = this.childCategories(category.id);
    const selected = children.filter((child) => this.isChecked(child.id)).length;
    return selected > 0 && selected < children.length;
  }

  onLeafCheck(category: CategoryLookupDto, checked: boolean): void {
    const next = new Set(this.checkedIds());
    if (checked) {
      next.add(category.id);
    } else {
      next.delete(category.id);
    }
    this.checkedIds.set(next);
    this.emitChecked();
  }

  toggleAll(category: CategoryLookupDto, checked: boolean): void {
    const next = new Set(this.checkedIds());
    for (const child of this.childCategories(category.id)) {
      if (checked) {
        next.add(child.id);
      } else {
        next.delete(child.id);
      }
    }
    this.checkedIds.set(next);
    if (checked) {
      const opened = new Set(this.openedIds());
      opened.add(category.id);
      this.openedIds.set(opened);
    }
    this.emitChecked();
  }

  private childrenOf(parentId: string | null): CategoryLookupDto[] {
    const all = this.categories();
    if (!parentId) {
      const ids = new Set(all.map((item) => item.id));
      return all.filter((item) => !item.parentCategoryId || !ids.has(item.parentCategoryId));
    }

    return all.filter((item) => item.parentCategoryId === parentId);
  }

  private emitChecked(): void {
    this.categoryIdsChange.emit([...this.checkedIds()]);
  }

  private readError(err: HttpErrorResponse): string {
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

    return 'Failed to load categories.';
  }
}
