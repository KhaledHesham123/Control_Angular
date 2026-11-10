import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { Result } from '../core/api.model';
import { CategoryDto, CategoryLookupDto } from './product.model';

@Injectable({ providedIn: 'root' })
export class CategoryCatalogService {
  private readonly http = inject(HttpClient);

  /** Category lookup from Categories/Lookup — IncludeInactive is always false. */
  lookup(): Observable<Result<CategoryLookupDto[]>> {
    const params = new HttpParams().set('IncludeInactive', false);
    return this.http.get<Result<CategoryLookupDto[]>>(`${API_BASE_URL}/Categories/Lookup`, {
      params,
    });
  }

  getAll(includeInactive = false): Observable<Result<CategoryDto[]>> {
    const params = new HttpParams().set('IncludeInactive', includeInactive);
    return this.http.get<Result<CategoryDto[]>>(`${API_BASE_URL}/Categories/GetAll`, { params });
  }
}
