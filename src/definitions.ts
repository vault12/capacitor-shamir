export interface ShamirPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
}
