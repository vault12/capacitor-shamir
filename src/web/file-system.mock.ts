import { IndexedDbConfig } from '../definitions';
import { Base64, fromBase64, toBase64 } from './base64.utils';
import { IndexedDbFileStorage } from './indexeddb-file-storage';

interface FileMockInterface {
  path: string;
  content: Base64;
  mtime: number;
}

export class FileSystemMock {
  private indexedStorage: IndexedDbFileStorage<FileMockInterface> = new IndexedDbFileStorage<FileMockInterface>();

  private static instance: FileSystemMock;
  static getInstance() {
    if (!FileSystemMock.instance) {
      FileSystemMock.instance = new FileSystemMock();
    }
    return FileSystemMock.instance;
  }

  async read(path: string, offset?: number, count?: number): Promise<Uint8Array> {
    path = this.removeExtraSlashes(path);
    const foundFile = await this.indexedStorage.getItem(path);
    if (!foundFile) {
      throw new Error('[FilesystemMock] File not found');
    }
    let content = fromBase64(foundFile.content);
    // cut everything up to offset
    if (offset) {
      content = content.slice(offset);
    }
    // cut everything after count
    if (count) {
      content = content.slice(undefined, count);
    }
    return content;
  }

  async write(path: string, data: Uint8Array, append?: boolean) {
    path = this.removeExtraSlashes(path);
    let file = await this.indexedStorage.getItem(path);
    if (file) {
      if (append) {
        const currentData = fromBase64(file.content);
        const appended = new Uint8Array(currentData.length + data.length);
        appended.set(currentData);
        appended.set(data, currentData.length);
        file.content = toBase64(appended);
      } else {
        file.content = toBase64(data);
      }
    } else {
      file = {
        path: path,
        mtime: new Date().getTime(),
        content: toBase64(data),
      };
    }
    await this.indexedStorage.setItem(file);
  }

  async remove(path: string) {
    path = this.removeExtraSlashes(path);
    await this.indexedStorage.removeItem(path);
  }

  updateIndexedDbConfig(config: Partial<IndexedDbConfig>) {
    this.indexedStorage.updateIndexedDbConfig(config);
  }

  private removeExtraSlashes(path: string) {
    return path.replace(new RegExp('/{2,}', 'g'), '/');
  }
}
