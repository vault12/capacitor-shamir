export interface ShamirPlugin {
  generateShards(
    options: { totalShards: number, threshold: number, inputDataBase64: string },
    callback: (data?: { progress: number, shardsBase64?: string[] }, error?: any) => void
  ): Promise<void>;

  restoreFromShards(
    options: { inputShardsBase64: string[] },
    callback: (data?: { progress: number, dataBase64?: string }, error?: any) => void
  ): Promise<void>;

  restoreShard(
    options: { shardIndex: number, inputShardsBase64: string[] },
    callback: (data?: { progress: number, dataBase64?: string }, error?: any) => void
  ): Promise<void>;

  generateFileShards(
    options: { totalShards: number, threshold: number, srcPath: string, dstPathRoot: string },
    callback: (data?: { progress: number, shardsPaths?: string[] }, error?: any) => void
  ): Promise<void>;

  generateShardsToFiles(
    options: { totalShards: number, threshold: number, inputDataBase64: string, dstPathRoot: string },
    callback: (data?: { progress: number, shardsPaths?: string[] }, error?: any) => void
  ): Promise<void>;

  restoreFromFileShards(
    options: { shardsPaths: string[], dstPath: string },
    callback: (data?: { progress: number, dstPath?: string }, error?: any) => void
  ): Promise<void>;

  restoreFromFileShardsToData(
    options: { shardsPaths: string[] },
    callback: (data?: { progress: number, dataBase64?: string }, error?: any) => void
  ): Promise<void>;

  restoreFileShard(
    options: { shardIndex: number, shardsPaths: string[], dstPathRoot: string },
    callback: (data?: { progress: number, shardPath?: string }, error?: any) => void
  ): Promise<void>;
}
