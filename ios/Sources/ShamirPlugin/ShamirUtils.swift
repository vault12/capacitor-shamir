import Foundation

class ShamirUtils {
    
    private static let TAG = "[ShamirUtils]"
    private static let ShardNamePrefix = "shard"
    // Regulates chunk size of split/restore + file I/O + progress reporting. Keep consistent with Android impl (ShamirUtils.java)
    private static let BufferSize = 100000
    
    //
    // - In-memory API
    //
    
    public static func generateShards(totalShards: UInt8, threshold: UInt8, secret: Data, onProgress: @escaping (Double) -> Void) throws -> [(UInt8, Data)] {
        return try ShamirCore.split(totalShards: totalShards, threshold: threshold, secret: secret, onProgress: onProgress)
    }
    
    public static func restoreSecret(shards: [(UInt8, Data)], onProgress: @escaping (Double) -> Void) throws -> Data {
        return try ShamirCore.restore(shards: shards, onProgress: onProgress)
    }
    
    public static func restoreShard(shards: [(UInt8, Data)], shardIndex: UInt8, onProgress: @escaping (Double) -> Void) throws -> Data {
        return try ShamirCore.restore(shards: shards, newShardIndex: shardIndex, onProgress: onProgress)
    }
    
    // - File API
    //
    // For all file methods: if onProgress handler is specified, it's invoked each loop (which processes BufferSize bytes).
    // Progress inside of ShamirCore methods is not used.
    
    public static func generateFileShards(totalShards: UInt8, threshold: UInt8, srcPath: String, dstPathRoot: String, onProgress: (Double) -> Void) throws -> [String] {
        let fm = FileManager.default
        guard fm.fileExists(atPath: srcPath) else {
            throw SimpleError("\(TAG) generateFileShards() source file not found")
        }
        let srcLength = try fm.attributesOfItem(atPath: srcPath)[FileAttributeKey.size] as? Int ?? 0
        let srcFileHandle = FileHandle(forReadingAtPath: srcPath)!
        let readSource: (Int, Int) throws -> Data = { (_, count) in
            guard let srcBuffer = try srcFileHandle.read(upToCount: count) else {
                throw SimpleError("\(TAG) generateFileShards() FileHandle.read failed to read data")
            }
            return srcBuffer
        }
        return try generateFileShardsFromSource(totalShards: totalShards, threshold: threshold, srcLength: srcLength, readSource: readSource, dstPathRoot: dstPathRoot, onProgress: onProgress)
    }
    
    public static func generateShardsToFiles(totalShards: UInt8, threshold: UInt8, srcData: Data, dstPathRoot: String, onProgress: (Double) -> Void) throws -> [String] {
        let srcLength = srcData.count
        let readSource: (Int, Int) throws -> Data = { (offset, count) in
            let end = offset + count
            return srcData[offset..<end]
        }
        return try generateFileShardsFromSource(totalShards: totalShards, threshold: threshold, srcLength: srcLength, readSource: readSource, dstPathRoot: dstPathRoot, onProgress: onProgress)
    }
    
    public static func restoreFromFileShardsToFile(srcPaths: [String], dstPath: String, onProgress: (Double) -> Void) throws {
        let fm = FileManager.default
        guard let srcLength = try validateSrcShardsAndGetSrcLength(srcPaths), srcLength > 0 else {
            throw SimpleError("\(TAG) restoreFromFileShardsToFile() srcLength is zero")
        }
        let dstDirPath = URL.init(fileURLWithPath: dstPath).deletingLastPathComponent().path
        try ShamirUtils.createDirectory(dstDirPath)
        fm.createFile(atPath: dstPath, contents: Data())
        guard let dstFileHandle = FileHandle(forWritingAtPath: dstPath) else {
            throw SimpleError("\(TAG) restoreFromFileShards() failed to open dst writing handle")
        }
        defer {
            try? dstFileHandle.close()
        }
        try restoreFromFileShardsToHandler(srcPaths: srcPaths, srcLength: srcLength, writeHandler: { buffer in
            do {
                try dstFileHandle.write(contentsOf: buffer)
            } catch {
                throw ShamirUtils.processedError(error)
            }
        }, onProgress: onProgress)
    }
    
