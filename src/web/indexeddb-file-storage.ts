import { IndexedDbConfig } from '../definitions';

/**
 * Simple IndexedDB Key-Value Storage
 *
 * IndexedDB, as a transactional database, has a somewhat clunky API.
 * This service provides a localStorage-like interface for IndexedDB, wrapped in promises.
 *
 * localStorage has a very low storage limit (5MB), so during development it may not be
 * sufficient to store all the data required for the app to function properly.
 */

export class IndexedDbFileStorage<T extends { path: string }> {

  private config: IndexedDbConfig = {
    dbName: 'Disc',
    version: 1,
    storeName: 'FileStorage',
  };

  async setItem(data: T): Promise<void> {
    const db = await this.openDB();
    const tx = db.transaction(this.config.storeName, 'readwrite');
    const store = tx.objectStore(this.config.storeName);
    const request = store.put(data);
    await this.handleDBRequest(request, db);
  }

  async getItem(path: string): Promise<T | null> {
    const db = await this.openDB();
    const tx = db.transaction(this.config.storeName, 'readonly');
    const store = tx.objectStore(this.config.storeName);
    const request = store.get(path);
    const result = await this.handleDBRequest(request, db);
    if (result === undefined) {
      return null;
    }
    return result as T;
  }

  async removeItem(path: string): Promise<void> {
    const db = await this.openDB();
    const tx = db.transaction(this.config.storeName, 'readwrite');
    const store = tx.objectStore(this.config.storeName);

    const request = store.delete(path);
    await this.handleDBRequest(request, db);
  }

  updateIndexedDbConfig(config: Partial<IndexedDbConfig>) {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.config.storeName)) {
          db.createObjectStore(this.config.storeName, { keyPath: 'path' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Handle database request promise with proper cleanup
   * @param request The database request to handle
   * @param db The database instance to close
   */
  private handleDBRequest<T>(request: IDBRequest<T>, db: IDBDatabase): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  }
}
