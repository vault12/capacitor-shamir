import { WebPlugin } from '@capacitor/core';
import { FileSystemMock } from './web/file-system.mock';
import { join, restorePart, split } from './web/scheme';
import { Parts } from './web/GF256';
import { ShamirPlugin } from './definitions';
import { fromBase64, toBase64 } from './web/base64.utils';

export class ShamirWeb extends WebPlugin implements ShamirPlugin {
  private fs = FileSystemMock.getInstance();

  generateShards(
    { totalShards, threshold, inputDataBase64 }: { totalShards: number; threshold: number; inputDataBase64: string; },
    callback: (data: { progress: number, shardsBase64?: string[] }, error?: string) => void
  ): Promise<void> {
    const randomBytes = (len: number) => crypto.getRandomValues(new Uint8Array(len));
    const parts = split(
      randomBytes,
      totalShards,
      threshold,
      fromBase64(inputDataBase64),
    );
    const shards: Uint8Array[] = Object.entries(parts).map(([shardIdx, shardData]: [string, Uint8Array]) => {
      const shardIdxBytes = new Uint8Array([parseInt(shardIdx)])
      const shardBytes = new Uint8Array(1 + shardData.length);
      shardBytes.set(shardIdxBytes);
      shardBytes.set(shardData, shardIdxBytes.length);
      return shardBytes;
    });
    callback({ progress: 100, shardsBase64: shards.map(shard => toBase64(shard)) });
    return Promise.resolve();
  }

  restoreFromShards(
    { inputShardsBase64 }: { inputShardsBase64: string[]; },
    callback: (data: { progress: number, dataBase64?: string }, error?: string) => void
  ): Promise<void> {
    const inputShards = inputShardsBase64.map(shardBase64 => fromBase64(shardBase64));
    const parts = inputShards.reduce((acc, shardBytes) => {
      const shardIdx = shardBytes.subarray(0, 1)[0];
      const shardData = shardBytes.subarray(1);
      acc[shardIdx] = shardData;
      return acc;
    }, {} as Parts);
    const result = join(parts);
    callback({ progress: 100, dataBase64: toBase64(result) });
    return Promise.resolve();
  }

  restoreShard(
    { shardIndex, inputShardsBase64 }: { shardIndex: number; inputShardsBase64: string[]; },
    callback: (data: { progress: number, dataBase64?: string }, error?: string) => void
  ): Promise<void> {
    const inputShards = inputShardsBase64.map(shardBase64 => fromBase64(shardBase64));
    const parts = inputShards.reduce((acc, shardBytes) => {
      const shardIdx = shardBytes.subarray(0, 1)[0];
      const shardData = shardBytes.subarray(1);
      acc[shardIdx] = shardData;
      return acc;
    }, {} as Parts);
    const restoredPart = restorePart(parts, shardIndex);
    const restoredShard = new Uint8Array(1 + restoredPart.length);
    const shardIdxBytes = new Uint8Array([shardIndex]);
    restoredShard.set(shardIdxBytes);
    restoredShard.set(restoredPart, shardIdxBytes.length);
    callback({ progress: 100, dataBase64: toBase64(restoredShard) });
    return Promise.resolve();
  }

  async generateFileShards(
    { totalShards, threshold, srcPath, dstPathRoot }: { totalShards: number; threshold: number; srcPath: string; dstPathRoot: string; },
    callback: (data: { progress: number, shardsPaths?: string[] }, error?: string) => void
  ): Promise<void> {
    const inputData = await this.fs.read(srcPath);
    const inputDataBase64 = toBase64(inputData);
    await this.generateShardsToFiles({ totalShards, threshold, inputDataBase64, dstPathRoot }, callback);
    return Promise.resolve();
  }

  async generateShardsToFiles(
    { totalShards, threshold, inputDataBase64, dstPathRoot }: { totalShards: number; threshold: number; inputDataBase64: string; dstPathRoot: string; },
    callback: (data?: { progress: number; shardsPaths?: string[]; }, error?: any) => void
  ): Promise<void> {
    await new Promise<void>(async (resolve, reject) => {
      this.generateShards({ totalShards, threshold, inputDataBase64 }, async ({ progress, shardsBase64 }, error) => {
        if (error) {
          reject(error);
        } else {
          const shards = shardsBase64.map(shardBase64 => fromBase64(shardBase64));
          const id = this.generateJobId();
          const shardsPaths: string[] = [];
          for (let i = 0; i < shards.length; i++) {
            const path = this.formatShardPath(dstPathRoot, id, i);
            shardsPaths.push(path);
            await this.fs.write(path, shards[i]);
          }
          callback({ progress, shardsPaths });
          resolve();
        }
      });
    });
    return Promise.resolve();
  }

  async restoreFromFileShards(
    { shardsPaths, dstPath }: { shardsPaths: string[]; dstPath: string; },
    callback: (data: { progress: number, dstPath?: string }, error?: string) => void
  ): Promise<void> {
    await new Promise<void>(async (resolve, reject) => {
      this.restoreFromFileShardsToData({ shardsPaths }, async ({ progress, dataBase64 }, error) => {
        if (error) {
          reject(error);
        } else {
          await this.fs.write(dstPath, fromBase64(dataBase64));
          callback({ progress, dstPath });
          resolve();
        }
      });
    });
    return Promise.resolve();
  }

  async restoreFromFileShardsToData(
    { shardsPaths }: { shardsPaths: string[]; },
    callback: (data: { progress: number, dataBase64?: string }, error?: string) => void
  ): Promise<void> {
    const shardsBase64: string[] = [];
    for (const path of shardsPaths) {
      const data = await this.fs.read(path);
      shardsBase64.push(toBase64(data));
    }
    await new Promise<void>(async (resolve, reject) => {
      await this.restoreFromShards({ inputShardsBase64: shardsBase64 }, async ({ progress, dataBase64 }, error) => {
        if (error) {
          reject(error);
        } else {
          callback({ progress, dataBase64 });
          resolve();
        }
      });
    })
    return Promise.resolve();
  }

  async restoreFileShard(
    { shardIndex, shardsPaths, dstPathRoot }: { shardIndex: number; shardsPaths: string[]; dstPathRoot: string; },
    callback: (data: { progress: number, shardPath?: string }, error?: string) => void
  ): Promise<void> {
    const shardsBase64: string[] = [];
    for (const shardPath of shardsPaths) {
      const data = await this.fs.read(shardPath);
      shardsBase64.push(toBase64(data));
    }
    await new Promise<void>(async (resolve, reject) => {
      this.restoreShard({ shardIndex, inputShardsBase64: shardsBase64 }, async ({ progress, dataBase64 }, error) => {
        if (error) {
          reject(error);
        } else {
          const id = this.generateJobId();
          const shardPath = this.formatShardPath(dstPathRoot, id, shardIndex);
          await this.fs.write(shardPath, fromBase64(dataBase64));
          callback({ progress, shardPath });
          resolve();
        }
      });
    });
    return Promise.resolve();
  }

  private formatShardPath(dirPath: string, id: string, index: number) {
    return `${dirPath}/${id}_${index}.bin`;
  }

  private generateJobId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}