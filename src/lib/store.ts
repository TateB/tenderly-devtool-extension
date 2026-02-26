import { createMemo, createSignal } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { decodeFunctionData, type Hex } from 'viem';
import { EtherscanClient } from '../etherscan';
import { MulticallDecoder } from '../multicall';
import { detectNetwork } from './network';
import type { Config, MulticallItem, RequestData } from './types';

// --- Signals ---

export const [config, setConfig] = createSignal<Config>({});
export const [activeTab, setActiveTab] = createSignal<'requests' | 'settings'>('requests');
export const [selectedRequestId, setSelectedRequestId] = createSignal<string | null>(null);
export const [selectedSubIndex, setSelectedSubIndex] = createSignal<number | null>(null);
export const [requests, setRequests] = createStore<RequestData[]>([]);

// --- Derived State ---

export const hasConfig = createMemo(() => {
  const c = config();
  return !!(c.tenderly_api_key && c.tenderly_account_slug && c.tenderly_project_slug);
});

export const selectedRequest = createMemo(() => {
  const id = selectedRequestId();
  if (!id) return null;
  return requests.find((r) => r.id === id) ?? null;
});

// --- Etherscan Client ---

export const [etherscanClient, setEtherscanClient] = createSignal<EtherscanClient | null>(null);

// --- Config CRUD ---

const CONFIG_KEYS = [
  'tenderly_api_key',
  'etherscan_api_key',
  'tenderly_account_slug',
  'tenderly_project_slug',
  'tenderly_chain_id',
  'intercept_methods',
  'intercept_reverted_only',
] as const;

export function loadConfig(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get([...CONFIG_KEYS], (result) => {
      const cfg = result as Config;
      setConfig(cfg);

      if (cfg.etherscan_api_key) {
        setEtherscanClient(new EtherscanClient(cfg.etherscan_api_key));
      } else {
        setEtherscanClient(null);
      }
      resolve();
    });
  });
}

export function saveConfig(newConfig: Config): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(newConfig, () => {
      setConfig(newConfig);

      if (newConfig.etherscan_api_key) {
        setEtherscanClient(new EtherscanClient(newConfig.etherscan_api_key));
      } else {
        setEtherscanClient(null);
      }
      resolve();
    });
  });
}

export function resetConfig(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.clear(() => {
      setConfig({});
      setEtherscanClient(null);
      resolve();
    });
  });
}

// --- Request Handling ---

export async function handleRequest(request: any) {
  if (request.request.method !== 'POST') return;

  const contentTypeHeader = request.request.headers.find(
    (h: any) => h.name.toLowerCase() === 'content-type'
  );
  if (!contentTypeHeader || !contentTypeHeader.value.includes('application/json')) return;

  if (!request.request.postData || !request.request.postData.text) return;

  let requestBody;
  try {
    requestBody = JSON.parse(request.request.postData.text);
  } catch {
    return;
  }

  const rpcRequest = Array.isArray(requestBody) ? requestBody[0] : requestBody;
  if (!rpcRequest || !rpcRequest.method) return;

  const currentCfg = config();
  const allowedMethods = currentCfg.intercept_methods || ['eth_estimateGas'];
  if (!allowedMethods.includes(rpcRequest.method)) return;

  request.getContent((content: string, _encoding: string) => {
    let rpcResponse: any = null;
    try {
      rpcResponse = JSON.parse(content);
    } catch {}

    if (currentCfg.intercept_reverted_only) {
      if (!rpcResponse || !rpcResponse.error) return;
    }

    // Multicall detection
    let multicallData: MulticallItem[] | null = null;
    let to: string | undefined;

    if (rpcRequest.params && rpcRequest.params.length > 0) {
      const txParams = rpcRequest.params[0];
      to = txParams.to;
      const data = txParams.data;

      if (to && MulticallDecoder.isMulticall(to, data)) {
        try {
          const subCallsRaw = MulticallDecoder.decode(data);
          let subResults: any[] = [];
          if (rpcResponse && rpcResponse.result) {
            subResults = MulticallDecoder.decodeResult(rpcResponse.result) as any[];
          }
          multicallData = (subCallsRaw as any[]).map((call, index) => {
            const res = subResults[index] || {};
            return {
              target: call.target,
              allowFailure: call.allowFailure,
              callData: call.callData,
              success: res.success,
              returnData: res.returnData,
            };
          });
        } catch (err) {
          console.error('Multicall Decode Error', err);
        }
      }
    }

    const reqId = Date.now() + Math.random().toString();
    const reqData: RequestData = {
      id: reqId,
      timestamp: new Date(),
      url: request.request.url,
      rpcRequest,
      rpcResponse,
      multicallData: multicallData || undefined,
    };

    setRequests(produce((list) => {
      list.unshift(reqData);
    }));

    // Auto-select first request
    if (requests.length === 1 && hasConfig()) {
      setSelectedRequestId(reqId);
      setSelectedSubIndex(null);
    }

    // Eagerly resolve function/contract names in background
    const client = etherscanClient();
    if (client && (to || multicallData)) {
      const reqUrl = request.request.url;
      detectNetwork(reqUrl).then(async (chainId) => {
        // Resolve main request
        if (to && to !== '0x') {
          const metadata = await client.getContractMetadata(to!, chainId);
          if (metadata) {
            const inputData = rpcRequest.params?.[0]?.data;
            let functionName: string | undefined;
            if (inputData && inputData !== '0x' && inputData.length >= 10 && metadata.abi.length > 0) {
              try {
                const decoded = decodeFunctionData({ abi: metadata.abi, data: inputData as Hex });
                functionName = decoded.functionName;
              } catch {}
            }
            setRequests(produce((list) => {
              const entry = list.find((r) => r.id === reqId);
              if (entry) {
                entry.resolvedContractName = metadata.contractName;
                if (functionName) entry.resolvedFunctionName = functionName;
              }
            }));
          }
        }

        // Resolve multicall sub-call names
        if (multicallData) {
          const uniqueTargets = [...new Set(multicallData.map(m => m.target.toLowerCase()))];
          const metadataMap = new Map<string, { contractName: string; abi: any[] }>();
          await Promise.all(
            uniqueTargets.map(async (target) => {
              const meta = await client.getContractMetadata(target, chainId);
              if (meta) metadataMap.set(target, meta);
            })
          );

          setRequests(produce((list) => {
            const entry = list.find((r) => r.id === reqId);
            if (!entry?.multicallData) return;
            for (let i = 0; i < entry.multicallData.length; i++) {
              const sub = entry.multicallData[i];
              const meta = metadataMap.get(sub.target.toLowerCase());
              if (meta) {
                sub.resolvedContractName = meta.contractName;
                if (sub.callData && sub.callData.length >= 10 && meta.abi.length > 0) {
                  try {
                    const decoded = decodeFunctionData({ abi: meta.abi, data: sub.callData as Hex });
                    sub.resolvedFunctionName = decoded.functionName;
                  } catch {}
                }
              }
            }
          }));
        }
      });
    }
  });
}

export function selectRequest(id: string, subIndex: number | null = null) {
  setSelectedRequestId(id);
  setSelectedSubIndex(subIndex);
}

export async function clearAbiCache(): Promise<void> {
  await EtherscanClient.clearCache();
}
