# capacitor-shamir

<a href="https://github.com/vault12/capacitor-shamir/actions/workflows/ci.yml">
  <img src="https://github.com/vault12/capacitor-shamir/actions/workflows/ci.yml/badge.svg" alt="Github Actions Build Status" />
</a>
<a href="https://github.com/vault12/capacitor-shamir/actions/workflows/ci.yml">
  <img src="https://raw.githubusercontent.com/vault12/capacitor-shamir/badges/badges/coverage-total.svg" alt="Coverage total" />
</a>

Provides Shamir's Secret Sharing (SSS) functionality for secure splitting and recovering secrets natively on iOS, Android, and Web.

## Install

```bash
npm install capacitor-shamir
npx cap sync
```

## API

<docgen-index>

* [`generateShards(...)`](#generateshards)
* [`restoreFromShards(...)`](#restorefromshards)
* [`restoreShard(...)`](#restoreshard)
* [`generateFileShards(...)`](#generatefileshards)
* [`generateShardsToFiles(...)`](#generateshardstofiles)
* [`restoreFromFileShards(...)`](#restorefromfileshards)
* [`restoreFromFileShardsToData(...)`](#restorefromfileshardstodata)
* [`restoreFileShard(...)`](#restorefileshard)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### generateShards(...)

```typescript
generateShards(options: { totalShards: number; threshold: number; inputDataBase64: string; }, callback: (data?: { progress: number; shardsBase64?: string[]; }, error?: any) => void) => Promise<void>
```

| Param          | Type                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------- |
| **`options`**  | <code>{ totalShards: number; threshold: number; inputDataBase64: string; }</code>            |
| **`callback`** | <code>(data?: { progress: number; shardsBase64?: string[]; }, error?: any) =&gt; void</code> |

--------------------


### restoreFromShards(...)

```typescript
restoreFromShards(options: { inputShardsBase64: string[]; }, callback: (data?: { progress: number; dataBase64?: string; }, error?: any) => void) => Promise<void>
```

| Param          | Type                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- |
| **`options`**  | <code>{ inputShardsBase64: string[]; }</code>                                            |
| **`callback`** | <code>(data?: { progress: number; dataBase64?: string; }, error?: any) =&gt; void</code> |

--------------------


### restoreShard(...)

```typescript
restoreShard(options: { shardIndex: number; inputShardsBase64: string[]; }, callback: (data?: { progress: number; dataBase64?: string; }, error?: any) => void) => Promise<void>
```

| Param          | Type                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- |
| **`options`**  | <code>{ shardIndex: number; inputShardsBase64: string[]; }</code>                        |
| **`callback`** | <code>(data?: { progress: number; dataBase64?: string; }, error?: any) =&gt; void</code> |

--------------------


### generateFileShards(...)

```typescript
generateFileShards(options: { totalShards: number; threshold: number; srcPath: string; dstPathRoot: string; }, callback: (data?: { progress: number; shardsPaths?: string[]; }, error?: any) => void) => Promise<void>
```

| Param          | Type                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------- |
| **`options`**  | <code>{ totalShards: number; threshold: number; srcPath: string; dstPathRoot: string; }</code> |
| **`callback`** | <code>(data?: { progress: number; shardsPaths?: string[]; }, error?: any) =&gt; void</code>    |

--------------------


### generateShardsToFiles(...)

```typescript
generateShardsToFiles(options: { totalShards: number; threshold: number; inputDataBase64: string; dstPathRoot: string; }, callback: (data?: { progress: number; shardsPaths?: string[]; }, error?: any) => void) => Promise<void>
```

| Param          | Type                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| **`options`**  | <code>{ totalShards: number; threshold: number; inputDataBase64: string; dstPathRoot: string; }</code> |
| **`callback`** | <code>(data?: { progress: number; shardsPaths?: string[]; }, error?: any) =&gt; void</code>            |

--------------------


### restoreFromFileShards(...)

```typescript
restoreFromFileShards(options: { shardsPaths: string[]; dstPath: string; }, callback: (data?: { progress: number; dstPath?: string; }, error?: any) => void) => Promise<void>
```

| Param          | Type                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| **`options`**  | <code>{ shardsPaths: string[]; dstPath: string; }</code>                              |
| **`callback`** | <code>(data?: { progress: number; dstPath?: string; }, error?: any) =&gt; void</code> |

--------------------


### restoreFromFileShardsToData(...)

```typescript
restoreFromFileShardsToData(options: { shardsPaths: string[]; }, callback: (data?: { progress: number; dataBase64?: string; }, error?: any) => void) => Promise<void>
```

| Param          | Type                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- |
| **`options`**  | <code>{ shardsPaths: string[]; }</code>                                                  |
| **`callback`** | <code>(data?: { progress: number; dataBase64?: string; }, error?: any) =&gt; void</code> |

--------------------


### restoreFileShard(...)

```typescript
restoreFileShard(options: { shardIndex: number; shardsPaths: string[]; dstPathRoot: string; }, callback: (data?: { progress: number; shardPath?: string; }, error?: any) => void) => Promise<void>
```

| Param          | Type                                                                                    |
| -------------- | --------------------------------------------------------------------------------------- |
| **`options`**  | <code>{ shardIndex: number; shardsPaths: string[]; dstPathRoot: string; }</code>        |
| **`callback`** | <code>(data?: { progress: number; shardPath?: string; }, error?: any) =&gt; void</code> |

--------------------

</docgen-api>
