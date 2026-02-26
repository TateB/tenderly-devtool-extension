import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { EtherscanClient } from './etherscan';

// --- Chrome Storage Mock ---

function createStorageMock() {
  const store: Record<string, any> = {};
  return {
    get: mock((keys: string | string[], cb: (result: any) => void) => {
      const result: Record<string, any> = {};
      const keyList = typeof keys === 'string' ? [keys] : keys;
      for (const k of keyList) {
        if (store[k] !== undefined) result[k] = store[k];
      }
      cb(result);
    }),
    set: mock((items: Record<string, any>, cb?: () => void) => {
      Object.assign(store, items);
      cb?.();
    }),
    clear: mock((cb?: () => void) => {
      for (const k of Object.keys(store)) delete store[k];
      cb?.();
    }),
    _store: store,
  };
}

let storageMock: ReturnType<typeof createStorageMock>;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  storageMock = createStorageMock();
  (globalThis as any).chrome = {
    storage: { local: storageMock },
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete (globalThis as any).chrome;
});

describe('EtherscanClient', () => {
  test('returns null when API key is empty', async () => {
    const client = new EtherscanClient('');
    const result = await client.getContractMetadata('0x1234', '1');
    expect(result).toBeNull();
  });

  test('constructs correct Etherscan V2 API URL', async () => {
    let capturedUrl = '';
    globalThis.fetch = mock(async (url: any) => {
      capturedUrl = url.toString();
      return new Response(JSON.stringify({ status: '0', result: [] }), { status: 200 });
    }) as any;

    const client = new EtherscanClient('test-key');
    await client.getContractMetadata('0xABCD', '137');

    expect(capturedUrl).toContain('chainid=137');
    expect(capturedUrl).toContain('address=0xABCD');
    expect(capturedUrl).toContain('apikey=test-key');
    expect(capturedUrl).toContain('action=getsourcecode');
  });

  test('parses and caches valid ABI + contract name', async () => {
    const fakeAbi = [{ type: 'function', name: 'transfer', inputs: [], outputs: [] }];
    globalThis.fetch = mock(async () =>
      new Response(
        JSON.stringify({
          status: '1',
          result: [{ ContractName: 'WETH9', ABI: JSON.stringify(fakeAbi) }],
        }),
        { status: 200 }
      )
    ) as any;

    const client = new EtherscanClient('test-key');
    const result = await client.getContractMetadata('0xWETH', '1');

    expect(result).not.toBeNull();
    expect(result!.contractName).toBe('WETH9');
    expect(result!.abi).toEqual(fakeAbi);

    // Check it was cached
    expect(storageMock.set).toHaveBeenCalled();
  });

  test('returns cached result on second call without fetching again', async () => {
    const fakeAbi = [{ type: 'function', name: 'approve', inputs: [], outputs: [] }];
    let fetchCount = 0;
    globalThis.fetch = mock(async () => {
      fetchCount++;
      return new Response(
        JSON.stringify({
          status: '1',
          result: [{ ContractName: 'Token', ABI: JSON.stringify(fakeAbi) }],
        }),
        { status: 200 }
      );
    }) as any;

    const client = new EtherscanClient('test-key');

    // First call
    const result1 = await client.getContractMetadata('0xToken', '1');
    expect(result1!.contractName).toBe('Token');
    expect(fetchCount).toBe(1);

    // Second call — should come from cache
    const result2 = await client.getContractMetadata('0xToken', '1');
    expect(result2!.contractName).toBe('Token');
    expect(fetchCount).toBe(1); // No additional fetch
  });

  test('handles non-verified contract (ABI is string message)', async () => {
    globalThis.fetch = mock(async () =>
      new Response(
        JSON.stringify({
          status: '1',
          result: [{ ContractName: '', ABI: 'Contract source code not verified' }],
        }),
        { status: 200 }
      )
    ) as any;

    const client = new EtherscanClient('test-key');
    const result = await client.getContractMetadata('0xUnverified', '1');
    // ABI parsing is skipped for "Contract source code not verified", but the empty array
    // still passes Array.isArray, so metadata is returned with empty ABI
    expect(result).not.toBeNull();
    expect(result!.abi).toEqual([]);
    expect(result!.contractName).toBe('Unknown Contract');
  });

  test('handles fetch errors gracefully', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('Network error');
    }) as any;

    const client = new EtherscanClient('test-key');
    const result = await client.getContractMetadata('0x1234', '1');
    expect(result).toBeNull();
  });

  test('getAbi convenience wrapper returns the ABI array', async () => {
    const fakeAbi = [{ type: 'function', name: 'balanceOf', inputs: [], outputs: [] }];
    globalThis.fetch = mock(async () =>
      new Response(
        JSON.stringify({
          status: '1',
          result: [{ ContractName: 'ERC20', ABI: JSON.stringify(fakeAbi) }],
        }),
        { status: 200 }
      )
    ) as any;

    const client = new EtherscanClient('test-key');
    const abi = await client.getAbi('0xERC20', '1');
    expect(abi).toEqual(fakeAbi);
  });

  test('getAbi returns null when metadata is null', async () => {
    const client = new EtherscanClient('');
    const abi = await client.getAbi('0x1234', '1');
    expect(abi).toBeNull();
  });

  test('prefetch triggers getContractMetadata', async () => {
    const fakeAbi = [{ type: 'function', name: 'swap', inputs: [], outputs: [] }];
    let fetchCalled = false;
    globalThis.fetch = mock(async () => {
      fetchCalled = true;
      return new Response(
        JSON.stringify({
          status: '1',
          result: [{ ContractName: 'UniswapV3', ABI: JSON.stringify(fakeAbi) }],
        }),
        { status: 200 }
      );
    }) as any;

    const client = new EtherscanClient('test-key');
    await client.prefetch('0xUni', '1');
    expect(fetchCalled).toBe(true);
  });

  test('prefetch does nothing with empty API key', async () => {
    let fetchCalled = false;
    globalThis.fetch = mock(async () => {
      fetchCalled = true;
      return new Response('{}', { status: 200 });
    }) as any;

    const client = new EtherscanClient('');
    await client.prefetch('0x1234', '1');
    expect(fetchCalled).toBe(false);
  });
});
