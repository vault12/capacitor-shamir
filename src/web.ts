import { WebPlugin } from '@capacitor/core';
import { FileSystemMock } from './web/file-system.mock';
import { join, restorePart, split } from './web/scheme';
import { Parts } from './web/GF256';
import { IndexedDbConfig, ShamirPlugin } from './definitions';
import { fromBase64, toBase64 } from './web/base64.utils';

export class ShamirWeb extends WebPlugin implements ShamirPlugin {
  private fs = FileSystemMock.getInstance();

  async generateShards(
    { totalShards, threshold, inputDataBase64 }: { totalShards: number; threshold: number; inputDataBase64: string; },
    callback: (data: { progress: number, shardsBase64?: string[] }, error?: Error) => void
  ): Promise<void> {
    let shards: Uint8Array[];
    try {
      const randomBytes = (len: number) => crypto.getRandomValues(new Uint8Array(len));
      const parts = split(
        randomBytes,
        totalShards,
        threshold,
        fromBase64(inputDataBase64),
      );
      shards = Object.entries(parts).map(([shardIdx, shardData]: [string, Uint8Array]) => {
        const shardIdxBytes = new Uint8Array([parseInt(shardIdx)]);
        const shardBytes = new Uint8Array(1 + shardData.length);
        shardBytes.set(shardIdxBytes);
        shardBytes.set(shardData, shardIdxBytes.length);
        return shardBytes;
      });
    } catch (error) {
      callback({ progress: 0 }, error as Error);
      return;
    }
    callback({ progress: 100, shardsBase64: shards.map(shard => toBase64(shard)) });
  }

  async restoreFromShards(
    { inputShardsBase64 }: { inputShardsBase64: string[]; },
    callback: (data: { progress: number, dataBase64?: string }, error?: Error) => void
  ): Promise<void> {
    let result: Uint8Array;
    try {
      const inputShards = inputShardsBase64.map(shardBase64 => fromBase64(shardBase64));
      const inputShardsError = this.findInputShardsError(inputShards);
      if (inputShardsError) {
        callback({ progress: 0 }, inputShardsError);
        return;
      }
      const parts = inputShards.reduce((acc, shardBytes) => {
        const shardIdx = shardBytes.subarray(0, 1)[0];
        const shardData = shardBytes.subarray(1);
        acc[shardIdx] = shardData;
        return acc;
      }, {} as Parts);
      result = join(parts);
    } catch (error) {
      callback({ progress: 0 }, error as Error);
      return;
    }
    callback({ progress: 100, dataBase64: toBase64(result) });
  }

  async restoreShard(
    { shardIndex, inputShardsBase64 }: { shardIndex: number; inputShardsBase64: string[]; },
    callback: (data: { progress: number, dataBase64?: string }, error?: Error) => void
  ): Promise<void> {
    let restoredShard: Uint8Array;
    try {
      const shardIndexError = this.findShardIndexError(shardIndex);
      if (shardIndexError) {
        callback({ progress: 0 }, shardIndexError);
        return;
      }
      const inputShards = inputShardsBase64.map(shardBase64 => fromBase64(shardBase64));
      const inputShardsError = this.findInputShardsError(inputShards);
      if (inputShardsError) {
        callback({ progress: 0 }, inputShardsError);
        return;
      }
      const parts = inputShards.reduce((acc, shardBytes) => {
        const shardIdx = shardBytes.subarray(0, 1)[0];
        const shardData = shardBytes.subarray(1);
        acc[shardIdx] = shardData;
        return acc;
      }, {} as Parts);
      const restoredPart = restorePart(parts, shardIndex);
      restoredShard = new Uint8Array(1 + restoredPart.length);
      const shardIdxBytes = new Uint8Array([shardIndex]);
      restoredShard.set(shardIdxBytes);
      restoredShard.set(restoredPart, shardIdxBytes.length);
    } catch (error) {
      callback({ progress: 0 }, error as Error);
      return;
    }
    callback({ progress: 100, dataBase64: toBase64(restoredShard) });
  }

  async generateFileShards(
    { totalShards, threshold, srcPath, dstPathRoot }: { totalShards: number; threshold: number; srcPath: string; dstPathRoot: string; },
    callback: (data?: { progress: number, shardsPaths?: string[] }, error?: Error) => void
  ): Promise<void> {
    let inputDataBase64: string;
    try {
      inputDataBase64 = toBase64(await this.fs.read(srcPath));
    } catch (error) {
      callback({ progress: 0 }, error as Error);
      return;
    }
    await this.generateShardsToFiles({ totalShards, threshold, inputDataBase64, dstPathRoot }, callback);
  }

  async generateShardsToFiles(
    { totalShards, threshold, inputDataBase64, dstPathRoot }: { totalShards: number; threshold: number; inputDataBase64: string; dstPathRoot: string; },
    callback: (data?: { progress: number; shardsPaths?: string[]; }, error?: Error) => void
  ): Promise<void> {
    try {
      const generated = await new Promise<{ progress: number, shardsBase64: string[] }>((resolve, reject) => {
        this.generateShards({ totalShards, threshold, inputDataBase64 }, ({ progress, shardsBase64 }, error) => {
          if (error) {
            reject(error);
          } else {
            resolve({ progress, shardsBase64: shardsBase64! });
          }
        }).catch(reject);
      });
      const shards = generated.shardsBase64.map(shardBase64 => fromBase64(shardBase64));
      const id = this.generateJobId();
      const shardsPaths: string[] = [];
      for (let i = 0; i < shards.length; i++) {
        const path = this.formatShardPath(dstPathRoot, id, i);
        shardsPaths.push(path);
        await this.fs.write(path, shards[i]);
      }
      callback({ progress: generated.progress, shardsPaths });
    } catch (error) {
      callback({ progress: 0 }, error as Error);
    }
  }

