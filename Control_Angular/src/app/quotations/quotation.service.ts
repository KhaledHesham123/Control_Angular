import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { Result } from '../core/api.model';
import {
  OfferComparison,
  PaginationResponse,
  QuotationListItem,
  QuotationQuery,
  SaveOfferCommand,
  ReceiveLineInput,
} from './quotation.model';

const QUOTATIONS_URL = `${API_BASE_URL}/Quotations`;

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

    return this.http.get<Result<PaginationResponse<QuotationListItem>>>(`${QUOTATIONS_URL}/GetAll`, {
      params,
    });
  }

  comparison(rfqRequestId: string): Observable<Result<OfferComparison>> {
    const params = new HttpParams().set('rfqRequestId', rfqRequestId);
    return this.http.get<Result<OfferComparison>>(`${QUOTATIONS_URL}/Comparison`, { params });
  }

  saveOffer(command: SaveOfferCommand): Observable<Result<string>> {
    return this.http.post<Result<string>>(`${QUOTATIONS_URL}/Save`, command);
  }

  deleteOffer(id: string): Observable<Result<boolean>> {
    const params = new HttpParams().set('id', id);
    return this.http.delete<Result<boolean>>(`${QUOTATIONS_URL}/Delete`, { params });
  }

  approveOffer(command: {
    rfqRequestId: string;
    quotationId: string;
    deliveryDate: string;
  }): Observable<Result<boolean>> {
    return this.http.put<Result<boolean>>(`${QUOTATIONS_URL}/Approve`, command);
  }

  receive(command: { id: string; items: ReceiveLineInput[] }): Observable<Result<boolean>> {
    return this.http.post<Result<boolean>>(`${QUOTATIONS_URL}/Receive`, command);
  }
}
