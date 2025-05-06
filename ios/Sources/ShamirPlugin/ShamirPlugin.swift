import Foundation
import Capacitor

@objc(ShamirPlugin)
public class ShamirPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ShamirPlugin"
    public let jsName = "Shamir"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(#selector(generateShards), returnType: .callback),
        CAPPluginMethod(#selector(restoreFromShards), returnType: .callback),
        CAPPluginMethod(#selector(restoreShard), returnType: .callback),
        CAPPluginMethod(#selector(generateFileShards), returnType: .callback),
        CAPPluginMethod(#selector(generateShardsToFiles), returnType: .callback),
        CAPPluginMethod(#selector(restoreFromFileShards), returnType: .callback),
        CAPPluginMethod(#selector(restoreFromFileShardsToData), returnType: .callback),
        CAPPluginMethod(#selector(restoreFileShard), returnType: .callback),
    ]
    
    private let TAG = "[ShamirPlugin]"
    
    // - In-memory methods
    
    @objc func generateShards(_ call: CAPPluginCall) {
        let totalShards = call.getInt("totalShards", 0)
        let threshold = call.getInt("threshold", 0)
        let inputDataBase64 = call.getString("inputDataBase64", "")
        guard totalShards <= 255, threshold <= 255 else {
            call.reject("\(self.TAG) generateShards() totalShards and threshold should be <= 255")
            return
        }
        guard let inputData = Data(base64Encoded: inputDataBase64) else {
            call.reject("\(self.TAG) generateShards() invalid inputDataBase64")
            return
        }
        call.keepAlive = true
        
        // QoS docs: https://developer.apple.com/library/archive/documentation/Performance/Conceptual/EnergyGuide-iOS/PrioritizeWorkWithQoS.html
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let result = try ShamirUtils.generateShards(totalShards: UInt8(totalShards), threshold: UInt8(threshold), secret: inputData) { progress in
                    call.resolve([ "progress": progress ])
                }
                var shardsWithIndexesBase64 = [String]()
                for (index, data) in result {
                    // prepend shards with an index byte for correct restoration
                    let compoundData = NSMutableData()
                    compoundData.append(Data([index]))
                    compoundData.append(data)
                    let base64 = compoundData.base64EncodedString()
                    shardsWithIndexesBase64.append(base64)
                }
                call.keepAlive = false
                call.resolve([ "progress": 1.0, "shardsBase64": shardsWithIndexesBase64 ])
            } catch {
                call.keepAlive = false
                call.reject(error.localizedDescription)
            }
        }
    }
    
    @objc func restoreFromShards(_ call: CAPPluginCall) {
        let inputShardsBase64 = call.getArray("inputShardsBase64", String.self) ?? []
        var shardsWithIndexes = [(UInt8, Data)]()
        for base64 in inputShardsBase64 {
            guard let data = Data(base64Encoded: base64), data.count >= 1 else {
                call.reject("\(self.TAG) restoreFromShards() invalid inputDataBase64")
                return
            }
            let idx = data[0]
            // Data copying constructor is here to reset collection indices
            let shard = Data(data.suffix(from: 1))
            shardsWithIndexes.append((idx, shard))
        }
        call.keepAlive = true
        
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let result = try ShamirUtils.restoreSecret(shards: shardsWithIndexes) { progress in
                    call.resolve([ "progress": progress ])
                }
                call.keepAlive = false
                call.resolve([ "progress": 1.0, "dataBase64": result.base64EncodedString() ])
            } catch {
                call.keepAlive = false
                call.reject(error.localizedDescription)
            }
        }
        
        
    }
    
    @objc func restoreShard(_ call: CAPPluginCall) {
        let inputShardsBase64 = call.getArray("inputShardsBase64", String.self) ?? []
        let shardIndex = call.getInt("shardIndex", 0)
        guard shardIndex <= 255 else {
            call.reject("\(self.TAG) restoreShard() shardIndex should be <= 255")
            return
        }
        var shardsWithIndexes = [(UInt8, Data)]()
        for base64 in inputShardsBase64 {
            guard let data = Data(base64Encoded: base64), data.count >= 1 else {
                call.reject("\(self.TAG) restoreShard() invalid inputDataBase64")
                return
            }
            let idx = data[0]
            let shard = Data(data.suffix(from: 1))
            shardsWithIndexes.append((idx, shard))
        }
        call.keepAlive = true
        
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let result = try ShamirUtils.restoreShard(shards: shardsWithIndexes, shardIndex: UInt8(shardIndex)) { progress in
                    call.resolve([ "progress": progress ])
                }
                let compoundData = NSMutableData()
                compoundData.append(Data([UInt8(shardIndex)]))
                compoundData.append(result)
                let base64 = compoundData.base64EncodedString()
                call.keepAlive = false
                call.resolve([ "progress": 1.0, "dataBase64": base64 ])
            } catch {
                call.keepAlive = false
                call.reject(error.localizedDescription)
            }
        }
    }
    
    // - File methods
    
    @objc func generateFileShards(_ call: CAPPluginCall) {
        let totalShards = call.getInt("totalShards", 0)
        let threshold = call.getInt("threshold", 0)
        let srcPath = call.getString("srcPath", "")
        let dstPathRoot = call.getString("dstPathRoot", "")
        guard totalShards <= 255, threshold <= 255 else {
            call.reject("\(self.TAG) generateFileShards() totalShards and threshold should be <= 255")
            return
        }
        call.keepAlive = true
        
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let result = try ShamirUtils.generateFileShards(totalShards: UInt8(totalShards), threshold: UInt8(threshold), srcPath: srcPath, dstPathRoot: dstPathRoot) { progress in
                    call.resolve([ "progress": progress ])
                }
                call.keepAlive = false
                call.resolve([ "progress": 1.0, "shardsPaths": result ])
            } catch {
                call.keepAlive = false
                call.reject(error.localizedDescription)
            }
        }
    }
    
    @objc func generateShardsToFiles(_ call: CAPPluginCall) {
        let totalShards = call.getInt("totalShards", 0)
        let threshold = call.getInt("threshold", 0)
        let dstPathRoot = call.getString("dstPathRoot", "")
        let inputDataBase64 = call.getString("inputDataBase64", "")
        guard totalShards <= 255, threshold <= 255 else {
            call.reject("\(self.TAG) generateShards() totalShards and threshold should be <= 255")
            return
        }
        guard let inputData = Data(base64Encoded: inputDataBase64) else {
            call.reject("\(self.TAG) generateShards() invalid inputDataBase64")
            return
        }
        call.keepAlive = true
        
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let result = try ShamirUtils.generateShardsToFiles(totalShards: UInt8(totalShards), threshold: UInt8(threshold), srcData: inputData, dstPathRoot: dstPathRoot) { progress in
                    call.resolve([ "progress": progress ])
                }
                call.keepAlive = false
                call.resolve([ "progress": 1.0, "shardsPaths": result ])
            } catch {
                call.keepAlive = false
                call.reject(error.localizedDescription)
            }
        }
    }
    
    @objc func restoreFromFileShards(_ call: CAPPluginCall) {
        let srcPaths = call.getArray("shardsPaths", String.self) ?? []
        let dstPath = call.getString("dstPath", "")
        call.keepAlive = true
        
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try ShamirUtils.restoreFromFileShardsToFile(srcPaths: srcPaths, dstPath: dstPath) { progress in
                    call.resolve([ "progress": progress ])
                }
                call.keepAlive = false
                // here dstPath is returned back as the result to indicate that job is done
                call.resolve([ "progress": 1.0, "dstPath": dstPath ])
            } catch {
                call.keepAlive = false
                call.reject(error.localizedDescription)
            }
        }
    }
    
    @objc func restoreFromFileShardsToData(_ call: CAPPluginCall) {
        let srcPaths = call.getArray("shardsPaths", String.self) ?? []
        call.keepAlive = true
        
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let result = try ShamirUtils.restoreFromFileShardsToData(srcPaths: srcPaths) { progress in
                    call.resolve([ "progress": progress ])
                }
                call.keepAlive = false
                call.resolve([ "progress": 1.0, "dataBase64": result.base64EncodedString() ])
            } catch {
                call.keepAlive = false
                call.reject(error.localizedDescription)
            }
        }
    }
    
    @objc func restoreFileShard(_ call: CAPPluginCall) {
        let srcPaths = call.getArray("shardsPaths", String.self) ?? []
        let dstPathRoot = call.getString("dstPathRoot", "")
        let shardIndex = call.getInt("shardIndex", 0)
        guard shardIndex <= 255 else {
            call.reject("\(self.TAG) restoreFileShard() shardIndex should be <= 255")
            return
        }
        call.keepAlive = true
        
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let result = try ShamirUtils.restoreShardFromFileShards(srcPaths: srcPaths, shardIndex: UInt8(shardIndex), dstPathRoot: dstPathRoot) { progress in
                    call.resolve([ "progress": progress ])
                }
                call.keepAlive = false
                call.resolve([ "progress": 1.0, "shardPath": result ])
            } catch {
                call.keepAlive = false
                call.reject(error.localizedDescription)
            }
        }
    }
}