    public static func restoreFromFileShardsToData(srcPaths: [String], onProgress: (Double) -> Void) throws -> Data {
        guard let srcLength = try validateSrcShardsAndGetSrcLength(srcPaths), srcLength > 0 else {
            throw SimpleError("\(TAG) restoreFromFileShardsToData() srcLength is zero")
        }
        var dstBuffer = Data()
        try restoreFromFileShardsToHandler(srcPaths: srcPaths, srcLength: srcLength, writeHandler: { buffer in
            dstBuffer.append(buffer)
        }, onProgress: onProgress)
        return dstBuffer
    }
    
    public static func restoreShardFromFileShards(srcPaths: [String], shardIndex: UInt8, dstPathRoot: String, onProgress: (Double) -> Void) throws -> String {
        guard let srcLength = try validateSrcShardsAndGetSrcLength(srcPaths), srcLength > 0 else {
            throw SimpleError("\(TAG) restoreShardFromFileShards() srcLength is zero")
        }
        let (dstFileHandles, fileNames) = try prepareShardFiles(indexes: [shardIndex], pathRoot: dstPathRoot, id: generateUniqueId())
        guard let dstFileHandle = dstFileHandles.first, let fileName = fileNames.first else {
            throw SimpleError("restoreShardFromFileShards() failed to prepare shard file")
        }
        defer {
            try? dstFileHandle.close()
        }
        try restoreFromFileShardsToHandler(srcPaths: srcPaths, srcLength: srcLength, newShardIndex: shardIndex, writeHandler: { buffer in
            do {
                try dstFileHandle.write(contentsOf: buffer)
            } catch {
                throw ShamirUtils.processedError(error)
            }
        }, onProgress: onProgress)
        return fileName
    }
    
    //
    // - Helpers
    //
    
    private static func generateFileShardsFromSource(totalShards: UInt8, threshold: UInt8, srcLength: Int, readSource: (Int, Int) throws -> Data, dstPathRoot: String, onProgress: (Double) -> Void) throws -> [String] {
        let fm = FileManager.default
        let shardIndexes = Array(1...totalShards)
        let id = generateUniqueId()
        let (shardFileHandles, filePaths) = try prepareShardFiles(indexes: shardIndexes, pathRoot: dstPathRoot, id: id)
        defer { shardFileHandles.forEach { try? $0.close() } }
        let bufferSz = ShamirUtils.BufferSize
        var offset = 0
        repeat {
            let end = offset + bufferSz > srcLength ? srcLength : offset + bufferSz
            let srcBuffer = try readSource(offset, end - offset)
            let bufferShards = try ShamirCore.split(totalShards: totalShards, threshold: threshold, secret: srcBuffer)
            offset = end
            for (id, shard) in bufferShards {
                let i = Int(id) - 1 // Shard IDs start with 1
                do {
                    try shardFileHandles[i].write(contentsOf: shard)
                } catch {
                    throw ShamirUtils.processedError(error)
                }
            }
            let progress = Double(offset) / Double(srcLength)
            onProgress(progress)
        } while offset < srcLength

        return filePaths
    }
    
    // Generare file shards files, append index and open writable file handle
    private static func prepareShardFiles(indexes: [UInt8], pathRoot: String, id: String) throws -> (fileHandles: [FileHandle], filePaths: [String]) {
        let fm = FileManager.default
        let root = pathRoot != "" ? pathRoot : fm.urls(for: .cachesDirectory, in: .userDomainMask)[0].path
        try ShamirUtils.createDirectory(root)
        var filePaths = [String]()
        var fileHandles = [FileHandle]()
        for i in indexes {
            let filePath = "\(root)/\(id)_\(ShamirUtils.ShardNamePrefix)_\(i).bin"
            // First byte in each file is shard ID
            if fm.createFile(atPath: filePath, contents: Data([i])) != true {
                // Throw error right away if any shards can't not be saved
                throw SimpleError("\(TAG) prepareShardFiles() failed to create file")
            }
            let handle = FileHandle(forWritingAtPath: filePath)!
            handle.seekToEndOfFile()
            fileHandles.append(handle)
            filePaths.append(filePath)
        }
        return (fileHandles, filePaths)
    }
    
