/*
 * This file includes code derived from https://github.com/simbo1905/shamir licensed under the Apache License, Version 2.0.
 * You may obtain a copy of the license at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Modifications:
 * - translated to TypeScript
 * - added restorePart function to restore a part with a given index
 */

import { evaluate, generate, interpolate, Parts, RandomBytes } from './GF256';

/**
 * Splits the given secret into {@code n} parts, of which any {@code k} or more can be combined to
 * recover the original secret.
 * @param  {(number) => Uint8Array} randomBytes Takes a length and returns a random
 * Uint8Array of that length
 * @param  {number} n the number of parts to produce (must be `>1`)
 * @param  {number} k the threshold of joinable parts (must be `<= n`})
 * @param  {Uint8Array} secret The secret to split as an array of bytes
 * @return {Parts} an map of `n` parts that are arrays of bytes of the
 * secret length
 */
export function split(randomBytes: RandomBytes, n: number, k: number, secret: Uint8Array): Parts {
  if (k <= 1) throw new Error('K must be > 1');
  if (n < k) throw new Error('N must be >= K');
  if (n > 255) throw new Error('N must be <= 255');

  const values = new Array(n)
    .fill(0)
    .map(() => new Uint8Array(secret.length).fill(0));
  for (let i = 0; i < secret.length; i++) {
    const p = generate(randomBytes, k - 1, secret[i]);
    for (let x = 1; x <= n; x++) {
      values[x - 1][i] = evaluate(p, x);
    }
  }

  const parts: Parts = {};
  for (let i = 0; i < values.length; i++) {
    const part = `${i + 1}`;
    parts[part] = values[i];
  }

  return parts;
}

/**
 * Joins the given parts to recover the original secret.
 *
 * <p><b>N.B.:</b> There is no way to determine whether or not the returned value is actually the
 * original secret. If the parts are incorrect, or are under the threshold value used to split the
 * secret, a random value will be returned.
 *
 * @param {Parts} parts an map of {@code n} parts that are arrays of bytes
 * of the secret length
 * @return {Uint8Array} the original secret
 *
 */
export function join(parts: Parts): Uint8Array {
  if (Object.keys(parts).length === 0) throw new Error('No parts provided');
  const lengths = Object.values(parts).map(x => x.length);
  const max = Math.max.apply(null, lengths);
  const min = Math.min.apply(null, lengths);
  if (max !== min) {
    throw new Error(`Varying lengths of part values. Min ${min}, Max ${max}`);
  }
  const secret = new Uint8Array(max);
  for (let i = 0; i < secret.length; i++) {
    const keys = Object.keys(parts);
    const points = new Array(keys.length)
      .fill(0)
      .map(() => new Uint8Array(2).fill(0));
    for (let j = 0; j < keys.length; j++) {
      const key = keys[j];
      const k = Number(key);
      points[j][0] = k;
      points[j][1] = parts[key][i];
    }
    secret[i] = interpolate(points);
  }

  return secret;
}

/**
 * Restores a part given a map of parts and a new index.
 *
 * @param {Parts} parts a map of part IDs to part values
 * @param {number} partIdx the new index for the part
 * @return {Uint8Array} the restored part
 * @throws {Error} if parts is empty or contains values of varying lengths
 */
export function restorePart(parts: Parts, partIdx: number): Uint8Array {
  if (Object.keys(parts).length <= 1) throw new Error('Need at least two parts');
  const lengths = Object.values(parts).map(x => x.length);
  const max = Math.max.apply(null, lengths);
  const min = Math.min.apply(null, lengths);
  if (max !== min) {
    throw new Error(`Parts have varying lengths. Min ${min}, Max ${max}`);
  }
  const restoredPart = new Uint8Array(max);
  for (let i = 0; i < restoredPart.length; i++) {
    const keys = Object.keys(parts);
    const points = new Array(keys.length)
      .fill(0)
      .map(() => new Uint8Array(2).fill(0));
    for (let j = 0; j < keys.length; j++) {
      const key = keys[j];
      const k = Number(key);
      points[j][0] = k;
      points[j][1] = parts[key][i];
    }
    restoredPart[i] = interpolate(points, partIdx);
  }
  return restoredPart;
}
