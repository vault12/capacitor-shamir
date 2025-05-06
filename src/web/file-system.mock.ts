import { Base64 } from './base64.utils';
import { IndexedDBStorage } from './indexeddb-storage';
import { deferredPromise } from './promise.helper';

interface FileMockInterface {
  path: string;
  content: Base64;
  mtime: number;
}

interface MockedFS {
  files: Array<FileMockInterface>;
}

const fileSystemKey = 'mockedFS';

export class FileSystemMock {
  // mock file system as an array of files
  private mockedFS: MockedFS;

  private indexedStorage: IndexedDBStorage = new IndexedDBStorage();
  private ready = deferredPromise();

  private constructor() {
    this.readMockedFS().then(this.ready.resolve);
  }
  private static instance: FileSystemMock;
  static getInstance() {
    if (!FileSystemMock.instance) {
      FileSystemMock.instance = new FileSystemMock();
    }
    return FileSystemMock.instance;
  }

  // returns content
  async read(path: string, offset?: number, count?: number): Promise<Uint8Array> {
    await this.ready;
    path = this.removeExtraSlashes(path);

    const foundFile = this.mockedFS.files.find((i) => i.path === path);
    if (!foundFile) {
      throw new Error('V12File.mock: File not found');
    }
    let content = foundFile.content.fromBase64();
    // cut everything up to offset
    if (offset) {
      content = content.slice(offset);
    }
    // cut everything after count
    if (count) {
      content = content.slice(undefined, count);
    }
    return new Uint8Array(content);
  }

  async write(path: string, data: Uint8Array, append?: boolean) {
    await this.ready;
    path = this.removeExtraSlashes(path);

    const foundFile = this.mockedFS.files.find((i) => i.path === path);
    if (foundFile) {
      if (append) {
        const currentData = foundFile.content.fromBase64();
        const appended = new Uint8Array(currentData.length + data.length);
        appended.set(currentData);
        appended.set(data, currentData.length);
        foundFile.content = appended.toBase64();
      } else {
        foundFile.content = data.toBase64();
      }
    } else {
      this.mockedFS.files.push({
        path: path,
        mtime: new Date().getTime(),
        content: data.toBase64(),
      });
    }
    await this.saveMockedFS();
  }

  private async readMockedFS() {
    const savedFS = await this.indexedStorage.getItem(fileSystemKey);
    this.mockedFS = savedFS ?? [] as FileMockInterface[];
  }

  private async saveMockedFS() {
    try {
      await this.indexedStorage.setItem(fileSystemKey, this.mockedFS);
    } catch (error) {
      console.error('[V12FileMock]', error);
      if ((error as DOMException).message.includes('exceeded the quota')) {
        throw new Error('NotEnoughDiskSpace');
      }
      throw error;
    }
  }

  private removeExtraSlashes(path: string) {
    return path.replace(new RegExp('/{2,}', 'g'), '/');
  }
}
