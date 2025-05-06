/**
 * A promise that can be resolved or rejected from outside.
 */
export class DeferredPromise<T = void> extends Promise<T> {
  resolve!: (value: T | PromiseLike<T>) => void;
  reject!: (reason?: any) => void;

  constructor() {
    let resolver!: (value: T | PromiseLike<T>) => void;
    let rejector!: (reason?: any) => void;
    super((resolve, reject) => {
      resolver = resolve;
      rejector = reject;
    });
    this.resolve = resolver;
    this.reject = rejector;
  }
}

/**
 * Creates @DeferredPromise that can be resolved or rejected from outside.
 */
export function deferredPromise<T = void>() {
  return new DeferredPromise<T>();
}

export function delayPromise(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}