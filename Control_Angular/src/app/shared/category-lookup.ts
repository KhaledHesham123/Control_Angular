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

  @Input() set categoryId(value: string) {
    this.selectedId = value || '';
  }
  get categoryId(): string {
    return this.selectedId;
  }

  @Output() categoryIdChange = new EventEmitter<string>();
  @Output() loaded = new EventEmitter<CategoryLookupDto[]>();
  @Output() failed = new EventEmitter<string>();

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly categories = signal<CategoryLookupDto[]>([]);

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
