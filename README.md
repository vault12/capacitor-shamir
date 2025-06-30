# 🔐 capacitor-shamir

<p align="center">
  <img src="https://github.com/user-attachments/assets/eed959d4-66fc-485d-9467-8fb1c57b9357"
    alt="Capacitor Shamir">
</p>

<p align="center">
  <strong>A powerful Capacitor plugin for secure secret sharing using Shamir's Secret Sharing algorithm</strong>
</p>

<p align="center">
  <a href="https://github.com/vault12/capacitor-shamir/releases"><img src="https://img.shields.io/npm/v/capacitor-shamir" alt="NPM Release" /></a>
  <a href="https://github.com/vault12/capacitor-shamir/actions/workflows/ci.yml"><img src="https://github.com/vault12/capacitor-shamir/actions/workflows/ci.yml/badge.svg" alt="Build Status" /></a>
  <a href="https://github.com/vault12/capacitor-shamir/actions/workflows/ci.yml"><img src="https://github.com/vault12/capacitor-shamir/blob/badges/badges/coverage-total.svg" alt="Coverage" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License" /></a>
  <a href="http://makeapullrequest.com"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" /></a>
  <a href="https://www.npmjs.com/package/capacitor-shamir"><img src="https://img.shields.io/npm/dm/capacitor-shamir" alt="Downloads" /></a>
</p>

---

## 🎯 What is Shamir's Secret Sharing?

