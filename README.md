# capacitor-shamir

<!-- # TODO BEFORE MERGE: update coverage badge url to public (without token) when repo becomes public -->
<a href="https://github.com/vault12/capacitor-shamir/actions/workflows/ci.yml"><img src="https://github.com/vault12/capacitor-shamir/actions/workflows/ci.yml/badge.svg" alt="Github Actions Build Status" /></a>&nbsp;<a href="https://github.com/vault12/capacitor-shamir/actions/workflows/ci.yml"><img src="https://github.com/vault12/capacitor-shamir/blob/badges/badges/coverage-total.svg" alt="Coverage total" /></a>

Capacitor plugin which provides [Shamir's Secret Sharing](https://en.wikipedia.org/wiki/Shamir%27s_secret_sharing) functionality for secure splitting and recovering secrets natively on iOS, Android, and Web.

## Install

```bash
npm install capacitor-shamir
npx cap sync
```

## API

### Overview

- Implementation contains memory-based and filesystem-bases API methods for:
  - splitting the secret data into encrypted shards;
  - restoring secred data from encrypted shards;
  - restoring N-th secret shard from encrypted shards.
- All methods are callback-based to ensure continuous progress reporting.
- Job is considered done when returned `data` object in callback contains truthy value of result property - `dataBase64`, `shardsBase64`, `shardsPath`, `shardsPaths`, `dstPath`. Progress should be used for displaying job progress only and should not be used to track job finish. In other words, consider job done when `!!dataBase64` but not when `progress === 100`.
- Since Capacitor doesn't support passing blob data, Base64 strings are used instead.

## Methods

<docgen-index>

* [`generateShards(...)`](#generateshards)
* [`restoreFromShards(...)`](#restorefromshards)
* [`restoreShard(...)`](#restoreshard)
* [`generateFileShards(...)`](#generatefileshards)
* [`generateShardsToFiles(...)`](#generateshardstofiles)
* [`restoreFromFileShards(...)`](#restorefromfileshards)
* [`restoreFromFileShardsToData(...)`](#restorefromfileshardstodata)
* [`restoreFileShard(...)`](#restorefileshard)
* [Interfaces](#interfaces)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### generateShards(...)

```typescript
generateShards(options: { totalShards: number; threshold: number; inputDataBase64: string; }, callback: (data?: { progress: number; shardsBase64?: string[]; }, error?: Error) => void) => Promise<void>
```

Splits secret data (Base64) into encrypted shards in memory.

| Param          | Type                                                                                                                | Description                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **`options`**  | <code>{ totalShards: number; threshold: number; inputDataBase64: string; }</code>                                   | totalShards, threshold, and inputDataBase64 (Base64-encoded secret) |
| **`callback`** | <code>(data?: { progress: number; shardsBase64?: string[]; }, error?: <a href="#error">Error</a>) =&gt; void</code> | Reports progress and returns shards as Base64 strings               |

--------------------


### restoreFromShards(...)

```typescript
restoreFromShards(options: { inputShardsBase64: string[]; }, callback: (data?: { progress: number; dataBase64?: string; }, error?: Error) => void) => Promise<void>
```

Restores secret data from encrypted shards (all in memory, Base64).

| Param          | Type                                                                                                            | Description                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **`options`**  | <code>{ inputShardsBase64: string[]; }</code>                                                                   | inputShardsBase64: array of Base64-encoded shards      |
| **`callback`** | <code>(data?: { progress: number; dataBase64?: string; }, error?: <a href="#error">Error</a>) =&gt; void</code> | Reports progress and returns restored secret as Base64 |

--------------------


### restoreShard(...)

```typescript
restoreShard(options: { shardIndex: number; inputShardsBase64: string[]; }, callback: (data?: { progress: number; dataBase64?: string; }, error?: Error) => void) => Promise<void>
```

Restores a specific shard from a set of encrypted shards (all in memory, Base64).

| Param          | Type                                                                                                            | Description                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **`options`**  | <code>{ shardIndex: number; inputShardsBase64: string[]; }</code>                                               | shardIndex and inputShardsBase64                           |
| **`callback`** | <code>(data?: { progress: number; dataBase64?: string; }, error?: <a href="#error">Error</a>) =&gt; void</code> | Reports progress and returns the requested shard as Base64 |

--------------------


### generateFileShards(...)

```typescript
generateFileShards(options: { totalShards: number; threshold: number; srcPath: string; dstPathRoot: string; }, callback: (data?: { progress: number; shardsPaths?: string[]; }, error?: Error) => void) => Promise<void>
```

Splits a file into encrypted shard files.

| Param          | Type                                                                                                               | Description                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| **`options`**  | <code>{ totalShards: number; threshold: number; srcPath: string; dstPathRoot: string; }</code>                     | totalShards, threshold, srcPath (input file), dstPathRoot (output directory) |
| **`callback`** | <code>(data?: { progress: number; shardsPaths?: string[]; }, error?: <a href="#error">Error</a>) =&gt; void</code> | Reports progress and returns paths to shard files                            |

--------------------


### generateShardsToFiles(...)

```typescript
generateShardsToFiles(options: { totalShards: number; threshold: number; inputDataBase64: string; dstPathRoot: string; }, callback: (data?: { progress: number; shardsPaths?: string[]; }, error?: Error) => void) => Promise<void>
```

Splits secret data (Base64) into encrypted shard files.

| Param          | Type                                                                                                               | Description                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **`options`**  | <code>{ totalShards: number; threshold: number; inputDataBase64: string; dstPathRoot: string; }</code>             | totalShards, threshold, inputDataBase64, dstPathRoot (output directory) |
| **`callback`** | <code>(data?: { progress: number; shardsPaths?: string[]; }, error?: <a href="#error">Error</a>) =&gt; void</code> | Reports progress and returns paths to shard files                       |

--------------------


### restoreFromFileShards(...)

```typescript
restoreFromFileShards(options: { shardsPaths: string[]; dstPath: string; }, callback: (data?: { progress: number; dstPath?: string; }, error?: Error) => void) => Promise<void>
```

Restores a file from encrypted shard files.

| Param          | Type                                                                                                         | Description                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| **`options`**  | <code>{ shardsPaths: string[]; dstPath: string; }</code>                                                     | shardsPaths (input files), dstPath (output file)  |
| **`callback`** | <code>(data?: { progress: number; dstPath?: string; }, error?: <a href="#error">Error</a>) =&gt; void</code> | Reports progress and returns the output file path |

--------------------


### restoreFromFileShardsToData(...)

```typescript
restoreFromFileShardsToData(options: { shardsPaths: string[]; }, callback: (data?: { progress: number; dataBase64?: string; }, error?: Error) => void) => Promise<void>
```

Restores secret data (Base64) from encrypted shard files.

| Param          | Type                                                                                                            | Description                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **`options`**  | <code>{ shardsPaths: string[]; }</code>                                                                         | shardsPaths (input files)                              |
| **`callback`** | <code>(data?: { progress: number; dataBase64?: string; }, error?: <a href="#error">Error</a>) =&gt; void</code> | Reports progress and returns restored secret as Base64 |

--------------------


### restoreFileShard(...)

```typescript
restoreFileShard(options: { shardIndex: number; shardsPaths: string[]; dstPathRoot: string; }, callback: (data?: { progress: number; shardPath?: string; }, error?: Error) => void) => Promise<void>
```

Restores a specific shard file from a set of encrypted shard files.

| Param          | Type                                                                                                           | Description                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **`options`**  | <code>{ shardIndex: number; shardsPaths: string[]; dstPathRoot: string; }</code>                               | shardIndex, shardsPaths (input files), dstPathRoot (output directory) |
| **`callback`** | <code>(data?: { progress: number; shardPath?: string; }, error?: <a href="#error">Error</a>) =&gt; void</code> | Reports progress and returns the path to the restored shard file      |

--------------------


### Interfaces


#### Error

| Prop          | Type                |
| ------------- | ------------------- |
| **`name`**    | <code>string</code> |
| **`message`** | <code>string</code> |
| **`stack`**   | <code>string</code> |

</docgen-api>
