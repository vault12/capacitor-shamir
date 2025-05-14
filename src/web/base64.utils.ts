export type Base64 = string;

export const toBase64 = (input: Uint8Array): Base64 => {
  const isBrowser = typeof btoa !== 'undefined';
  return isBrowser
    ? btoa(decodeLatin1(input))
    : Buffer.from(decodeLatin1(input), 'latin1').toString('base64');
};

export const fromBase64 = (input: Base64): Uint8Array => {
  const isBrowser = typeof btoa !== 'undefined';
  return isBrowser
    ? encodeLatin1(atob(input))
    : encodeLatin1(Buffer.from(input, 'base64').toString('latin1'));
};

export const encodeLatin1 = (data: string): Uint8Array => {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const c = data.charCodeAt(i);
    if ((c & 0xff) !== c) throw { message: 'Cannot encode string in Latin1', str: data };
    result[i] = c & 0xff;
  }
  return result;
};

export const decodeLatin1 = (data: Uint8Array): string => {
  const encoded = [];
  for (const byte of data) {
    encoded.push(String.fromCharCode(byte));
  }
  return encoded.join('');
};
