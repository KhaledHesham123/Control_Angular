import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { Result } from '../core/api.model';
import { VesselDto } from './product.model';

@Injectable({ providedIn: 'root' })
export class VesselService {
  private readonly http = inject(HttpClient);

  getAll(includeInactive = false): Observable<Result<VesselDto[]>> {
    const params = new HttpParams().set('IncludeInactive', includeInactive);
    return this.http.get<Result<VesselDto[]>>(`${API_BASE_URL}/Vessels/GetAll`, { params });
  }

  /**
   * Flag=false => vessels NOT linked to the product.
   * Requires an existing ProductId (use after create/update flows).
   */
  lookup(productId: string, flag: boolean): Observable<Result<VesselDto[]>> {
    const params = new HttpParams()
      .set('ProductId', productId)
      .set('Flag', flag);
    return this.http.get<Result<VesselDto[]>>(`${API_BASE_URL}/Vessels/Lookup`, { params });
  }
}
