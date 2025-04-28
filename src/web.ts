import { WebPlugin } from '@capacitor/core';

import type { ShamirPlugin } from './definitions';

export class ShamirWeb extends WebPlugin implements ShamirPlugin {
  async echo(options: { value: string }): Promise<{ value: string }> {
    console.log('ECHO', options);
    return options;
  }
}
