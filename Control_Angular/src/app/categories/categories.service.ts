import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { Result } from '../core/api.model';
import {
  CategoryDto,
  CategoryProductLinkDto,
  CategorySupplierLinkDto,
  CreateCategoryFormValue,
  UpdateCategoryFormValue,
} from './category.model';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/Categories`;

  getAll(includeInactive = false): Observable<Result<CategoryDto[]>> {
    const params = new HttpParams().set('IncludeInactive', includeInactive);
    return this.http.get<Result<CategoryDto[]>>(`${this.baseUrl}/GetAll`, { params }).pipe(
      map((result) => ({
        ...result,
        data: result.data?.map((item) => normalizeCategory(item)) ?? null,
      })),
    );
  }

  getProducts(
    categoryId: string,
    options?: { search?: string | null; includeInactive?: boolean },
  ): Observable<Result<CategoryProductLinkDto[]>> {
    let params = new HttpParams()
      .set('CategoryId', categoryId)
      .set('IncludeInactive', options?.includeInactive ?? false);
    if (options?.search?.trim()) {
      params = params.set('Search', options.search.trim());
    }
    return this.http.get<Result<CategoryProductLinkDto[]>>(`${this.baseUrl}/Products`, { params });
  }

  getSuppliers(
    categoryId: string,
    options?: { search?: string | null; includeInactive?: boolean },
  ): Observable<Result<CategorySupplierLinkDto[]>> {
    let params = new HttpParams()
      .set('CategoryId', categoryId)
      .set('IncludeInactive', options?.includeInactive ?? false);
    if (options?.search?.trim()) {
      params = params.set('Search', options.search.trim());
    }
    return this.http.get<Result<CategorySupplierLinkDto[]>>(`${this.baseUrl}/Suppliers`, {
      params,
    });
  }

  create(value: CreateCategoryFormValue): Observable<Result<boolean>> {
    return this.http.post<Result<boolean>>(`${this.baseUrl}/Create`, {
      name: value.name.trim(),
      description: value.description.trim() || null,
      parentCategoryId: value.parentCategoryId || null,
      productIds: value.productIds.length ? value.productIds : null,
      supplierIds: value.supplierIds.length ? value.supplierIds : null,
    });
  }

  update(value: UpdateCategoryFormValue): Observable<Result<boolean>> {
    return this.http.put<Result<boolean>>(`${this.baseUrl}/Update`, {
      id: value.id,
      name: value.name.trim(),
      description: value.description.trim() || null,
      isActive: value.isActive,
      parentCategoryId: value.parentCategoryId || null,
    });
  }

  linkProducts(categoryId: string, productIds: string[]): Observable<Result<boolean>> {
    return this.http.post<Result<boolean>>(`${this.baseUrl}/LinkProducts`, {
      categoryId,
      productIds,
    });
  }

  unlinkProducts(categoryId: string, productIds: string[]): Observable<Result<boolean>> {
    return this.http.post<Result<boolean>>(`${this.baseUrl}/UnlinkProducts`, {
      categoryId,
      productIds,
    });
  }

  linkSuppliers(categoryId: string, supplierIds: string[]): Observable<Result<boolean>> {
    return this.http.post<Result<boolean>>(`${this.baseUrl}/LinkSuppliers`, {
      categoryId,
      supplierIds,
    });
  }

  unlinkSuppliers(categoryId: string, supplierIds: string[]): Observable<Result<boolean>> {
    return this.http.post<Result<boolean>>(`${this.baseUrl}/UnlinkSuppliers`, {
      categoryId,
      supplierIds,
    });
  }

  delete(id: string): Observable<Result<boolean>> {
    return this.http.delete<Result<boolean>>(`${this.baseUrl}/Delete/${id}`);
  }
}

function normalizeCategory(category: CategoryDto): CategoryDto {
  return {
    ...category,
    ancestors: (category.ancestors ?? []).map((item) => normalizeCategory(item)),
    children: (category.children ?? []).map((item) => normalizeCategory(item)),
  };
}
