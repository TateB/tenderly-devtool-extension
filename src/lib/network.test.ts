import { describe, expect, test } from 'bun:test';
import { detectNetworkFromUrl } from './network';

describe('detectNetworkFromUrl', () => {
  test('returns "1" (mainnet) for empty string', () => {
    expect(detectNetworkFromUrl('')).toBe('1');
  });

  test('returns "1" for generic / unknown URLs', () => {
    expect(detectNetworkFromUrl('https://cloudflare-eth.com')).toBe('1');
    expect(detectNetworkFromUrl('https://my-rpc.example.com/v1/mainnet')).toBe('1');
    expect(detectNetworkFromUrl('http://localhost:8545')).toBe('1');
  });

  test('detects Sepolia', () => {
    expect(detectNetworkFromUrl('https://rpc.sepolia.org')).toBe('11155111');
    expect(detectNetworkFromUrl('https://eth-sepolia.g.alchemy.com/v2/key')).toBe('11155111');
  });

  test('detects Holesky', () => {
    expect(detectNetworkFromUrl('https://rpc.holesky.ethpandaops.io')).toBe('17000');
  });

  test('detects Goerli', () => {
    expect(detectNetworkFromUrl('https://eth-goerli.alchemy.com/v2/key')).toBe('5');
  });

  test('detects Optimism', () => {
    expect(detectNetworkFromUrl('https://opt-mainnet.g.alchemy.com/v2/key')).toBe('10');
    expect(detectNetworkFromUrl('https://mainnet.optimism.io')).toBe('10');
  });

  test('detects Arbitrum', () => {
    expect(detectNetworkFromUrl('https://arb1.arbitrum.io/rpc')).toBe('42161');
    expect(detectNetworkFromUrl('https://arb-mainnet.alchemy.com/v2/key')).toBe('42161');
  });

  test('detects Polygon', () => {
    expect(detectNetworkFromUrl('https://polygon-rpc.com')).toBe('137');
    expect(detectNetworkFromUrl('https://rpc-mainnet.matic.quiknode.pro')).toBe('137');
  });

  test('detects Base', () => {
    expect(detectNetworkFromUrl('https://mainnet.base.org')).toBe('8453');
    expect(detectNetworkFromUrl('https://base-mainnet.g.alchemy.com/v2/key')).toBe('8453');
  });

  test('is case insensitive', () => {
    expect(detectNetworkFromUrl('https://RPC.SEPOLIA.org')).toBe('11155111');
    expect(detectNetworkFromUrl('https://OPTIMISM.mainnet.io')).toBe('10');
  });
});