  async restoreFromFileShards(
    { shardsPaths, dstPath }: { shardsPaths: string[]; dstPath: string; },
    callback: (data: { progress: number, dstPath?: string }, error?: Error) => void
  ): Promise<void> {
    try {
      const restored = await new Promise<{ progress: number, dataBase64: string }>((resolve, reject) => {
        this.restoreFromFileShardsToData({ shardsPaths }, ({ progress, dataBase64 }, error) => {
          if (error) {
            reject(error);
          } else {
            resolve({ progress, dataBase64: dataBase64! });
          }
        }).catch(reject);
      });
      await this.fs.write(dstPath, fromBase64(restored.dataBase64));
      callback({ progress: restored.progress, dstPath });
    } catch (error) {
      callback({ progress: 0 }, error as Error);
    }
  }

  async restoreFromFileShardsToData(
    { shardsPaths }: { shardsPaths: string[]; },
    callback: (data: { progress: number, dataBase64?: string }, error?: Error) => void
  ): Promise<void> {
    try {
      const shardsBase64 = await this.readShardFiles(shardsPaths);
      const restored = await new Promise<{ progress: number, dataBase64?: string }>((resolve, reject) => {
        this.restoreFromShards({ inputShardsBase64: shardsBase64 }, (data, error) => {
          if (error) {
            reject(error);
          } else {
            resolve(data);
          }
        }).catch(reject);
      });
      callback(restored);
    } catch (error) {
      callback({ progress: 0 }, error as Error);
    }
  }

  async restoreFileShard(
    { shardIndex, shardsPaths, dstPathRoot }: { shardIndex: number; shardsPaths: string[]; dstPathRoot: string; },
    callback: (data: { progress: number, shardPath?: string }, error?: Error) => void
  ): Promise<void> {
    try {
      // Checked before any file is read, so an invalid request is reported as such
      const shardIndexError = this.findShardIndexError(shardIndex);
      if (shardIndexError) {
        callback({ progress: 0 }, shardIndexError);
        return;
      }
      const shardsBase64 = await this.readShardFiles(shardsPaths);
      const restored = await new Promise<{ progress: number, dataBase64: string }>((resolve, reject) => {
        this.restoreShard({ shardIndex, inputShardsBase64: shardsBase64 }, ({ progress, dataBase64 }, error) => {
          if (error) {
            reject(error);
          } else {
            resolve({ progress, dataBase64: dataBase64! });
          }
        }).catch(reject);
      });
      const id = this.generateJobId();
      const shardPath = this.formatShardPath(dstPathRoot, id, shardIndex);
      await this.fs.write(shardPath, fromBase64(restored.dataBase64));
      callback({ progress: restored.progress, shardPath });
    } catch (error) {
      callback({ progress: 0 }, error as Error);
    }
  }

  private async readShardFiles(shardsPaths: string[]): Promise<string[]> {
    const shardsBase64: string[] = [];
    for (const shardPath of shardsPaths) {
      const data = await this.fs.read(shardPath);
      shardsBase64.push(toBase64(data));
    }
    return shardsBase64;
  }

  /** Returns the error to report for the target index of a shard, or undefined when it is in 1..255. */
  private findShardIndexError(shardIndex: number): Error | undefined {
    if (!Number.isInteger(shardIndex) || shardIndex < 1 || shardIndex > 255) {
      return new Error(
        `Invalid shard index ${shardIndex}. A restored shard index must be an integer from 1 to 255 (0 is the secret, not a shard)`
      );
    }
    return undefined;
  }

  /**
   * Input shards carry their index in the leading byte. Shards are keyed by that index, so a
   * repeated one silently evicts a genuine shard and reconstruction runs on fewer points than the
   * caller supplied. Returns the error to report, or undefined when every index is in 1..255.
   */
  private findInputShardsError(inputShards: Uint8Array[]): Error | undefined {
    const seenIndexes = new Set<number>();
    for (let i = 0; i < inputShards.length; i++) {
      const shardBytes = inputShards[i];
      // a shard is an index byte followed by at least one byte of shard data
      if (shardBytes.length < 2) {
        return new Error(
          `Invalid input shard at position ${i}. A shard must be an index byte followed by shard data, got ${shardBytes.length} byte(s)`
        );
      }
      const shardIdx = shardBytes[0];
      if (shardIdx < 1) {
        return new Error(
          `Invalid input shard index ${shardIdx}. Input shard indexes must be integers from 1 to 255 (0 is the secret, not a shard)`
        );
      }
      if (seenIndexes.has(shardIdx)) {
        return new Error(
          `Duplicate input shard index ${shardIdx} at position ${i}. Every input shard must carry its own index from 1 to 255`
        );
      }
      seenIndexes.add(shardIdx);
    }
    return undefined;
  }

  private formatShardPath(dirPath: string, id: string, index: number) {
    return `${dirPath}/${id}_${index}.bin`;
  }

  private generateJobId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  /** Web Filesystem Configuration */

  updateShamirWebFsIndexedDbConfig(config: Partial<IndexedDbConfig>) {
    this.fs.updateIndexedDbConfig(config);
  }
}