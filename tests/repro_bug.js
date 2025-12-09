
const fs = require('fs');
const path = require('path');

// Read the actual source file
const sourcePath = path.join(__dirname, '../multicall.js');
const sourceCode = fs.readFileSync(sourcePath, 'utf8');

// Mock browser environment if needed or just eval the class
// The file defines `const MULTICALL3_ADDRESS = ...` and `class MulticallDecoder ...`
// We can wrap it in a function or just eval it in global scope.

// We append an assignment to global object to ensure we can access it
// Note: sourceCode defines constants and a class.
vm = require('vm');
vm.runInThisContext(sourceCode);
// Now MulticallDecoder should be available if we running in this context? 
// No, `const` in top level of module is local to module. `runInThisContext` runs in global context.
// Let's try that.


// Helpers
function assert(condition, msg) {
    if (condition) {
        console.log('PASS: ' + msg);
    } else {
        console.error('FAIL: ' + msg);
        process.exit(1);
    }
}

// Test Case: Valid call to address 0x...01
function testLowAddress() {
    console.log("Testing Call to Low Address (0x...01)...");
    
    let p = "";
    p += "82ad56cb"; // Selector
    p += "0".repeat(62) + "20"; // Array Offset (32)

    // Array data
    p += "0".repeat(63) + "1"; // Length (1)
    p += "0".repeat(62) + "40"; // Item 0 Offset (64 relative to array start 32 -> 96 absolute)
    
    // Struct at 96
    
    // Target: 0x...01
    const target = "00".repeat(19) + "01"; 
    p += "0".repeat(24) + target; 
    
    // AllowFailure
    p += "0".repeat(63) + "1"; 
    
    // CallData Offset
    p += "0".repeat(62) + "60"; // 96
    
    // CallData
    p += "0".repeat(63) + "0"; // Length 0

    const data = "0x" + p;
    
    const result = MulticallDecoder.decode(data);
    
    console.log("Result Target:", result[0].target);
    
    const expectedTarget = "0x" + target;
    assert(result[0].target === expectedTarget, `Target should be ${expectedTarget}, got ${result[0].target}`);
}

try {
    testLowAddress();
} catch(e) {
    console.error("Exception:", e);
    process.exit(1);
}
