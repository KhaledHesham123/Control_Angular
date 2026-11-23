import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { Result } from '../core/api.model';
import {
  ConfirmRfqRequestCommand,
  CreateRfqRequestCommand,
  ReviewRfqRequestCommand,
  GenerateEmailContentForSuppliersCommand,
  GeneratedRfqRequestContent,
  PrepareAllSuppliersRfqEmailDto,
  PrepareSupplierRfqEmailCommand,
  SendSupplierRfqEmailsCommand,
  SendSupplierRfqEmailsResultDto,
  RfqRequest,
  RfqRequestConfirmDto,
  RfqRequestForEmailDto,
  RfqRequestListItemDto,
  RfqRequestStatus,
} from './rfq.model';

@Injectable({ providedIn: 'root' })
export class RfqRequestService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/RfqRequests`;
  private readonly emailUrl = `${API_BASE_URL}/RfqEmails`;

  getAll(options?: {
    status?: RfqRequestStatus | null;
    categoryId?: string | null;
    vesselId?: string | null;
  }): Observable<Result<RfqRequestListItemDto[]>> {
    let params = new HttpParams();
    if (options?.status != null) {
      params = params.set('Status', options.status);
    }
    if (options?.categoryId) {
      params = params.set('CategoryId', options.categoryId);
    }
    if (options?.vesselId) {
      params = params.set('VesselId', options.vesselId);
    }
    return this.http.get<Result<RfqRequestListItemDto[]>>(`${this.baseUrl}/GetAll`, { params });
  }

  create(command: CreateRfqRequestCommand): Observable<Result<boolean>> {
    return this.http.post<Result<boolean>>(`${this.baseUrl}/Create`, command);
  }

  getById(id: string): Observable<Result<RfqRequest>> {
    const params = new HttpParams().set('Id', id);
    return this.http.get<Result<RfqRequest>>(`${this.baseUrl}/GetById`, { params });
  }

  getForConfirm(id: string): Observable<Result<RfqRequestConfirmDto>> {
    const params = new HttpParams().set('Id', id);
    return this.http.get<Result<RfqRequestConfirmDto>>(`${this.baseUrl}/GetByIdForConfirm`, {
      params,
    });
  }

  getForEmail(id: string): Observable<Result<RfqRequestForEmailDto>> {
    const params = new HttpParams().set('Id', id);
    return this.http.get<Result<RfqRequestForEmailDto>>(`${this.baseUrl}/GetForEmail`, { params });
  }

  confirm(command: ConfirmRfqRequestCommand): Observable<Result<boolean>> {
    return this.http.put<Result<boolean>>(`${this.baseUrl}/Confirm`, command);
  }

  review(command: ReviewRfqRequestCommand): Observable<Result<boolean>> {
    return this.http.put<Result<boolean>>(`${this.baseUrl}/Review`, command);
  }

  prepareSupplierEmails(
    command: PrepareSupplierRfqEmailCommand,
  ): Observable<Result<PrepareAllSuppliersRfqEmailDto>> {
    return this.http.post<Result<PrepareAllSuppliersRfqEmailDto>>(`${this.emailUrl}/Prepare`, command);
  }

  sendSupplierEmails(
    command: SendSupplierRfqEmailsCommand,
  ): Observable<Result<SendSupplierRfqEmailsResultDto>> {
    return this.http.post<Result<SendSupplierRfqEmailsResultDto>>(`${this.emailUrl}/Send`, command);
  }

  generateEmailContentForSuppliers(
    command: GenerateEmailContentForSuppliersCommand,
  ): Observable<Result<GeneratedRfqRequestContent>> {
    return this.http.post<Result<GeneratedRfqRequestContent>>(
      `${this.baseUrl}/GenerateEmailContentForSuppliers`,
      command,
    );
  }

  generateProvisionPdf(id: string): Observable<Result<boolean>> {
    const params = new HttpParams().set('id', id);
    return this.http.post<Result<boolean>>(`${this.baseUrl}/GenerateProvisionPdf`, null, { params });
  }

  getProvisionPdf(id: string): Observable<Result<string>> {
    const params = new HttpParams().set('id', id);
    return this.http.get<Result<string>>(`${this.baseUrl}/GetProvisionPdfByRfqId`, { params });
  }
}
