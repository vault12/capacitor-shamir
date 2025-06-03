import XCTest

@testable import ShamirPlugin

class ShamirCoreTests: XCTestCase {
    
    func testIntegration() throws {
        for _ in 1...100 {
            // generate a random secret
            let length = Int.random(in: 1000...10000)
            var secureBytes = [UInt8](repeating: 0, count: length)
            let status = SecRandomCopyBytes(kSecRandomDefault, length, &secureBytes)
            if status != errSecSuccess { throw SimpleError("ShamirCoreTests: RNG failed") }
            let secretData = Data(secureBytes)
            // choose totalShards ∈ [2..10] and threshold ∈ [2..totalShards]
            let totalShards = UInt8.random(in: 2...10)
            let threshold = UInt8.random(in: 2...totalShards)
            // split into shards
            let shards = try ShamirCore.split(totalShards: UInt8(totalShards), threshold: UInt8(threshold), secret: secretData)
            
            for _ in 1...10 {
                // incorrect resore check (only if threshold > 2)
                if (threshold > 2) {
                    // pick a random subset of shards not enough to restore (size < threshold)
                    let shardsNotEnoughToRestoreCount = Int.random(in: Int(2)..<Int(threshold))
                    let shardsNotEnoughToRestoreIndexes = Array(0..<totalShards).shuffled().prefix(shardsNotEnoughToRestoreCount)
                    let shardsNotEnoughToRestore = shardsNotEnoughToRestoreIndexes.map { shards[Int($0)] }
                    // restore and verify
                    let incorrectRestoredData = try ShamirCore.restore(shards: shardsNotEnoughToRestore)
                    XCTAssertNotEqual(incorrectRestoredData, secretData, "Incorrectly restored data does match original")
                }
                // correct restore check
                // pick a random subset of shards to restore (size ∈ [threshold..totalShards])
                let shardsEnoughToRestoreCount = Int.random(in: Int(threshold)...Int(totalShards))
                let shardsEnoughToRestoreIndexes = Array(0..<totalShards).shuffled().prefix(shardsEnoughToRestoreCount)
                let shardsEnoughToRestore = shardsEnoughToRestoreIndexes.map { shards[Int($0)] }
                // restore and verify
                let correctRestoredData = try ShamirCore.restore(shards: shardsEnoughToRestore)
                XCTAssertEqual(correctRestoredData, secretData, "Correctly restored data does not match original")
            }
        }
    }
    
    // Testing restricted parameter ranges when creating ShamirSecretSharing
    func testWrongShards() {
        XCTAssertThrowsError( try { // T too low
            try ShamirCore.split(totalShards: 10, threshold: 1, secret: Data()) }()
        )

        XCTAssertThrowsError( try { // T > than all shares
            try ShamirCore.split(totalShards: 5, threshold: 7, secret: Data()) }()
        )

        XCTAssertThrowsError( try { // shards of different size
            try ShamirCore.restore(shards: [(1,Data([1,2,3])),(2,Data([1,2,3,4]))])
        }()
        )
    }
    // Testing normal Shamir ops
    func testSSS() throws {
        let totalShards = 5
        let threshold = 3
        let secretText = "hello world"
        let secretData = Data(secretText.utf8)
        let shards = try ShamirCore.split(totalShards: UInt8(totalShards), threshold: UInt8(threshold), secret: secretData)

        // Not enough shards to restore: no matter which 2
        // shards it is not enough to restore
        for (x,y) in [(2,3),(0,1),(1,2)] {
            // taking range from full array
            let restore = [(UInt8,Data)](shards[x...y])
            let r = try ShamirCore.restore(shards: restore)
            XCTAssertNotEqual( secretText, String(bytes: Data(r), encoding: .ascii) )
        }

        // Enough shards
        for (x,y) in [(2,4),(0,2),(1,3)] {
            let restore = [(UInt8,Data)](shards[x...y])
            let r = try ShamirCore.restore(shards: restore)
            XCTAssertEqual( secretText, String(bytes: r, encoding: .ascii) )
        }
    }

    // Test speed of operations with larger buffers
    func testSpeed() throws {
        self.measure {
            var secret = Data( count: 10000 )
            _ = secret.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, 10000, $0) }
            let shards = try? ShamirCore.split(totalShards: 2, threshold: 2, secret: secret)
            let r = try? ShamirCore.restore(shards: shards!)
            XCTAssertEqual( secret, r )
        }
    }


    // Test maximum number of shards (limited by our reliance on GF256 algebra)
    func testMaximumArmor() throws {
        let secret = "hello world"
        let shards = try ShamirCore.split(totalShards: 255, threshold: 255, secret: Data(secret.utf8))

        XCTAssertEqual(shards.count, 255)

        // Not enough shards to restore
        var restore = [(UInt8,Data)](shards[ 0..<254 ])
        var r = try ShamirCore.restore(shards: restore)
        XCTAssertNotEqual( secret, String(bytes: r, encoding: .ascii) )

        // Enough shards
        restore = [(UInt8,Data)](shards[ 0..<255 ])
        r = try ShamirCore.restore(shards: restore)
        XCTAssertEqual( secret, String(bytes: r, encoding: .ascii) )
    }

    // Generate new shard from original shards
    func testRestoreNewShard() throws {
        let secret = "hello world"
        let shards = try ShamirCore.split(totalShards: 6, threshold: 3, secret: Data(secret.utf8))

        for (x,y) in [(2,4),(0,2),(1,3)] {
            let restore = [(UInt8,Data)](shards[x...y])
            // Generate new shard with index y+2 that will be outside selected shards
            let newShard = try ShamirCore.restore(shards: restore, newShardIndex: UInt8(y + 2))
            let (_, oldShard) = shards[y + 1]
            // Verify that generated new shard matches shard we kept as control
            XCTAssertEqual( newShard, oldShard )

            // Verify we can restore from new shards same way
            var newShards = [(UInt8,Data)](shards)
            newShards[y + 1] = (UInt8(y + 2), newShard) // Shamir index starts from 1, since idx 0 is the secret
            let newRestore = [(UInt8,Data)](newShards[x...y])

            let r = try ShamirCore.restore(shards: newRestore)
            XCTAssertEqual( secret, String(bytes: r, encoding: .ascii) )
        }
    }

}
