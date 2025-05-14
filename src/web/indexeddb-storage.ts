export const dbName = 'MockDb';
export const storeName = 'MockStore';
export const VERSION: number = 1 as const;

/**
 * simple indexedDB key-value storage.
 *
 * indexedDB, as transactional db, has bit clunky API,
 * this service implements localStorage-like API for iDB, but wrapped in promises
 *
 * localstorage has very low storage limit (5MB)
 * so for development it's sometimes not enough space to save
 * all the required data for the app to work properly
 *
 */

export class IndexedDBStorage {
  async setItem<T>(key: string, data: T): Promise<void> {
    const db = await this.openDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    const request = store.put(data, key);

    await this.handleDBRequest(request, db);
  }

  async getItem<T = any>(key: string): Promise<T | null> {
    const db = await this.openDB();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);

    const request = store.get(key);
    const result = await this.handleDBRequest(request, db);

    if (result === undefined) {
      return null;
    }
    return result as T;
  }

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
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
