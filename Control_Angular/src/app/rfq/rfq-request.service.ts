import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { Result } from '../core/api.model';
import {
  CreateRfqRequestCommand,
  GenerateRfqRequestContentCommand,
  GeneratedRfqRequestContent,
  RfqRequest,
} from './rfq.model';

@Injectable({ providedIn: 'root' })
export class RfqRequestService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/RfqRequests`;

  create(command: CreateRfqRequestCommand): Observable<Result<string>> {
    return this.http.post<Result<string>>(`${this.baseUrl}/Create`, command);
  }

  getById(id: string): Observable<Result<RfqRequest>> {
    const params = new HttpParams().set('Id', id);
    return this.http.get<Result<RfqRequest>>(`${this.baseUrl}/GetById`, { params });
  }

  generateContent(
    command: GenerateRfqRequestContentCommand,
  ): Observable<Result<GeneratedRfqRequestContent>> {
    return this.http.post<Result<GeneratedRfqRequestContent>>(
      `${this.baseUrl}/GenerateContent`,
      command,
    );
  }
}
