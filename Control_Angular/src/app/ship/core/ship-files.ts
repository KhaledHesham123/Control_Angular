import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/api.config';

/** ملفات شهادات السفينة على الباك إند بدل IndexedDB. */
@Injectable({ providedIn: 'root' })
export class ShipFiles {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/Ship/Files`;

  async put(key: string, blob: Blob): Promise<void> {
    const file = blob instanceof File ? blob : new File([blob], 'certificate');
    const form = new FormData();
    form.append('file', file, file.name);
    await firstValueFrom(this.http.post(`${this.base}/${encodeURIComponent(key)}`, form));
  }

  async get(key: string): Promise<Blob | null> {
    try {
      return await firstValueFrom(this.http.get(`${this.base}/${encodeURIComponent(key)}`, { responseType: 'blob' }));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/${encodeURIComponent(key)}`));
  }

  async clear(): Promise<void> {
    await firstValueFrom(this.http.delete(this.base));
  }
}
