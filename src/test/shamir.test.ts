import '../web/base64.utils';
import { Shamir } from '../index';
import { FileSystemMock } from '../web/file-system.mock';
import { beforeEach, describe, expect, test } from 'vitest';
import { toBase64, fromBase64 } from '../web/base64.utils';

const fs = FileSystemMock.getInstance();

async function randomBytes(size: number) {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint8Array(size);
    crypto.getRandomValues(arr);
    return new Uint8Array(arr);
  }
  const { randomBytes } = await import('crypto');
  return new Uint8Array(randomBytes(size));
}

describe('Shamir in-memory tests', () => {

  async function prepareInMemoryShards() {
    const srcBase64 = toBase64(await randomBytes(1024 * 40));
    const shardsBase64 = await new Promise<string[]>((resolve, reject) => {
      Shamir.generateShards({ threshold: 2, totalShards: 3, inputDataBase64: srcBase64 }, (data, error) => {
        if (error) { reject(error); }
        if (data?.shardsBase64) { resolve(data?.shardsBase64); }
      });
    });
    return { srcBase64, shardsBase64 };
  }

  test('generateShards', async () => {
    const { srcBase64, shardsBase64 } = await prepareInMemoryShards();
    expect(shardsBase64.length).to.equal(3);
    const srcLength = fromBase64(srcBase64).length;
    const shardsLengths = shardsBase64.map(shard => fromBase64(shard).length);
    for (const length of shardsLengths) {
      expect(length).to.equal(srcLength + 1);
    }
  });

  test('restoreFromShards', async () => {
    const { srcBase64, shardsBase64 } = await prepareInMemoryShards();
    const restoredBase64 = await new Promise<string>((resolve, reject) => {
      Shamir.restoreFromShards({ inputShardsBase64: shardsBase64 }, (data, error) => {
        if (error) { reject(error); }
        if (data?.dataBase64) { resolve(data?.dataBase64); }
      });
    });
    expect(restoredBase64).to.equal(srcBase64);
  });

  test('restoreShard', async () => {
    const { shardsBase64 } = await prepareInMemoryShards();
    const idx = 2;
    const shardBase64 = await new Promise<string>((resolve, reject) => {
      Shamir.restoreShard({ shardIndex: idx, inputShardsBase64: shardsBase64 }, (data, error) => {
        if (error) { reject(error); }
        if (data?.dataBase64) { resolve(data?.dataBase64); }
      });
    });
    expect(shardBase64).to.equal(shardsBase64[idx - 1]);
  });

});

describe('Shamir file tests', () => {

  async function prepareFileShards() {
    const tempDir = 'temp';
    const absSrcPath = `${tempDir}/test-shamir-file-${Math.random().toString(36)}`;
    const absRestoredPath = `${tempDir}/test-shamir-file-restored-${Math.random().toString(36)}`;
    await fs.remove(absSrcPath);
    await fs.remove(absRestoredPath);
    const srcData = await randomBytes(1024 * 20);
    const srcBase64 = toBase64(srcData);
    await fs.write(absSrcPath, srcData);
    const absDstShardsPathRoot = `${tempDir}/test-shards/`;
    const absDstShardPath = `${tempDir}/test-shard/`;
    const shardPaths = await new Promise<string[]>((resolve, reject) => {
      Shamir.generateFileShards(
        { totalShards: 3, threshold: 2, srcPath: absSrcPath, dstPathRoot: absDstShardsPathRoot },
        (data, error) => {
          if (error) { reject(error); }
          if (data?.shardsPaths) { resolve(data?.shardsPaths); }
        });
    });
    return { srcBase64, absSrcPath, absDstShardPath, shardPaths, absRestoredPath };
  }

  test('generateFileShards', async () => {
    const { shardPaths, srcBase64 } = await prepareFileShards();
    const srcLength = fromBase64(srcBase64).length;
    expect(shardPaths.length).to.equal(3);
    for (const shardPath of shardPaths) {
      const shardBase64 = toBase64(await fs.read(shardPath));
      const shard = fromBase64(shardBase64);
      expect(shard.length).to.equal(srcLength + 1);
    }
  });

  test('restoreFromFileShardsToFile', async () => {
    const { shardPaths, srcBase64, absRestoredPath } = await prepareFileShards();
    const restoredPath = await new Promise<string>((resolve, reject) => {
      Shamir.restoreFromFileShards({ shardsPaths: shardPaths, dstPath: absRestoredPath }, (data, error) => {
        if (error) { reject(error); }
        if (data?.dstPath) { resolve(data?.dstPath); }
      });
    });
    const restoredBase64 = toBase64(await fs.read(restoredPath));
    expect(restoredBase64).to.equal(srcBase64);
  });

  test('restoreFromFileShardsToData', async () => {
    const { shardPaths, srcBase64 } = await prepareFileShards();
    const restoredBase64 = await new Promise<string>((resolve, reject) => {
      Shamir.restoreFromFileShardsToData({ shardsPaths: shardPaths }, (data, error) => {
        if (error) { reject(error); }
        if (data?.dataBase64) { resolve(data?.dataBase64); }
      });
    });
    expect(restoredBase64).to.equal(srcBase64);
  });

  test('restoreFileShard', async () => {
    const { shardPaths, absDstShardPath } = await prepareFileShards();
    const idx = 2;
    const restoredPath = await new Promise<string>((resolve, reject) => {
      Shamir.restoreFileShard(
        { shardIndex: idx, shardsPaths: shardPaths, dstPathRoot: absDstShardPath },
        (data, error) => {
          if (error) { reject(error); }
          if (data?.shardPath) { resolve(data?.shardPath); }
        });
    });
    const restoredBase64 = toBase64(await fs.read(restoredPath));
    const srcShardBase64 = toBase64(await fs.read(shardPaths[idx - 1]));
    expect(restoredBase64).to.equal(srcShardBase64);
  });

  test('generateShardsToFiles', async () => {
    const srcBase64 = toBase64(await randomBytes(1024 * 20));
    const tempDir = 'temp';
    const absDstShardsPathRoot = `${tempDir}/test-shards/`;
    const shardPaths = await new Promise<string[]>((resolve, reject) => {
      Shamir.generateShardsToFiles(
        { totalShards: 3, threshold: 2, inputDataBase64: srcBase64, dstPathRoot: absDstShardsPathRoot },
        (data, error) => {
          if (error) { reject(error); }
          if (data?.shardsPaths) { resolve(data?.shardsPaths); }
        });
    });
    const srcLength = fromBase64(srcBase64).length;
    expect(shardPaths.length).to.equal(3);
    for (const shardPath of shardPaths) {
      const shardBase64 = toBase64(await fs.read(shardPath));
      const shard = fromBase64(shardBase64);
      expect(shard.length).to.equal(srcLength + 1);
    }
    const restoredBase64 = await new Promise<string>((resolve, reject) => {
      Shamir.restoreFromFileShardsToData({ shardsPaths: shardPaths }, (data, error) => {
        if (error) { reject(error); }
        if (data?.dataBase64) { resolve(data?.dataBase64); }
      });
    });
    expect(restoredBase64).to.equal(srcBase64);
  });

});
