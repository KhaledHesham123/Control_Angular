import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PaginationResponse,
  QuotationListItem,
  QuotationQuery,
  Result,
} from './quotation.model';

const QUOTATIONS_URL = 'https://shipscontrol.runasp.net/api/Quotations/GetAll';

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
