// Shamir Algorithm over GF(2^8) finite field:
// Split data into bytes. Each byte is 0-255 GF(2^8) element
// Encrypt byte B:
// - call GF.generate(): fill array with random numbers. Verify that
//   highest polynomial power (which determines threshold number of points
//   to solve polynomial back) is non-zero coefficient.
//   We get polynomial like f(x) = B + a*x + b*x^2 + c*x^3 where B is our
//   secret byte and a,b,c are 0-255 elements of GF(2^8) choosen randomly.
//   a and b can randomly be zero, but c must not be zero since we want
//   polynomial of 3rd degree.
// - Let say we need 5 shards: we calculate f(1),f(2),f(3),f(4),f(5)
//   Becase this is all in GF(2^8) the resulting value is always 0-255 - another
//   byte. The value of that byte is totally random - it depends on random values
//   a,b and c.
// - The sharding of byte B is 5 pairs (i,pᵢ) with random pᵢ calcuated from our
//   polynomial according to rules of operations in GF(2^8)
// - These 5 buffers where every byte is replaced with "shard-byte" is our shares
// - Notice we dont record random coefficients which change between every byte
//   and are not needed for restoration
//
// Restore byte B is simple interpolation operation GF256.interpolate() of
// calculating f(0) knowing some polynimial values, say f(1), f(3), f(5). As long
// as we have enough values to solve for polynomial of given power (which we enforced
// by making sure highest power coeff is non-zero) we can solve it back for f(0)
// value, which will be GF(2^8) element - our original secret byte in that position.

import Foundation

class ShamirCore {
    
    // Regulates progress updates frequency. Keep consistent with Android impl (ShamirCore.java)
    private static let ProgressReportIntervalBytes = 10000
    
    // Split secret into number "shares" with "treshold" required to restore secret.
    // Returns: (shardIndex, shardData) tuple array, where shardIndex starts from 1.
    // If onProgress handler is specified, it's invoked each ProgressReportIntervalBytes bytes counter with progress and empty result.
    static func split(totalShards: UInt8, threshold: UInt8, secret: Data, onProgress: ((Double) -> Void)? = nil) throws -> [(UInt8, Data)] {
        if threshold < 2 {
            throw SimpleError("[ShamirCore] split() Threshold must be two or more")
        }
        if threshold > totalShards {
            throw SimpleError("[ShamirCore] split() Total shares must be >= threshold")
        }
        
        var shards = [Data](repeating: Data(count: secret.count), count: Int(totalShards))
        var progressReportCounter = 0;
        for i in 0..<secret.count {
            let p = try GF256.generate(threshold - 1, x: secret[i])
            for x in 1...totalShards {
                shards[Int(x) - 1][i] = GF256.eval(p, x)
            }
            if let onProgress = onProgress {
                progressReportCounter += 1
                if progressReportCounter == ShamirCore.ProgressReportIntervalBytes {
                    let progress = Double(i) / Double(secret.count)
                    onProgress(progress)
                    progressReportCounter = 0
                }
            }
        }
        
        let result = (0..<totalShards).map { ($0 + 1, shards[Int($0)]) }
        return result
    }
    
    // Restore original secret from given shards. If shards are under threshold result is random noise.
    // - OR -
    // If newShardIndex is specified and > 0 - generates new shard from other shards, with the given index.
    // Returns: data object - either restored secret or new shard.
    // If onProgress handler is specified, it's invoked each ProgressReportIntervalBytes bytes counter with progress and empty result.
    public static func restore(shards: [(UInt8,Data)], newShardIndex: UInt8 = 0, onProgress: ((Double) -> Void)? = nil) throws -> Data {
        guard newShardIndex >= 0 && newShardIndex <= 255 else {
            throw SimpleError("[ShamirCore] restore() shard index must be in [0...255]")
        }
        if shards.count < 2 {
            throw SimpleError("[ShamirCore] restore() Need at least two Shamir's shards")
        }
        let sizes = shards.map { $0.1.count }.reduce([Int]()) { $0.contains($1) ? $0 : $0 + [$1] }
        if sizes.count != 1 {
            throw SimpleError("[ShamirCore] restore() Shards have varying lengths")
        }
        
        var result = Data(count: sizes[0])
        var progressReportCounter = 0;
        for i in 0..<result.count {
            var points: [[UInt8]] = [[UInt8]](repeating: [UInt8](repeating:0, count:2), count: shards.count)
            var j: Int = 0
            for (idx, shard) in shards {
                points[j][0] = idx
                points[j][1] = shard[i]
                j += 1
            }
            result[i] = GF256.interpolate(points, newIdx: newShardIndex)
            if let onProgress = onProgress {
                progressReportCounter += 1
                if progressReportCounter == ShamirCore.ProgressReportIntervalBytes {
                    let progress = Double(i) / Double(result.count)
                    onProgress(progress)
                    progressReportCounter = 0
                }
            }
        }
        
        return result
    }
}
