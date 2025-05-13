import { Base64 } from './base64.utils';
import { IndexedDBStorage } from './indexeddb-storage';

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

  private static instance: FileSystemMock;
  static getInstance() {
    if (!FileSystemMock.instance) {
      FileSystemMock.instance = new FileSystemMock();
    }
    return FileSystemMock.instance;
  }

  // returns content
  async read(path: string, offset?: number, count?: number): Promise<Uint8Array> {
    await this.ensureFSLoaded();
    path = this.removeExtraSlashes(path);

    const foundFile = this.mockedFS.files.find((i) => i.path === path);
    if (!foundFile) {
      throw new Error('FileSystemMock: File not found');
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
    await this.ensureFSLoaded();
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

  async remove(path: string) {
    await this.ensureFSLoaded();
    path = this.removeExtraSlashes(path);

    const foundIndex = this.mockedFS.files.findIndex((i) => i.path === path);
    // do not remove predefined file
    if (foundIndex > -1 && foundIndex !== 0) {
      this.mockedFS.files.splice(foundIndex, 1);
    }
    await this.saveMockedFS();
  }

  private async ensureFSLoaded() {
    if (!this.mockedFS) {
      await this.readMockedFS();
    }
  }

  private async readMockedFS() {
    const savedFS = await this.indexedStorage.getItem(fileSystemKey);
    this.mockedFS = savedFS ?? { files: [] as FileMockInterface[] } as MockedFS;
  }

  private async saveMockedFS() {
    try {
      await this.indexedStorage.setItem(fileSystemKey, this.mockedFS);
    } catch (error) {
      console.error('[FileSystemMock]', error);
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
