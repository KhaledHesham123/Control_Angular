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

  /** نسخة موقعة تفضل على الجهاز حتى لو رفعها الخادم رفضها. */
  putLocal(key: string, blob: Blob): Promise<void> {
    return this.local(key, 'put', blob).then(() => undefined);
  }

  getLocal(key: string): Promise<Blob | null> {
    return this.local(key, 'get').then((value) => value ?? null);
  }

  deleteLocal(key: string): Promise<void> {
    return this.local(key, 'delete').then(() => undefined);
  }

  private local(key: string, action: 'put' | 'get' | 'delete', blob?: Blob): Promise<Blob | null> {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('ship-signed', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('files');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('files', action === 'get' ? 'readonly' : 'readwrite');
        const store = tx.objectStore('files');
        const req = action === 'put' ? store.put(blob, key) : action === 'delete' ? store.delete(key) : store.get(key);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(action === 'get' ? ((req.result as Blob | undefined) ?? null) : null);
      };
    });
  }
}
