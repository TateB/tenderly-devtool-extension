export interface Config {
  tenderly_api_key?: string;
  etherscan_api_key?: string;
  tenderly_account_slug?: string;
  tenderly_project_slug?: string;
  tenderly_chain_id?: string;
  intercept_methods?: string[];
  intercept_reverted_only?: boolean;
}

export interface RequestData {
  id: string;
  timestamp: Date;
  url: string;
  rpcRequest: any;
  rpcResponse: any;
  multicallData?: MulticallItem[];
}

export interface MulticallItem {
  target: string;
  allowFailure: boolean;
  callData: string;
  success?: boolean;
  returnData?: string;
}
