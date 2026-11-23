import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { Result } from '../core/api.model';

export interface SupplierCategoryLink {
  id: string;
  categoryId: string;
  name: string;
  parentName: string | null;
}

export interface SupplierBoardItem {
  id: string;
  companyName: string;
  primaryEmail: string | null;
  phone: string | null;
  country: string | null;
  contactPerson: string | null;
  isActive: boolean;
  categories: SupplierCategoryLink[];
}

export interface CreateSupplierCommand {
  companyName: string;
  primaryEmail?: string | null;
  phone?: string | null;
  country?: string | null;
  contactPerson?: string | null;
  notes?: string | null;
  categoryId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class SupplierBoardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/Suppliers`;

  board(searchTerm?: string): Observable<Result<SupplierBoardItem[]>> {
    let params = new HttpParams();
    if (searchTerm?.trim()) {
      params = params.set('SearchTerm', searchTerm.trim());
    }
    return this.http.get<Result<SupplierBoardItem[]>>(`${this.baseUrl}/Board`, { params });
  }

  create(command: CreateSupplierCommand): Observable<Result<string>> {
    return this.http.post<Result<string>>(`${this.baseUrl}/Create`, command);
  }

  link(supplierId: string, categoryId: string): Observable<Result<boolean>> {
    return this.http.post<Result<boolean>>(`${this.baseUrl}/LinkCategory`, { supplierId, categoryId });
  }

  unlink(supplierId: string, categoryId: string): Observable<Result<boolean>> {
    const params = new HttpParams().set('supplierId', supplierId).set('categoryId', categoryId);
    return this.http.delete<Result<boolean>>(`${this.baseUrl}/UnlinkCategory`, { params });
  }
}
