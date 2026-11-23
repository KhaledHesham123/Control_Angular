import { Injectable } from '@angular/core';

/**
 * تخزين ملفات الشهادات (PDF / صور) في IndexedDB على الجهاز.
 * الـ localStorage صغير (≈5MB) وما ينفعش للملفات؛ لما الباك إند يجهز يتبدّل التخزين ده برفع حقيقي.
 */
@Injectable({ providedIn: 'root' })
export class ShipFiles {
  private static readonly DB = 'ships-control.files';
  private static readonly STORE = 'certs';
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('التخزين المحلي للملفات غير متاح في المتصفح ده.'));
        return;
      }
      const req = indexedDB.open(ShipFiles.DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(ShipFiles.STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('تعذّر فتح مخزن الملفات.'));
    });
    return this.db;
  }

  private async run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(ShipFiles.STORE, mode);
      const req = fn(tx.objectStore(ShipFiles.STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error('فشلت عملية الملف.'));
      tx.onabort = () => reject(tx.error ?? new Error('فشلت عملية الملف.'));
    });
  }

  put(key: string, blob: Blob): Promise<IDBValidKey> {
    return this.run('readwrite', (s) => s.put(blob, key));
  }

  async get(key: string): Promise<Blob | null> {
    const found = await this.run<Blob | undefined>('readonly', (s) => s.get(key));
    return found ?? null;
  }

  async delete(key: string): Promise<void> {
    await this.run('readwrite', (s) => s.delete(key));
  }

  async clear(): Promise<void> {
    await this.run('readwrite', (s) => s.clear());
  }
}
