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

    // Index 0 is reserved: f(0) is the secret itself, so no INPUT shard may sit at x=0
    func testRestoreRejectsInputShardAtReservedIndex() throws {
        let secretData = Data("hello world".utf8)
        let shards = try ShamirCore.split(totalShards: 5, threshold: 3, secret: secretData)

        // Reserved index in first, middle and last position of the input
        for position in 0..<3 {
            var poisoned = [(UInt8,Data)](shards[0..<3])
            poisoned[position] = (0, poisoned[position].1)

            XCTAssertThrowsError( try ShamirCore.restore(shards: poisoned) ) { error in
                let message = errorMessage(error)
                XCTAssertTrue( message.contains("reserved index 0"), "Unexpected error: \(message)" )
            }
        }

        // An extra point injected at x=0 would otherwise dictate the whole reconstruction
        var poisoned = [(UInt8,Data)](shards[0..<3])
        poisoned.append( (0, Data("ATTACKER!!!".utf8)) )
        XCTAssertThrowsError( try ShamirCore.restore(shards: poisoned) )
    }

    // Two points at the same coordinate are not two points: the Lagrange basis divides by zero and
    // the reconstruction silently runs on fewer distinct points than the caller supplied
    func testRestoreRejectsDuplicateShardIndexes() throws {
        let secretData = Data("hello world".utf8)
        let attackerData = Data("ATTACKER!!!".utf8)
        XCTAssertEqual( secretData.count, attackerData.count, "Attacker payload must be shard sized" )

        let shards = try ShamirCore.split(totalShards: 5, threshold: 3, secret: secretData)
        // Control: this very shard set restores the secret
        XCTAssertEqual( try ShamirCore.restore(shards: [(UInt8,Data)](shards[0..<3])), secretData )

        // A genuine, above threshold shard set plus one forged shard reusing shard #1's coordinate
        var poisoned = [(UInt8,Data)](shards[0..<3])
        poisoned.append( (shards[0].0, attackerData) )

        XCTAssertThrowsError( try ShamirCore.restore(shards: poisoned) ) { error in
            let message = errorMessage(error)
            XCTAssertTrue( message.contains("duplicate index"), "Unexpected error: \(message)" )
            XCTAssertTrue( message.contains("\(shards[0].0)"), "Error does not name the offending index: \(message)" )
        }
        XCTAssertNil( try? ShamirCore.restore(shards: poisoned), "restore() accepted a duplicate shard index" )

        // The same shard supplied twice is the same break, and collapses below the threshold
        XCTAssertNil( try? ShamirCore.restore(shards: [shards[0], shards[0], shards[0]]),
                      "restore() accepted the same shard three times" )
        XCTAssertNil( try? ShamirCore.restore(shards: poisoned, newShardIndex: 4),
                      "restore() accepted a duplicate shard index while minting a shard" )
    }

    // A single shard interpolates to itself, so it would come back as "the secret"
    func testRestoreRejectsSingleShard() throws {
        let secretData = Data("hello world".utf8)
        let shards = try ShamirCore.split(totalShards: 5, threshold: 3, secret: secretData)

        XCTAssertThrowsError( try ShamirCore.restore(shards: [shards[0]]) ) { error in
            let message = errorMessage(error)
            XCTAssertTrue( message.contains("at least two"), "Unexpected error: \(message)" )
        }
        let leaked = try? ShamirCore.restore(shards: [(7, Data("ATTACKER!!!".utf8))])
        XCTAssertNil( leaked, "restore() returned the lone shard's payload as the secret" )
    }

    // Index 0 stays the legitimate TARGET sentinel: it means "interpolate f(0)", i.e. the secret
    func testRestoreSecretAtIndexZeroStillWorks() throws {
        let secretData = Data("hello world".utf8)
        let shards = try ShamirCore.split(totalShards: 5, threshold: 3, secret: secretData)
        let restore = [(UInt8,Data)](shards[0..<3])

        XCTAssertEqual( try ShamirCore.restore(shards: restore), secretData )
        XCTAssertEqual( try ShamirCore.restore(shards: restore, newShardIndex: 0), secretData )
    }

    // New shards at high coordinates must keep working, including >= 128
    func testRestoreNewShardAtHighIndex() throws {
        let secretData = Data("hello world".utf8)
        let shards = try ShamirCore.split(totalShards: 255, threshold: 3, secret: secretData)
        let restore = [(UInt8,Data)](shards[0..<3]) // indexes 1,2,3

        for newShardIndex: UInt8 in [1, 127, 128, 200, 255] {
            let newShard = try ShamirCore.restore(shards: restore, newShardIndex: newShardIndex)
            // Generated shard must match the shard we kept as control
            XCTAssertEqual( newShard, shards[Int(newShardIndex) - 1].1,
                            "New shard at index \(newShardIndex) does not match the genuine one" )
            XCTAssertNotEqual( newShard, secretData, "New shard at index \(newShardIndex) is the plaintext secret" )

            // Verify it is a real shard: with genuine shards not used to generate it, it restores the secret
            let r = try ShamirCore.restore(shards: [(newShardIndex, newShard), shards[9], shards[10]])
            XCTAssertEqual( r, secretData, "Shard generated at index \(newShardIndex) does not restore the secret" )
        }
    }

    // Text of a thrown SimpleError, to assert that it names the offending value
    private func errorMessage(_ error: Error) -> String {
        return (error as? SimpleError)?.message ?? "\(error)"
    }

}