    private static func validateSrcShardsAndGetSrcLength(_ srcPaths: [String]) throws -> Int? {
        guard srcPaths.count >= 2 else {
            throw SimpleError("\(TAG) restoreFromFileShards() need at least two Shamir's shard files")
        }
        let fm = FileManager.default
        let sizes = try srcPaths
            .map { try fm.attributesOfItem(atPath: $0)[FileAttributeKey.size] as! Int }
            .reduce([Int]()) { $0.contains($1) ? $0 : $0 + [$1] }
        guard sizes.count == 1 else {
            throw SimpleError("\(TAG) restoreFromFileShards() shards have different sizes: \(sizes)")
        }
        return (sizes.first ?? 0) - 1 // first byte is shard index
    }
    
    private static func restoreFromFileShardsToHandler(srcPaths: [String], srcLength: Int, newShardIndex: UInt8 = 0, writeHandler: (Data) throws -> Void, onProgress: (Double) -> Void) throws {
        let srcFileHandles = srcPaths.map { FileHandle(forReadingAtPath: $0)! }
        defer {
            srcFileHandles.forEach { try? $0.close() }
        }
        
        let shardIds = try srcFileHandles.map {
            guard let data = try $0.read(upToCount: 1) else {
                throw SimpleError("\(TAG) restoreFromFileShards() failed to read idx")
            }
            return data.first! as UInt8
        }
        let bufferSz = ShamirUtils.BufferSize
        var offset = 0
        repeat {
            let sz = offset + bufferSz > srcLength ? srcLength - offset : bufferSz
            let shards = try srcFileHandles.map {
                guard let data = try $0.read(upToCount: sz) else {
                    throw SimpleError("\(TAG) restoreFromFileShards() failed to read shard buffer")
                }
                return data
            }
            let pairs = (0..<srcFileHandles.count).map { (shardIds[$0], shards[$0]) }
            let secretBuffer = try ShamirCore.restore(shards: pairs, newShardIndex: newShardIndex)
            try writeHandler(secretBuffer)
            offset += sz
            let progress = Double(offset) / Double(srcLength)
            onProgress(progress)
            
        } while offset < srcLength
    }
    
    private static func createDirectory(_ path: String) throws {
        let fm = FileManager.default
        var isDirectory = ObjCBool(true)
        let exists = fm.fileExists(atPath: path, isDirectory: &isDirectory) && isDirectory.boolValue
        if !(exists) {
            try fm.createDirectory(at: URL.init(fileURLWithPath: path), withIntermediateDirectories: true)
        }
    }
    
    private static func generateUniqueId() -> String {
        let tstamp = UInt64(NSDate().timeIntervalSince1970*1e10)
        let id = tstamp / 100000 * UInt64.random(in: 0..<100000)
        return "\(id)"
    }
    
    private static func processedError(_ error: Error) -> Error {
        // Error code 28 is for POSIX 28 ENOSPC Device out of space
        // This and other POSIX error codes can be found at:
        // https://man.freebsd.org/cgi/man.cgi?query=errno&apropos=0&sektion=0&manpath=OpenBSD+3.2&format=html
        if let underlyingError = (error as NSError).userInfo[NSUnderlyingErrorKey] as? NSError,
           underlyingError.domain == NSPOSIXErrorDomain && underlyingError.code == 28 {
            return SimpleError("Not enough disk space")
        }
        return error
    }
}
