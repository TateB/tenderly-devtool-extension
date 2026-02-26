/**
 * Pure utility functions for network/chain detection.
 * No DOM dependencies — safe for unit testing.
 */

/**
 * Detects a chain ID from the RPC endpoint URL using keyword heuristics.
 * Returns '1' (mainnet) as the default fallback.
 */
export function detectNetworkFromUrl(requestUrl: string): string {
  if (!requestUrl) return '1';
  const lowerUrl = requestUrl.toLowerCase();

  if (lowerUrl.includes('sepolia')) return '11155111';
  if (lowerUrl.includes('holesky')) return '17000';
  if (lowerUrl.includes('goerli')) return '5';
  if (lowerUrl.includes('optimism') || lowerUrl.includes('opt')) return '10';
  if (lowerUrl.includes('arbitrum') || lowerUrl.includes('arb')) return '42161';
  if (lowerUrl.includes('polygon') || lowerUrl.includes('matic')) return '137';
  if (lowerUrl.includes('base')) return '8453';

  return '1';
}

/**
 * Detects the network by sending an eth_chainId RPC call.
 * Falls back to URL heuristics if the RPC call fails.
 */
export async function detectNetwork(requestUrl: string): Promise<string> {
  if (!requestUrl) return '1';

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: 1,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.result) {
        return parseInt(data.result, 16).toString();
      }
    }
  } catch (e) {
    console.warn('Network detection via RPC failed', e);
  }

  return detectNetworkFromUrl(requestUrl);
}
