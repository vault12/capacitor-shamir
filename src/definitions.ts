export interface ShamirPlugin {
  /**
   * Splits secret data (Base64) into encrypted shards in memory.
   * @param options totalShards, threshold, and inputDataBase64 (Base64-encoded secret)
   * @param callback Reports progress and returns shards as Base64 strings
   */
  generateShards(
    options: { totalShards: number, threshold: number, inputDataBase64: string },
    callback: (data?: { progress: number, shardsBase64?: string[] }, error?: any) => void
  ): Promise<void>;

  /**
   * Restores secret data from encrypted shards (all in memory, Base64).
   * @param options inputShardsBase64: array of Base64-encoded shards
   * @param callback Reports progress and returns restored secret as Base64
   */
  restoreFromShards(
    options: { inputShardsBase64: string[] },
    callback: (data?: { progress: number, dataBase64?: string }, error?: any) => void
  ): Promise<void>;

  /**
   * Restores a specific shard from a set of encrypted shards (all in memory, Base64).
   * @param options shardIndex and inputShardsBase64
   * @param callback Reports progress and returns the requested shard as Base64
   */
  restoreShard(
    options: { shardIndex: number, inputShardsBase64: string[] },
    callback: (data?: { progress: number, dataBase64?: string }, error?: any) => void
  ): Promise<void>;

  /**
   * Splits a file into encrypted shard files.
   * @param options totalShards, threshold, srcPath (input file), dstPathRoot (output directory)
   * @param callback Reports progress and returns paths to shard files
   */
  generateFileShards(
    options: { totalShards: number, threshold: number, srcPath: string, dstPathRoot: string },
    callback: (data?: { progress: number, shardsPaths?: string[] }, error?: any) => void
  ): Promise<void>;

  /**
   * Splits secret data (Base64) into encrypted shard files.
   * @param options totalShards, threshold, inputDataBase64, dstPathRoot (output directory)
   * @param callback Reports progress and returns paths to shard files
   */
  generateShardsToFiles(
    options: { totalShards: number, threshold: number, inputDataBase64: string, dstPathRoot: string },
    callback: (data?: { progress: number, shardsPaths?: string[] }, error?: any) => void
  ): Promise<void>;

  /**
   * Restores a file from encrypted shard files.
   * @param options shardsPaths (input files), dstPath (output file)
   * @param callback Reports progress and returns the output file path
   */
  restoreFromFileShards(
    options: { shardsPaths: string[], dstPath: string },
    callback: (data?: { progress: number, dstPath?: string }, error?: any) => void
  ): Promise<void>;

  /**
   * Restores secret data (Base64) from encrypted shard files.
   * @param options shardsPaths (input files)
   * @param callback Reports progress and returns restored secret as Base64
   */
  restoreFromFileShardsToData(
    options: { shardsPaths: string[] },
    callback: (data?: { progress: number, dataBase64?: string }, error?: any) => void
  ): Promise<void>;

  /**
   * Restores a specific shard file from a set of encrypted shard files.
   * @param options shardIndex, shardsPaths (input files), dstPathRoot (output directory)
   * @param callback Reports progress and returns the path to the restored shard file
   */
  restoreFileShard(
    options: { shardIndex: number, shardsPaths: string[], dstPathRoot: string },
    callback: (data?: { progress: number, shardPath?: string }, error?: any) => void
  ): Promise<void>;
}
