import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { Result } from '../core/api.model';
import { UserLookupDto } from './vessel.model';

@Injectable({ providedIn: 'root' })
export class UserLookupService {
  private readonly http = inject(HttpClient);

  /**
   * Flag=true  => users linked to the vessel
   * Flag=false => users not linked to the vessel
   */
  lookup(vesselId: string, flag: boolean): Observable<Result<UserLookupDto[]>> {
    const params = new HttpParams().set('VesselId', vesselId).set('Flag', flag);
    return this.http.get<Result<UserLookupDto[]>>(`${API_BASE_URL}/Users/Lookup`, { params });
  }
}