[Shamir's Secret Sharing](https://en.wikipedia.org/wiki/Shamir%27s_secret_sharing) is a cryptographic algorithm that divides a secret into multiple parts (shards), where a minimum threshold of shards is required to reconstruct the original secret. This ensures that:

- **No single shard** reveals any information about the secret
- **Any threshold number** of shards can reconstruct the secret
- **Security through distribution** - store shards separately for maximum security

## ✨ Features

- 🔒 **Secure Secret Splitting**: Split sensitive data into encrypted shards using Shamir's Secret Sharing
- 📱 **Cross-Platform**: Native support for iOS, Android, and Web
- 💾 **Flexible Storage**: Memory-based and filesystem-based operations
- 📊 **Progress Tracking**: Real-time progress callbacks for all operations
- 🚀 **Performance Optimized**: Efficient handling of large files and data
- 🔄 **Recovery Options**: Restore complete secrets or individual shards

## 📦 Installation

```bash
npm install capacitor-shamir
npx cap sync
```

### Platform Quirks

#### Web
The web implementation uses [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) for file operations and includes all necessary polyfills.

## 🚀 Quick Start

```typescript
import { Shamir } from 'capacitor-shamir';

// Split a secret into 5 shards, requiring 3 to reconstruct
const secret = btoa("My secret data");
await Shamir.generateShards({
  totalShards: 5,
  threshold: 3,
  inputDataBase64: secret
}, (data, error) => {
  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data?.shardsBase64) {
    console.log('Secret split into shards:', data.shardsBase64);
  } else {
    console.log('Progress:', data?.progress + '%');
  }
});
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
generateShards(options: { totalShards: number; threshold: number; inputDataBase64: string; }, callback: (data?: { progress: number; shardsBase64?: string[] | undefined; } | undefined, error?: Error | undefined) => void) => Promise<void>
```

Splits secret data (Base64) into encrypted shards in memory.

| Param          | Type                                                                                                                | Description                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **`options`**  | <code>{ totalShards: number; threshold: number; inputDataBase64: string; }</code>                                   | totalShards, threshold, and inputDataBase64 (Base64-encoded secret) |
| **`callback`** | <code>(data?: { progress: number; shardsBase64?: string[]; }, error?: <a href="#error">Error</a>) =&gt; void</code> | Reports progress and returns shards as Base64 strings               |

--------------------


### restoreFromShards(...)

```typescript
restoreFromShards(options: { inputShardsBase64: string[]; }, callback: (data?: { progress: number; dataBase64?: string | undefined; } | undefined, error?: Error | undefined) => void) => Promise<void>
```

Restores secret data from encrypted shards (all in memory, Base64).

| Param          | Type                                                                                                            | Description                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **`options`**  | <code>{ inputShardsBase64: string[]; }</code>                                                                   | inputShardsBase64: array of Base64-encoded shards      |
| **`callback`** | <code>(data?: { progress: number; dataBase64?: string; }, error?: <a href="#error">Error</a>) =&gt; void</code> | Reports progress and returns restored secret as Base64 |

--------------------


### restoreShard(...)

```typescript
restoreShard(options: { shardIndex: number; inputShardsBase64: string[]; }, callback: (data?: { progress: number; dataBase64?: string | undefined; } | undefined, error?: Error | undefined) => void) => Promise<void>
```

Restores a specific shard from a set of encrypted shards (all in memory, Base64).

| Param          | Type                                                                                                            | Description                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **`options`**  | <code>{ shardIndex: number; inputShardsBase64: string[]; }</code>                                               | shardIndex and inputShardsBase64                           |
| **`callback`** | <code>(data?: { progress: number; dataBase64?: string; }, error?: <a href="#error">Error</a>) =&gt; void</code> | Reports progress and returns the requested shard as Base64 |

--------------------


### generateFileShards(...)

```typescript
generateFileShards(options: { totalShards: number; threshold: number; srcPath: string; dstPathRoot: string; }, callback: (data?: { progress: number; shardsPaths?: string[] | undefined; } | undefined, error?: Error | undefined) => void) => Promise<void>
```

Splits a file into encrypted shard files.

| Param          | Type                                                                                                               | Description                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| **`options`**  | <code>{ totalShards: number; threshold: number; srcPath: string; dstPathRoot: string; }</code>                     | totalShards, threshold, srcPath (input file), dstPathRoot (output directory) |
| **`callback`** | <code>(data?: { progress: number; shardsPaths?: string[]; }, error?: <a href="#error">Error</a>) =&gt; void</code> | Reports progress and returns paths to shard files                            |

--------------------


### generateShardsToFiles(...)

```typescript
generateShardsToFiles(options: { totalShards: number; threshold: number; inputDataBase64: string; dstPathRoot: string; }, callback: (data?: { progress: number; shardsPaths?: string[] | undefined; } | undefined, error?: Error | undefined) => void) => Promise<void>
```

Splits secret data (Base64) into encrypted shard files.

| Param          | Type                                                                                                               | Description                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **`options`**  | <code>{ totalShards: number; threshold: number; inputDataBase64: string; dstPathRoot: string; }</code>             | totalShards, threshold, inputDataBase64, dstPathRoot (output directory) |
| **`callback`** | <code>(data?: { progress: number; shardsPaths?: string[]; }, error?: <a href="#error">Error</a>) =&gt; void</code> | Reports progress and returns paths to shard files                       |

--------------------


### restoreFromFileShards(...)

```typescript
restoreFromFileShards(options: { shardsPaths: string[]; dstPath: string; }, callback: (data?: { progress: number; dstPath?: string | undefined; } | undefined, error?: Error | undefined) => void) => Promise<void>
```

Restores a file from encrypted shard files.

| Param          | Type                                                                                                         | Description                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| **`options`**  | <code>{ shardsPaths: string[]; dstPath: string; }</code>                                                     | shardsPaths (input files), dstPath (output file)  |
| **`callback`** | <code>(data?: { progress: number; dstPath?: string; }, error?: <a href="#error">Error</a>) =&gt; void</code> | Reports progress and returns the output file path |

--------------------


### restoreFromFileShardsToData(...)

```typescript
restoreFromFileShardsToData(options: { shardsPaths: string[]; }, callback: (data?: { progress: number; dataBase64?: string | undefined; } | undefined, error?: Error | undefined) => void) => Promise<void>
```

Restores secret data (Base64) from encrypted shard files.

| Param          | Type                                                                                                            | Description                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **`options`**  | <code>{ shardsPaths: string[]; }</code>                                                                         | shardsPaths (input files)                              |
| **`callback`** | <code>(data?: { progress: number; dataBase64?: string; }, error?: <a href="#error">Error</a>) =&gt; void</code> | Reports progress and returns restored secret as Base64 |

--------------------


### restoreFileShard(...)

```typescript
restoreFileShard(options: { shardIndex: number; shardsPaths: string[]; dstPathRoot: string; }, callback: (data?: { progress: number; shardPath?: string | undefined; } | undefined, error?: Error | undefined) => void) => Promise<void>
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

## License
This plugin is released under the [MIT License](http://opensource.org/licenses/MIT).


## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run platform-specific test cases
npm run verify:ios
npm run verify:android
```

## 📱 Platform Support

| Platform | Version | Status |
|----------|---------|--------|
| **iOS** | 14.0+ | ✅ Fully supported |
| **Android** | API 23+ | ✅ Fully supported |
| **Web** | Modern browsers | ✅ Fully supported |

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/vault12/capacitor-shamir.git
cd capacitor-shamir

# Install dependencies
npm install

# Build the plugin
npm run build

# Run tests
npm test
```

### Code Style

We use ESLint and Prettier for code formatting. Please run:

```bash
npm run lint
```

## 📝 Changelog

See [Releases](https://github.com/vault12/capacitor-shamir/releases) for detailed changelog.

## 🙏 Acknowledgments

- Finite field mathematics implementation based on [*The Laws of Cryptography: The Finite Field GF(28)* by Neal R. Wagner](https://web.archive.org/web/20180131040703/http://www.cs.utsa.edu/~wagner/laws/FFM.html)
- Built for [Capacitor](https://capacitorjs.com/) framework
- Implements [Shamir's Secret Sharing](https://en.wikipedia.org/wiki/Shamir%27s_secret_sharing) algorithm

- Inspired by the need for secure, distributed secret storage

## 📞 Support

- 🐛 [Issue Tracker](https://github.com/vault12/capacitor-shamir/issues)

---

<p align="center">
  Made with ❤️ by the <a href="https://github.com/vault12">Vault12 Team</a>
</p>
