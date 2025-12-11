
export interface ContractMetadata {
    contractName: string;
    abi: any[];
}

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
        
        // Just trigger getContractMetadata, which handles caching
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
                return cached[cacheKey] as ContractMetadata;
            }
        } catch (e) {
            console.warn('Cache read error', e);
        }

        // Use Etherscan V2 API - action=getsourcecode returns both ABI and ContractName
        const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode&address=${address}&apikey=${this.apiKey}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === '1' && data.result && data.result.length > 0) {
                const result = data.result[0];
                let abi: any[] = [];
                
                // Parse ABI
                if (result.ABI && result.ABI !== 'Contract source code not verified') {
                     try {
                        abi = JSON.parse(result.ABI);
                    } catch {
                        // Keep empty or null
                    }
                }

                // If no ABI, we can't really do much, but maybe we still want the name?
                // Requirement says "fetch ABIs... and save the values".
                // If not verified, we might just return null or partial data.
                // Lets return what we have if ABI is valid.
                
                if (abi && Array.isArray(abi)) {
                    const metadata: ContractMetadata = {
                        contractName: result.ContractName || 'Unknown Contract',
                        abi: abi
                    };

                    // Cache it
                    chrome.storage.local.set({ [cacheKey]: metadata });
                    return metadata;
                }
            } else {
               // console.warn('Etherscan API error or no data:', data.message);
            }
        } catch (e) {
            console.error('Etherscan fetch error', e);
        }

        return null;
    }

    // Backwards compatibility or convenience wrapper if needed, but we will mostly use getContractMetadata now
    async getAbi(address: string, chainId: string = '1'): Promise<any | null> {
        const metadata = await this.getContractMetadata(address, chainId);
        return metadata ? metadata.abi : null;
    }
}
