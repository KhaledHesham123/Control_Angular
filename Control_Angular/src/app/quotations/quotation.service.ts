import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { Result } from '../core/api.model';
import {
  PaginationResponse,
  QuotationListItem,
  QuotationQuery,
} from './quotation.model';

const QUOTATIONS_URL = `${API_BASE_URL}/Quotations/GetAll`;

@Injectable({ providedIn: 'root' })
export class QuotationService {
  private readonly http = inject(HttpClient);

  getAll(query: QuotationQuery): Observable<Result<PaginationResponse<QuotationListItem>>> {
    let params = new HttpParams()
      .set('PageNumber', query.pageNumber)
      .set('PageSize', query.pageSize);

    const term = query.searchTerm?.trim();
    if (term) {
      params = params.set('SearchTerm', term);
    }

    return this.http.get<Result<PaginationResponse<QuotationListItem>>>(QUOTATIONS_URL, { params });
  }
}
