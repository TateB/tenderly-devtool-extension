
export interface ContractMetadata {
    contractName: string;
    abi: any[];
    cachedAt?: number;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export class EtherscanClient {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private getCacheKey(address: string, chainId: string): string {
        return `contract_metadata_${chainId}_${address.toLowerCase()}`;
    }

    async prefetch(address: string, chainId: string = '1'): Promise<void> {
        if (!this.apiKey) return;
        await this.getContractMetadata(address, chainId);
    }

    async getContractMetadata(address: string, chainId: string = '1'): Promise<ContractMetadata | null> {
        if (!this.apiKey) return null;

        const cacheKey = this.getCacheKey(address, chainId);

        // Check cache
        try {
            const cached = await new Promise<any>((resolve) => {
                chrome.storage.local.get(cacheKey, (result) => resolve(result));
            });

            if (cached && cached[cacheKey]) {
                const entry = cached[cacheKey] as ContractMetadata;
                const isStale = !entry.cachedAt || (Date.now() - entry.cachedAt > SEVEN_DAYS_MS);

                if (!isStale) {
                    return entry;
                }

                // Stale: return immediately but refresh in background
                this.refreshInBackground(address, chainId, cacheKey);
                return entry;
            }
        } catch (e) {
            console.warn('Cache read error', e);
        }

        // Cache miss: fetch and cache
        const metadata = await this.fetchFromEtherscan(address, chainId);
        if (metadata) {
            chrome.storage.local.set({ [cacheKey]: metadata });
            return metadata;
        }

        return null;
    }

    private refreshInBackground(address: string, chainId: string, cacheKey: string): void {
        this.fetchFromEtherscan(address, chainId).then((metadata) => {
            if (metadata) {
                chrome.storage.local.set({ [cacheKey]: metadata });
            }
        }).catch(() => {});
    }

    private async fetchFromEtherscan(address: string, chainId: string): Promise<ContractMetadata | null> {
        const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode&address=${address}&apikey=${this.apiKey}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === '1' && data.result && data.result.length > 0) {
                const result = data.result[0];
                let abi: any[] = [];

                if (result.ABI && result.ABI !== 'Contract source code not verified') {
                    try {
                        abi = JSON.parse(result.ABI);
                    } catch {}
                }

                if (abi && Array.isArray(abi)) {
                    return {
                        contractName: result.ContractName || 'Unknown Contract',
                        abi,
                        cachedAt: Date.now(),
                    };
                }
            }
        } catch (e) {
            console.error('Etherscan fetch error', e);
        }

        return null;
    }

    async getAbi(address: string, chainId: string = '1'): Promise<any | null> {
        const metadata = await this.getContractMetadata(address, chainId);
        return metadata ? metadata.abi : null;
    }

    static clearCache(): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.get(null, (all) => {
                const cacheKeys = Object.keys(all).filter(k => k.startsWith('contract_metadata_'));
                if (cacheKeys.length === 0) {
                    resolve();
                    return;
                }
                chrome.storage.local.remove(cacheKeys, () => resolve());
            });
        });
    }
}
