import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { CategoriesService } from '../categories/categories.service';
import { CategoryDto, categoryPath } from '../categories/category.model';
import { SupplierBoardItem, SupplierBoardService } from './supplier-board.service';

@Component({
  selector: 'app-supplier-board',
  standalone: false,
  templateUrl: './supplier-board.html',
  styleUrl: './supplier-board.css',
})
export class SupplierBoard implements OnInit {
  private readonly suppliers = inject(SupplierBoardService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly items = signal<SupplierBoardItem[]>([]);
  readonly categories = signal<CategoryDto[]>([]);

  search = '';
  companyName = '';
  primaryEmail = '';
  phone = '';
  country = '';
  contactPerson = '';
  categoryId = '';
  linkCategoryId: Record<string, string> = {};

  ngOnInit(): void {
    this.title.setTitle('الموردون | Falcon Shipping');
    this.categoriesService
      .getAll(false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.categories.set(result.succeeded ? result.data ?? [] : []);
      });
    this.load();
  }

  categoryLabel(category: CategoryDto): string {
    return categoryPath(category);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.suppliers
      .board(this.search)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loading.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'تعذر جلب الموردين.');
            return;
          }
          const rows = result.data ?? [];
          const links = { ...this.linkCategoryId };
          for (const row of rows) {
            links[row.id] ??= '';
          }
          this.linkCategoryId = links;
          this.items.set(rows);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(this.readError(err, 'تعذر جلب الموردين.'));
        },
      });
  }

  create(): void {
    if (!this.companyName.trim()) {
      this.error.set('اسم المورد مطلوب.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.suppliers
      .create({
        companyName: this.companyName.trim(),
        primaryEmail: this.primaryEmail.trim() || null,
        phone: this.phone.trim() || null,
        country: this.country.trim() || null,
        contactPerson: this.contactPerson.trim() || null,
        categoryId: this.categoryId || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'تعذر إضافة المورد.');
            return;
          }
          this.success.set('تم إضافة المورد.');
          this.companyName = '';
          this.primaryEmail = '';
          this.phone = '';
          this.country = '';
          this.contactPerson = '';
          this.categoryId = '';
          this.load();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.error.set(this.readError(err, 'تعذر إضافة المورد.'));
        },
      });
  }

  link(supplier: SupplierBoardItem): void {
    const categoryId = this.linkCategoryId[supplier.id];
    if (!categoryId) {
      this.error.set('اختار القسم قبل الربط.');
      return;
    }
    this.saving.set(true);
    this.suppliers
      .link(supplier.id, categoryId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'تعذر الربط.');
            return;
          }
          this.success.set('تم ربط المورد بالقسم.');
          this.load();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.error.set(this.readError(err, 'تعذر الربط.'));
        },
      });
  }

  unlink(supplierId: string, categoryId: string): void {
    this.saving.set(true);
    this.suppliers
      .unlink(supplierId, categoryId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          if (!result.succeeded) {
            this.error.set(result.messages?.join(' ') || 'تعذر فك الربط.');
            return;
          }
          this.success.set('تم فك الربط.');
          this.load();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.error.set(this.readError(err, 'تعذر فك الربط.'));
        },
      });
  }

  private readError(err: HttpErrorResponse, fallback: string): string {
    const messages = err.error?.messages;
    if (Array.isArray(messages) && messages.length) {
      return messages.join(' ');
    }
    return fallback;
  }
}
