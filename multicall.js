/**
 * Multicall3 Utility
 * Address: 0xcA11bde05977b3631167028862bE2a173976cA11
 */

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976cA11".toLowerCase();
// aggregate3(tuple(address target, bool allowFailure, bytes callData)[])
const AGGREGATE3_SELECTOR = "0x82ad56cb";

class MulticallDecoder {
    
    static isMulticall(to, data) {
        if (!to || to.toLowerCase() !== MULTICALL3_ADDRESS) return false;
        if (!data || !data.startsWith(AGGREGATE3_SELECTOR)) return false;
        return true;
    }

    static decode(data) {
        // Remove selector
        const raw = data.slice(10);
        
        // The input is a single dynamic array of structs: Call3[]
        // aggregate3 offset is usually 0x20 (32 bytes) pointing to the array length, 
        // since it's the first and only argument and it's dynamic.
        
        // Pointer to array
        const arrayOffset = parseInt(raw.substring(0, 64), 16) * 2;
        
        // Array Length
        const lengthHex = raw.substring(arrayOffset, arrayOffset + 64);
        const length = parseInt(lengthHex, 16);
        
        const calls = [];
        let currentOffset = arrayOffset + 64; // Start of data items
        
        for (let i = 0; i < length; i++) {
            // Each Call3 struct is 3 words (static head?) 
            // WAIT: Call3 has `bytes callData`, which is dynamic.
            // So Call3 struct path in the array is actually an offset to the struct?
            // "If a struct contains a dynamic type, the struct is dynamic."
            // "The array of dynamic types is encoded as: offset, length, item1_offset, item2_offset..."
            
            // Actually, `Call3` definition:
            // struct Call3 { address target; bool allowFailure; bytes callData; }
            // Since it has `bytes`, it IS dynamic. 
            // So the array data `currentOffset` points to a list of OFFSETS to the structs, not the structs themselves.
            
            // The itemOffset is relative to the START of the array content (which is `arrayOffset`).
            
            const itemOffsetRaw = raw.substring(currentOffset, currentOffset + 64);
            const itemOffset = parseInt(itemOffsetRaw, 16) * 2;
            
            // We need to add 64 chars (32 bytes) to skip the length word of the array itself.
            let structStart = arrayOffset + 64 + itemOffset;
             
            // Read Struct Head
            // Target
            let targetHex = "0x" + raw.substring(structStart + 24, structStart + 64); 
            


            const allowFailureHex = raw.substring(structStart + 64, structStart + 128);
            const allowFailure = parseInt(allowFailureHex, 16) !== 0;
            
            const callDataOffsetLoc = structStart + 128; // Word 2
            const callDataOffsetRel = parseInt(raw.substring(callDataOffsetLoc, callDataOffsetLoc + 64), 16) * 2;
            
            // This offset is relative to the START OF THE STRUCT
            const callDataStart = structStart + callDataOffsetRel;
            
            // Read bytes
            const bytesLength = parseInt(raw.substring(callDataStart, callDataStart + 64), 16) * 2;
            const bytesData = "0x" + raw.substring(callDataStart + 64, callDataStart + 64 + bytesLength);
            
            calls.push({
                target: targetHex,
                allowFailure,
                callData: bytesData
            });
            
            currentOffset += 64; // Next item offset
        }
        
        return calls;
    }
    
    // Result[] returnData
    // struct Result { bool success; bytes returnData; }
    static decodeResult(rawResponse) {
        // Output is Result[]
        if (!rawResponse || rawResponse === '0x') return [];
        
        const raw = rawResponse.startsWith('0x') ? rawResponse.slice(2) : rawResponse;
        
        const arrayOffset = parseInt(raw.substring(0, 64), 16) * 2;
        const length = parseInt(raw.substring(arrayOffset, arrayOffset + 64), 16);
        
        const results = [];
        let currentOffset = arrayOffset + 64; 
        
        for (let i = 0; i < length; i++) {
            const itemOffset = parseInt(raw.substring(currentOffset, currentOffset + 64), 16) * 2;
            
            // Fix: Add 64 chars (32 bytes) to skip the length word of the array itself.
            const structStart = arrayOffset + 64 + itemOffset;
            
            const success = parseInt(raw.substring(structStart, structStart + 64), 16) !== 0;
            
            const dataOffsetRel = parseInt(raw.substring(structStart + 64, structStart + 128), 16) * 2;
            const dataStart = structStart + dataOffsetRel;
            
            const msgLength = parseInt(raw.substring(dataStart, dataStart + 64), 16) * 2;
            const returnData = "0x" + raw.substring(dataStart + 64, dataStart + 64 + msgLength);
            
            results.push({
                success,
                returnData
            });
            
            currentOffset += 64;
        }
        
        return results;
    }
}
