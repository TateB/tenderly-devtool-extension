
import { encodeFunctionData, encodeFunctionResult } from 'viem';
import { MulticallDecoder } from './multicall';

// aggregate3(tuple(address target, bool allowFailure, bytes callData)[])
const AGGREGATE3_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "callData", type: "bytes" }
        ],
        name: "calls",
        type: "tuple[]"
      }
    ],
    name: "aggregate3",
    outputs: [
      {
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" }
        ],
        name: "returnData",
        type: "tuple[]"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

console.log("Verifying MulticallDecoder...");

// 1. Construct Sample Data using Viem Encoding
const calls = [
    {
        target: "0x1234567890123456789012345678901234567890",
        allowFailure: false,
        callData: "0xdeadbeef"
    },
    {
        target: "0x0987654321098765432109876543210987654321",
        allowFailure: true,
        callData: "0x" // empty
    }
] as const;

const encodedData = encodeFunctionData({
    abi: AGGREGATE3_ABI,
    functionName: 'aggregate3',
    args: [calls]
});

console.log("Encoded Data:", encodedData);

// 2. Decode using MulticallDecoder
const decoded = MulticallDecoder.decode(encodedData);
console.log("Decoded:", decoded);

if (decoded.length !== 2) throw new Error("Length mismatch");
if (decoded[0].target.toLowerCase() !== calls[0].target.toLowerCase()) throw new Error("Target mismatch");
if (decoded[0].callData !== calls[0].callData) throw new Error("CallData mismatch");
if (decoded[1].allowFailure !== calls[1].allowFailure) throw new Error("AllowFailure mismatch");

console.log("✅ Request Decoding Passed");

// 3. Verify Result Decoding
const results = [
    { success: true, returnData: "0x1234" },
    { success: false, returnData: "0x" }
] as const;

const encodedResult = encodeFunctionResult({
    abi: AGGREGATE3_ABI,
    functionName: 'aggregate3',
    result: results
});

console.log("Encoded Result:", encodedResult);

const decodedResults = MulticallDecoder.decodeResult(encodedResult);
console.log("Decoded Results:", decodedResults);

if (decodedResults.length !== 2) throw new Error("Result Length mismatch");
if (decodedResults[0].success !== true) throw new Error("Success mismatch");
if (decodedResults[0].returnData !== "0x1234") throw new Error("ReturnData mismatch");

console.log("✅ Result Decoding Passed");
console.log("All verifications passed!");
