import '../web/base64.utils';
import { Shamir } from '../index';
import { FileSystemMock } from '../web/file-system.mock';
import { describe, expect, test } from 'vitest';
import { toBase64, fromBase64 } from '../web/base64.utils';
import { Parts } from '../web/GF256';
import { join, restorePart, split } from '../web/scheme';

const fs = FileSystemMock.getInstance();

async function randomBytes(size: number) {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint8Array(size);
    return crypto.getRandomValues(arr);
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
    fs.updateIndexedDbConfig({
      dbName: 'shamir-test',
    });
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

describe('Shamir coordinate validation tests', () => {

  /** Coordinate 0 is the secret itself (`f(0)`), never a shard. */
  const SECRET_COORDINATE = 0;
  /** The byte an attacker injects through a forged shard. */
  const ATTACKER_BYTE = 0xaa;
  /** A restore that neither calls back nor settles must fail a test instead of stalling the suite. */
  const DEADLOCK_TIMEOUT_MS = 2000;

  interface RestoreData {
    progress: number;
    dataBase64?: string;
    dstPath?: string;
    shardPath?: string;
  }

  /**
   * Runs a restore with the same Promise-wrapped callback pattern used by the tests above, and
   * records every payload the callback emits, so a test can assert that nothing was handed to the
   * caller. The result rejects on an error from either channel (the callback argument or the
   * returned promise), and on a call that never settles at all, so a hang is reported as a failure.
   */
  function runRestore(
    run: (callback: (data?: RestoreData, error?: Error) => void) => Promise<void>,
    key: 'dataBase64' | 'dstPath' | 'shardPath',
    label: string,
  ): { emitted: string[], result: Promise<string> } {
    const emitted: string[] = [];
    const settled = new Promise<string>((resolve, reject) => {
      run((data, error) => {
        const value = data?.[key];
        if (value !== undefined) { emitted.push(value); }
        if (error) { reject(error); }
        if (value !== undefined) { resolve(value); }
      }).catch(reject);
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadlock = new Promise<string>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Deadlock: ${label} reported neither a result nor an error`)), DEADLOCK_TIMEOUT_MS);
    });
    const result = Promise.race([settled, deadlock]);
    result.then(() => clearTimeout(timer), () => clearTimeout(timer));
    return { emitted, result };
  }

  async function prepareInMemoryShards() {
    const srcBase64 = toBase64(await randomBytes(1024));
    const shardsBase64 = await new Promise<string[]>((resolve, reject) => {
      Shamir.generateShards({ threshold: 2, totalShards: 3, inputDataBase64: srcBase64 }, (data, error) => {
        if (error) { reject(error); }
        if (data?.shardsBase64) { resolve(data?.shardsBase64); }
      });
    });
    return { srcBase64, shardsBase64 };
  }

  async function prepareFileShards() {
    fs.updateIndexedDbConfig({
      dbName: 'shamir-test',
    });
    const tempDir = 'temp';
    const srcBase64 = toBase64(await randomBytes(1024));
    const absDstShardsPathRoot = `${tempDir}/test-coordinate-shards/`;
    const absDstShardPath = `${tempDir}/test-coordinate-shard/`;
    const absForgedShardPath = `${tempDir}/test-coordinate-forged-${Math.random().toString(36)}`;
    await fs.remove(absForgedShardPath);
    const shardPaths = await new Promise<string[]>((resolve, reject) => {
      Shamir.generateShardsToFiles(
        { totalShards: 3, threshold: 2, inputDataBase64: srcBase64, dstPathRoot: absDstShardsPathRoot },
        (data, error) => {
          if (error) { reject(error); }
          if (data?.shardsPaths) { resolve(data?.shardsPaths); }
        });
    });
    return { srcBase64, shardPaths, absDstShardPath, absForgedShardPath };
  }

  /** A forged shard: the attacker's chosen payload behind a leading index byte of 0. */
  function forgeShardAtSecretCoordinate(payloadLength: number) {
    const forgedShard = new Uint8Array(1 + payloadLength);
    forgedShard.fill(ATTACKER_BYTE, 1);
    forgedShard[0] = SECRET_COORDINATE;
    return forgedShard;
  }

  test('restoreShard rejects out-of-range shard indexes', async () => {
    const { shardsBase64 } = await prepareInMemoryShards();
    for (const shardIndex of [SECRET_COORDINATE, -1, 256]) {
      const { emitted, result } = runRestore(
        callback => Shamir.restoreShard({ shardIndex, inputShardsBase64: shardsBase64 }, callback),
        'dataBase64', `restoreShard with shardIndex ${shardIndex}`);
      await expect(result).rejects.toThrow(`Invalid shard index ${shardIndex}`);
      expect(emitted).to.deep.equal([]);
    }
  });

  test('restoreFromShards rejects an input shard at coordinate 0', async () => {
    const { srcBase64, shardsBase64 } = await prepareInMemoryShards();
    const forgedShard = forgeShardAtSecretCoordinate(fromBase64(srcBase64).length);
    const { emitted, result } = runRestore(
      callback => Shamir.restoreFromShards({ inputShardsBase64: [toBase64(forgedShard), ...shardsBase64] }, callback),
      'dataBase64', 'restoreFromShards with a forged shard at coordinate 0');
    await expect(result).rejects.toThrow('Invalid input shard index 0');
    expect(emitted).to.deep.equal([]);
  });

  test('file restores reject coordinate 0', async () => {
    const { srcBase64, shardPaths, absDstShardPath, absForgedShardPath } = await prepareFileShards();
    const byIndex = runRestore(
      callback => Shamir.restoreFileShard(
        { shardIndex: SECRET_COORDINATE, shardsPaths: shardPaths, dstPathRoot: absDstShardPath }, callback),
      'shardPath', 'restoreFileShard with shardIndex 0');
    await expect(byIndex.result).rejects.toThrow('Invalid shard index 0');
    expect(byIndex.emitted).to.deep.equal([]);
    // Same length as a genuine shard file, so only the index byte can be what gets it rejected.
    await fs.write(absForgedShardPath, forgeShardAtSecretCoordinate(fromBase64(srcBase64).length));
    const forged = runRestore(
      callback => Shamir.restoreFromFileShardsToData({ shardsPaths: [absForgedShardPath, ...shardPaths] }, callback),
      'dataBase64', 'restoreFromFileShardsToData with a forged shard file at coordinate 0');
    await expect(forged.result).rejects.toThrow('Invalid input shard index 0');
    expect(forged.emitted).to.deep.equal([]);
  }, 10000);

  test('restoreFromShards rejects a single shard instead of returning its payload', async () => {
    const { shardsBase64 } = await prepareInMemoryShards();
    // Why this matters: interpolating through one point returns that point's own value for every
    // byte, so a lone shard - genuine or attacker supplied - would come back as "the secret".
    const { emitted, result } = runRestore(
      callback => Shamir.restoreFromShards({ inputShardsBase64: [shardsBase64[0]] }, callback),
      'dataBase64', 'restoreFromShards with a single shard');
    await expect(result).rejects.toThrow('Need at least two parts');
    expect(emitted).to.not.contain(toBase64(fromBase64(shardsBase64[0]).subarray(1)));
    expect(emitted).to.deep.equal([]);
  });

  test('restoreFromShards rejects shards that all collapse onto one coordinate', async () => {
    const { shardsBase64 } = await prepareInMemoryShards();
    // Duplicates are keyed by coordinate, so these three shards would collapse to a single point
    const { emitted, result } = runRestore(
      callback => Shamir.restoreFromShards(
        { inputShardsBase64: [shardsBase64[0], shardsBase64[0], shardsBase64[0]] }, callback),
      'dataBase64', 'restoreFromShards with three copies of one shard');
    await expect(result).rejects.toThrow('Duplicate input shard index');
    expect(emitted).to.deep.equal([]);
  });

  test('restoreFromShards rejects a duplicate shard coordinate that would evict a genuine shard', async () => {
    const { srcBase64, shardsBase64 } = await prepareInMemoryShards();
    // A forged shard reusing shard #1's coordinate would silently replace it, leaving fewer
    // distinct points than the caller supplied while the call still reports success.
    const genuineShard = fromBase64(shardsBase64[0]);
    const forgedShard = new Uint8Array(genuineShard.length);
    forgedShard.fill(ATTACKER_BYTE);
    forgedShard[0] = genuineShard[0];
    const { emitted, result } = runRestore(
      callback => Shamir.restoreFromShards(
        { inputShardsBase64: [...shardsBase64, toBase64(forgedShard)] }, callback),
      'dataBase64', 'restoreFromShards with a duplicated coordinate');
    await expect(result).rejects.toThrow(`Duplicate input shard index ${genuineShard[0]}`);
    expect(emitted).to.not.contain(srcBase64);
    expect(emitted).to.deep.equal([]);
  });

  test('restoreShard rejects a duplicate input shard coordinate', async () => {
    const { shardsBase64 } = await prepareInMemoryShards();
    const { emitted, result } = runRestore(
      callback => Shamir.restoreShard(
        { shardIndex: 4, inputShardsBase64: [shardsBase64[0], shardsBase64[1], shardsBase64[0]] }, callback),
      'dataBase64', 'restoreShard with a duplicated coordinate');
    await expect(result).rejects.toThrow('Duplicate input shard index');
    expect(emitted).to.deep.equal([]);
  });

  test('restoreFromShards rejects a shard with no payload behind its index byte', async () => {
    const { emitted, result } = runRestore(
      callback => Shamir.restoreFromShards(
        { inputShardsBase64: [toBase64(new Uint8Array([1])), toBase64(new Uint8Array([2]))] }, callback),
      'dataBase64', 'restoreFromShards with index-byte-only shards');
    await expect(result).rejects.toThrow('Invalid input shard at position 0');
    expect(emitted).to.deep.equal([]);
  });

  test('restoreFromShards rejects an empty shard instead of naming an undefined index', async () => {
    const { shardsBase64 } = await prepareInMemoryShards();
    const { result } = runRestore(
      callback => Shamir.restoreFromShards(
        { inputShardsBase64: [toBase64(new Uint8Array(0)), ...shardsBase64] }, callback),
      'dataBase64', 'restoreFromShards with an empty shard');
    await expect(result).rejects.toThrow('Invalid input shard at position 0. A shard must be an index byte followed by shard data, got 0 byte(s)');
  });

  test('restoreFromFileShardsToData rejects a single shard file and duplicated shard files', async () => {
    const { shardPaths } = await prepareFileShards();
    const single = runRestore(
      callback => Shamir.restoreFromFileShardsToData({ shardsPaths: [shardPaths[0]] }, callback),
      'dataBase64', 'restoreFromFileShardsToData with a single shard file');
    await expect(single.result).rejects.toThrow('Need at least two parts');
    expect(single.emitted).to.deep.equal([]);
    const duplicated = runRestore(
      callback => Shamir.restoreFromFileShardsToData({ shardsPaths: [shardPaths[0], shardPaths[0]] }, callback),
      'dataBase64', 'restoreFromFileShardsToData with the same shard file twice');
    await expect(duplicated.result).rejects.toThrow('Duplicate input shard index');
    expect(duplicated.emitted).to.deep.equal([]);
  }, 10000);

  test('restoreFileShard reports a missing shard file through the callback', async () => {
    const { absDstShardPath, shardPaths } = await prepareFileShards();
    // The index is valid, so only the unreadable path can fail this - and it must not hang
    const { result } = runRestore(
      callback => Shamir.restoreFileShard(
        { shardIndex: 2, shardsPaths: ['temp/definitely-missing.bin', shardPaths[0]], dstPathRoot: absDstShardPath },
        callback),
      'shardPath', 'restoreFileShard with a missing shard file');
    await expect(result).rejects.toThrow('File not found');
  }, 10000);

  test('generateShardsToFiles reports an invalid threshold instead of hanging', async () => {
    // The core throws for a threshold below 2: that error must reach the caller, not deadlock
    const settled = new Promise<string[] | undefined>((resolve, reject) => {
      Shamir.generateShardsToFiles(
        { totalShards: 3, threshold: 1, inputDataBase64: toBase64(new Uint8Array([1, 2, 3])), dstPathRoot: 'temp/test-deadlock/' },
        (data, error) => {
          if (error) { reject(error); } else { resolve(data?.shardsPaths); }
        }).catch(reject);
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadlock = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Deadlock: generateShardsToFiles reported neither a result nor an error')), DEADLOCK_TIMEOUT_MS);
    });
    const result = Promise.race([settled, deadlock]);
    result.then(() => clearTimeout(timer), () => clearTimeout(timer));
    await expect(result).rejects.toThrow('K must be > 1');
  });

  test('restoreShard round-trips at high shard indexes', async () => {
    const { srcBase64, shardsBase64 } = await prepareInMemoryShards();
    for (const shardIndex of [128, 200, 255]) {
      const restoredShardBase64 = await runRestore(
        callback => Shamir.restoreShard({ shardIndex, inputShardsBase64: shardsBase64 }, callback),
        'dataBase64', `restoreShard with shardIndex ${shardIndex}`).result;
      expect(fromBase64(restoredShardBase64)[0]).to.equal(shardIndex);
      // The restored shard must still combine with a genuine one to recover the original secret.
      const restoredBase64 = await runRestore(
        callback => Shamir.restoreFromShards(
          { inputShardsBase64: [restoredShardBase64, shardsBase64[0]] }, callback),
        'dataBase64', `restoreFromShards with a shard at index ${shardIndex}`).result;
      expect(restoredBase64).to.equal(srcBase64);
    }
  });

});

/** These call the scheme directly: the core must stay airtight even if a caller bypasses `web.ts`. */
describe('Shamir scheme coordinate validation tests', () => {

  /** Coordinate 0 is the secret itself (`f(0)`), never a part. */
  const SECRET_COORDINATE = 0;
  /** The byte an attacker injects through a forged part. */
  const ATTACKER_BYTE = 0xaa;

  const randomBytesSync = (size: number) => crypto.getRandomValues(new Uint8Array(size));

  function prepareParts() {
    const secret = randomBytesSync(64);
    return { secret, parts: split(randomBytesSync, 3, 2, secret) };
  }

  /** The same parts plus one forged at coordinate 0 carrying the attacker's chosen payload. */
  function poison(parts: Parts, length: number): Parts {
    return { ...parts, [`${SECRET_COORDINATE}`]: new Uint8Array(length).fill(ATTACKER_BYTE) };
  }

  test('join rejects a part at coordinate 0', () => {
    const { secret, parts } = prepareParts();
    expect(() => join(poison(parts, secret.length))).to.throw('Invalid part ID "0"');
  });

  test('join rejects non-canonical part IDs that collide with an existing coordinate', () => {
    // Number() maps all of these to 1, so they would interpolate at the same x as "1". Two points
    // sharing an x make div() return garbage instead of throwing, silently corrupting the result.
    for (const alias of ['01', '1.0', '+1', ' 1', '1e0', '0x1']) {
      const { parts } = prepareParts();
      parts[alias] = parts['1'];
      expect(() => join(parts), alias).to.throw(`Invalid part ID "${alias}"`);
    }
  });

  test('join rejects a single part instead of returning its payload', () => {
    const { parts } = prepareParts();
    // Why this matters: with one point the Lagrange basis is 1, so join returns that part's bytes
    // verbatim, and one supplied part alone would dictate the result.
    const attackerPart: Parts = { 7: new Uint8Array(8).fill(ATTACKER_BYTE) };
    expect(() => join(attackerPart)).to.throw('Need at least two parts');
    expect(() => join({ 1: parts['1'] })).to.throw('Need at least two parts');
    expect(() => join({})).to.throw('Need at least two parts');
  });

  test('join still recovers the secret from genuine parts', () => {
    const { secret, parts } = prepareParts();
    expect(Array.from(join(parts))).to.deep.equal(Array.from(secret));
    expect(Array.from(join({ 1: parts['1'], 3: parts['3'] }))).to.deep.equal(Array.from(secret));
  });

  test('restorePart rejects out-of-range and non-integer target indexes', () => {
    const { parts } = prepareParts();
    for (const partIdx of [SECRET_COORDINATE, -1, 256, 1.5, NaN]) {
      expect(() => restorePart(parts, partIdx)).to.throw(`Invalid part index ${partIdx}`);
    }
  });

  test('restorePart still mints usable parts across the whole valid range', () => {
    const { secret, parts } = prepareParts();
    // Paired with genuine part 2, which none of these indexes collide with.
    for (const partIdx of [1, 128, 255]) {
      const restored = restorePart(parts, partIdx);
      expect(Array.from(join({ [`${partIdx}`]: restored, 2: parts['2'] }))).to.deep.equal(Array.from(secret));
    }
    // Restoring an index that already exists must reproduce that part byte for byte.
    expect(Array.from(restorePart(parts, 1))).to.deep.equal(Array.from(parts['1']));
  });

});
