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

export class IndexedDBStorage {
  private config: IndexedDbConfig = {
    dbName: 'MockDb',
    version: 1,
    storeName: 'MockStore',
  };

  async setItem<T>(key: string, data: T): Promise<void> {
    const db = await this.openDB();
    const tx = db.transaction(this.config.storeName, 'readwrite');
    const store = tx.objectStore(this.config.storeName);

    const request = store.put(data, key);

    await this.handleDBRequest(request, db);
  }

  async getItem<T = unknown>(key: string): Promise<T | null> {
    const db = await this.openDB();
    const tx = db.transaction(this.config.storeName, 'readonly');
    const store = tx.objectStore(this.config.storeName);

    const request = store.get(key);
    const result = await this.handleDBRequest(request, db);

    if (result === undefined) {
      return null;
    }
    return result as T;
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
          db.createObjectStore(this.config.storeName);
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
