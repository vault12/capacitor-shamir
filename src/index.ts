import { registerPlugin } from '@capacitor/core';

import type { ShamirPlugin } from './definitions';

const Shamir = registerPlugin<ShamirPlugin>('Shamir', {
  web: () => import('./web').then((m) => new m.ShamirWeb()),
});

export * from './definitions';
export { Shamir };
