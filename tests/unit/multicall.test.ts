import { describe, expect, test } from 'bun:test';
import { encodeFunctionData, encodeFunctionResult } from 'viem';
import { MulticallDecoder } from '../../src/multicall';

const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976cA11';
const AGGREGATE3_SELECTOR = '0x82ad56cb';

const AGGREGATE3_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'callData', type: 'bytes' },
        ],
        name: 'calls',
        type: 'tuple[]',
      },
    ],
    name: 'aggregate3',
    outputs: [
      {
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
        name: 'returnData',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

describe('MulticallDecoder', () => {
  // --- isMulticall ---

  describe('isMulticall', () => {
    test('returns true for correct multicall3 address and aggregate3 selector', () => {
      const data = AGGREGATE3_SELECTOR + '0'.repeat(64);
      expect(MulticallDecoder.isMulticall(MULTICALL3_ADDRESS, data)).toBe(true);
    });

    test('is case-insensitive for address', () => {
      const data = AGGREGATE3_SELECTOR + '0'.repeat(64);
      expect(MulticallDecoder.isMulticall(MULTICALL3_ADDRESS.toLowerCase(), data)).toBe(true);
      expect(MulticallDecoder.isMulticall(MULTICALL3_ADDRESS.toUpperCase(), data)).toBe(true);
    });

    test('returns false for wrong address', () => {
      const data = AGGREGATE3_SELECTOR + '0'.repeat(64);
      expect(MulticallDecoder.isMulticall('0x1234567890123456789012345678901234567890', data)).toBe(false);
    });

    test('returns false for wrong selector', () => {
      const data = '0xdeadbeef' + '0'.repeat(64);
      expect(MulticallDecoder.isMulticall(MULTICALL3_ADDRESS, data)).toBe(false);
    });

    test('returns false for empty/null inputs', () => {
      expect(MulticallDecoder.isMulticall('', '')).toBe(false);
      expect(MulticallDecoder.isMulticall(MULTICALL3_ADDRESS, '')).toBe(false);
      expect(MulticallDecoder.isMulticall('', AGGREGATE3_SELECTOR)).toBe(false);
    });

    test('returns false when data is too short', () => {
      expect(MulticallDecoder.isMulticall(MULTICALL3_ADDRESS, '0x82ad')).toBe(false);
    });
  });

  // --- decode ---

  describe('decode', () => {
    test('decodes a single-call aggregate3 payload', () => {
      const calls = [
        {
          target: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' as const,
          allowFailure: false,
          callData: '0xd0e30db0' as const,
        },
      ] as const;

      const encoded = encodeFunctionData({
        abi: AGGREGATE3_ABI,
        functionName: 'aggregate3',
        args: [calls],
      });

      const decoded = MulticallDecoder.decode(encoded);
      expect(decoded).toHaveLength(1);
      expect(decoded[0].target.toLowerCase()).toBe(calls[0].target.toLowerCase());
      expect(decoded[0].allowFailure).toBe(false);
      expect(decoded[0].callData).toBe('0xd0e30db0');
    });

    test('decodes a multi-call aggregate3 payload', () => {
      const calls = [
        {
          target: '0x1234567890123456789012345678901234567890' as const,
          allowFailure: false,
          callData: '0xdeadbeef' as const,
        },
        {
          target: '0x0987654321098765432109876543210987654321' as const,
          allowFailure: true,
          callData: '0x' as const,
        },
      ] as const;

      const encoded = encodeFunctionData({
        abi: AGGREGATE3_ABI,
        functionName: 'aggregate3',
        args: [calls],
      });

      const decoded = MulticallDecoder.decode(encoded);
      expect(decoded).toHaveLength(2);
      expect(decoded[0].target.toLowerCase()).toBe(calls[0].target.toLowerCase());
      expect(decoded[0].allowFailure).toBe(false);
      expect(decoded[0].callData).toBe('0xdeadbeef');
      expect(decoded[1].target.toLowerCase()).toBe(calls[1].target.toLowerCase());
      expect(decoded[1].allowFailure).toBe(true);
    });

    test('returns empty array for invalid data', () => {
      const result = MulticallDecoder.decode('0xbaddata');
      expect(result).toEqual([]);
    });
  });

  // --- decodeResult ---

  describe('decodeResult', () => {
    test('decodes aggregate3 response tuples', () => {
      const results = [
        { success: true, returnData: '0x1234' as const },
        { success: false, returnData: '0x' as const },
      ] as const;

      const encoded = encodeFunctionResult({
        abi: AGGREGATE3_ABI,
        functionName: 'aggregate3',
        result: results,
      });

      const decoded = MulticallDecoder.decodeResult(encoded);
      expect(decoded).toHaveLength(2);
      expect(decoded[0].success).toBe(true);
      expect(decoded[0].returnData).toBe('0x1234');
      expect(decoded[1].success).toBe(false);
    });

    test('returns empty array for 0x input', () => {
      expect(MulticallDecoder.decodeResult('0x')).toEqual([]);
    });

    test('returns empty array for empty string', () => {
      expect(MulticallDecoder.decodeResult('')).toEqual([]);
    });

    test('returns empty array for invalid data', () => {
      const result = MulticallDecoder.decodeResult('0xdeadbeef');
      expect(result).toEqual([]);
    });
  });
});
