import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { Result } from '../core/api.model';
import {
  CreateVesselFormValue,
  UpdateVesselFormValue,
  VesselDetailsDto,
  VesselListDto,
} from './vessel.model';

@Injectable({ providedIn: 'root' })
export class VesselsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/Vessels`;

  getAll(includeInactive = false): Observable<Result<VesselListDto[]>> {
    const params = new HttpParams().set('IncludeInactive', includeInactive);
    return this.http.get<Result<VesselListDto[]>>(`${this.baseUrl}/GetAll`, { params });
  }

  getById(id: string): Observable<Result<VesselDetailsDto>> {
    const params = new HttpParams().set('Id', id);
    return this.http.get<Result<VesselDetailsDto>>(`${this.baseUrl}/GetById`, { params });
  }

  create(value: CreateVesselFormValue): Observable<Result<boolean>> {
    return this.http.post<Result<boolean>>(`${this.baseUrl}/Create`, {
      name: value.name.trim(),
      imoNumber: value.imoNumber.trim() || null,
      flag: value.flag.trim() || null,
      notes: value.notes.trim() || null,
      userIds: value.userIds,
    });
  }

  update(value: UpdateVesselFormValue): Observable<Result<boolean>> {
    return this.http.put<Result<boolean>>(`${this.baseUrl}/Update`, {
      id: value.id,
      name: value.name.trim(),
      imoNumber: value.imoNumber.trim() || null,
      flag: value.flag.trim() || null,
      notes: value.notes.trim() || null,
      isActive: value.isActive,
    });
  }

  delete(id: string): Observable<Result<boolean>> {
    const params = new HttpParams().set('Id', id);
    return this.http.delete<Result<boolean>>(`${this.baseUrl}/Delete`, { params });
  }

  linkUsers(vesselId: string, userIds: string[]): Observable<Result<boolean>> {
    return this.http.post<Result<boolean>>(`${this.baseUrl}/LinkUsers`, {
      vesselId,
      userIds,
    });
  }

  unlinkUsers(vesselId: string, userIds: string[]): Observable<Result<boolean>> {
    return this.http.post<Result<boolean>>(`${this.baseUrl}/UnlinkUsers`, {
      vesselId,
      userIds,
    });
  }
}
