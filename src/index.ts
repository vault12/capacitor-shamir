import { registerPlugin } from '@capacitor/core';

import type { IndexedDbConfig, ShamirPlugin } from './definitions';
import { ShamirWeb } from './web';

const Shamir = registerPlugin<ShamirPlugin>('Shamir', {
  web: () => import('./web').then((m) => new m.ShamirWeb()),
});

export * from './definitions';

export const updateShamirWebFsIndexedDbConfig = (config: Partial<IndexedDbConfig>) => {
  (Shamir as ShamirWeb).updateShamirWebFsIndexedDbConfig(config);
};

export { Shamir };
