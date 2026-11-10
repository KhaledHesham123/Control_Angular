import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { Result } from '../core/api.model';
import { CategoryWithProducts } from './rfq.model';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);

  getWithProducts(includeInactive = false): Observable<Result<CategoryWithProducts[]>> {
    const params = new HttpParams().set('includeInactive', includeInactive);
    return this.http.get<Result<CategoryWithProducts[]>>(
      `${API_BASE_URL}/Categories/WithProducts`,
      { params },
    );
  }
}
