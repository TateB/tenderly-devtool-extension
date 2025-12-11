import { decodeFunctionData, decodeFunctionResult, type Hex } from 'viem';

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976cA11".toLowerCase();

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

export class MulticallDecoder {
    
    static isMulticall(to: string, data: string): boolean {
        if (!to || to.toLowerCase() !== MULTICALL3_ADDRESS) return false;
        // 0x82ad56cb is aggregate3 selector
        if (!data || !data.startsWith("0x82ad56cb")) return false; 
        return true;
    }

    static decode(data: string) {
        try {
            const { args } = decodeFunctionData({
                abi: AGGREGATE3_ABI,
                data: data as Hex
            });
            // args[0] is the calls array
            return args[0];
        } catch (error) {
            console.error("Viem decode error:", error);
            return [];
        }
    }
    
    static decodeResult(rawResponse: string) {
        if (!rawResponse || rawResponse === '0x') return [];
        
        try {
            const result = decodeFunctionResult({
                abi: AGGREGATE3_ABI,
                functionName: 'aggregate3',
                data: rawResponse as Hex
            });
            // Result is the array of structs
            return result;
        } catch (error) {
            console.error("Viem decode result error:", error);
            return [];
        }
    }
}
