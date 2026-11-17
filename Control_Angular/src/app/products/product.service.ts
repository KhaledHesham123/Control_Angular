import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { Result } from '../core/api.model';
import {
  CreateProductFormValue,
  ProductDto,
  ProductListDto,
  ProductScope,
  UpdateProductFormValue,
} from './product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/Products`;

  getAll(options?: {
    categoryId?: string | null;
    search?: string | null;
    includeInactive?: boolean;
  }): Observable<Result<ProductListDto[]>> {
    let params = new HttpParams().set('IncludeInactive', options?.includeInactive ?? false);
    if (options?.categoryId) {
      params = params.set('CategoryId', options.categoryId);
    }
    if (options?.search?.trim()) {
      params = params.set('Search', options.search.trim());
    }
    return this.http.get<Result<ProductListDto[]>>(`${this.baseUrl}/GetAll`, { params });
  }

  getById(id: string): Observable<Result<ProductDto>> {
    const params = new HttpParams().set('Id', id);
    return this.http.get<Result<ProductDto>>(`${this.baseUrl}/GetById`, { params });
  }

  getByCategory(categoryId: string, includeInactive = false): Observable<Result<ProductDto[]>> {
    const params = new HttpParams()
      .set('CategoryId', categoryId)
      .set('IncludeInactive', includeInactive);
    return this.http.get<Result<ProductDto[]>>(`${this.baseUrl}/ByCategory`, { params });
  }

  create(value: CreateProductFormValue): Observable<Result<boolean>> {
    const form = new FormData();
    form.append('Scope', String(value.scope));
    form.append('CategoryId', value.categoryId);
    form.append('Name', value.name.trim());
    form.append('DefaultUnit', value.defaultUnit.trim());
    form.append('QuantityOnHand', String(value.quantityOnHand ?? 0));

    if (value.code.trim()) {
      form.append('Code', value.code.trim());
    }

    if (value.description.trim()) {
      form.append('Description', value.description.trim());
    }

    this.appendShelfLife(form, value.shelfLifeValue, value.shelfLifeUnit);

    if (value.scope === ProductScope.VesselSpecific) {
      for (const vesselId of value.vesselIds) {
        form.append('VesselIds', vesselId);
      }
    }

    if (value.image) {
      form.append('Image', value.image, value.image.name);
    }

    return this.http.post<Result<boolean>>(`${this.baseUrl}/Create`, form);
  }

  update(value: UpdateProductFormValue): Observable<Result<boolean>> {
    const form = new FormData();
    form.append('Id', value.id);
    form.append('Name', value.name.trim());
    form.append('DefaultUnit', value.defaultUnit.trim());
    form.append('Scope', String(value.scope));
    form.append('IsActive', String(value.isActive));

    if (value.code.trim()) {
      form.append('Code', value.code.trim());
    }

    if (value.description.trim()) {
      form.append('Description', value.description.trim());
    }

    this.appendShelfLife(form, value.shelfLifeValue, value.shelfLifeUnit);

    if (value.image) {
      form.append('Image', value.image, value.image.name);
    }

    return this.http.put<Result<boolean>>(`${this.baseUrl}/Update`, form);
  }

  private appendShelfLife(
    form: FormData,
    value: number | null | undefined,
    unit: number | null | undefined,
  ): void {
    if (value != null && value > 0) {
      form.append('ShelfLifeValue', String(value));
    }
    if (unit != null) {
      form.append('ShelfLifeUnit', String(unit));
    }
  }

  delete(id: string): Observable<Result<boolean>> {
    const params = new HttpParams().set('Id', id);
    return this.http.delete<Result<boolean>>(`${this.baseUrl}/Delete`, { params });
  }

  linkVessel(productId: string, vesselIds: string[], quantityOnHand: number): Observable<Result<boolean>> {
    return this.http.post<Result<boolean>>(`${this.baseUrl}/LinkVessel`, {
      productId,
      vesselIds,
      quantityOnHand,
    });
  }

  unlinkVessel(productId: string, vesselIds: string[]): Observable<Result<boolean>> {
    return this.http.post<Result<boolean>>(`${this.baseUrl}/UnlinkVessel`, {
      productId,
      vesselIds,
    });
  }
}
