import { Show, createResource, createSignal, type Component } from 'solid-js';
import { decodeErrorResult, decodeFunctionData, decodeFunctionResult, type Hex } from 'viem';
import DecodedParams from '../lib/decode';
import { detectNetwork } from '../lib/network';
import {
    config,
    etherscanClient,
    selectedRequest,
    selectedRequestId,
    selectedSubIndex,
} from '../lib/store';
import CollapsibleSection from './CollapsibleSection';
import SimulateButton from './SimulateButton';

const DetailView: Component = () => {
  const req = () => selectedRequest();
  const subIdx = () => selectedSubIndex();

  // Compute display data for the current selection (main or sub-request)
  const displayData = () => {
    const r = req();
    if (!r) return null;

    const si = subIdx();
    if (si !== null && r.multicallData) {
      const sub = r.multicallData[si];
      if (sub) {
        const parentParams = r.rpcRequest.params ? r.rpcRequest.params[0] : {};
        return {
          request: r,
          method: 'ETH_CALL (Sub)',
          url: r.url,
          isError: !sub.success,
          displayReq: {
            method: 'eth_call',
            params: [{ to: sub.target, data: sub.callData, from: parentParams.from, gas: parentParams.gas }],
          },
          displayRes: sub.returnData ? { result: sub.returnData } : { error: { message: 'Failed or no data' } },
          to: sub.target,
          inputData: sub.callData,
          returnData: sub.returnData,
        };
      }
    }

    const isError = r.rpcResponse && !!r.rpcResponse.error;
    const params = r.rpcRequest.params?.[0];
    let returnData: string | undefined;
    if (r.rpcResponse) {
      if (!r.rpcResponse.error) {
        returnData = r.rpcResponse.result;
      } else if (r.rpcResponse.error?.data) {
        returnData = r.rpcResponse.error.data;
      }
    }

    return {
      request: r,
      method: r.rpcRequest.method,
      url: r.url,
      isError,
      displayReq: r.rpcRequest,
      displayRes: r.rpcResponse,
      to: params?.to,
      inputData: params?.data,
      returnData,
    };
  };

  // Decode resource — fetches ABI from etherscan and decodes input/output
  const [decodeResult] = createResource(
    () => {
      const dd = displayData();
      const client = etherscanClient();
      const id = selectedRequestId();
      if (!dd || !dd.to || !dd.inputData || dd.inputData === '0x' || !client) return null;
      return { to: dd.to, data: dd.inputData, returnData: dd.returnData, url: dd.url, isError: dd.isError, client, id };
    },
    async (params) => {
      if (!params) return null;
      const { to, data, returnData, url, isError, client } = params;

      const cfg = config();
      const chainId = cfg.tenderly_chain_id || (await detectNetwork(url));
      const metadata = await client.getContractMetadata(to, chainId);

      if (!metadata) return null;

      const { contractName, abi } = metadata;
      let decoded: any = null;
      let decodedOutput: any = null;
      let errorOutput: any = null;
      let decodeError: string | null = null;

      // Decode input
      try {
        decoded = decodeFunctionData({ abi, data: data as Hex });

        // Also update the method tag in the sidebar
        if (subIdx() === null) {
          const methodTag = document.getElementById(`method-tag-${selectedRequestId()}`);
          if (methodTag) {
            const currentText = methodTag.textContent;
            if (currentText && (currentText === 'eth_call' || currentText.startsWith('0x'))) {
              methodTag.textContent = decoded.functionName;
            }
          }
        }
      } catch (err: any) {
        const msg = err.message || String(err);
        if (msg.includes('selector') || msg.includes('not found')) {
          decodeError = `Function selector not found in ABI. Raw Error: ${msg}`;
        } else {
          decodeError = `Decode Error: ${msg}`;
        }
      }

      // Decode output
      if (decoded && returnData && returnData !== '0x') {
        try {
          decodedOutput = decodeFunctionResult({
            abi,
            functionName: decoded.functionName,
            data: returnData as Hex,
          });
        } catch {
          try {
            const errResult = decodeErrorResult({ abi, data: returnData as Hex });
            errorOutput = errResult;
          } catch {}
        }
      } else if (returnData === '0x' && isError) {
        errorOutput = { errorName: 'Revert', args: null, isEmptyRevert: true };
      }

      return {
        contractName,
        functionName: decoded?.functionName ?? null,
        decodedInput: decoded?.args ?? null,
        decodedOutput,
        errorOutput,
        decodeError,
        to,
      };
    }
  );

  // Contract address helpers
  const truncateAddress = (addr: string) =>
    addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;

  const [copyHintText, setCopyHintText] = createSignal('Click to copy');

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr).then(() => {
      setCopyHintText('Copied!');
      setTimeout(() => setCopyHintText('Click to copy'), 1200);
    });
  };

  const resolvedMethod = () => {
    const dr = decodeResult();
    if (dr?.functionName) return dr.functionName;
    return displayData()?.method ?? '';
  };

  return (
    <Show when={displayData()}>
      {(dd) => (
        <div id="detail-view" class="detail-view">
          {/* Header */}
          <div class="detail-header">
            <div class="detail-header-info">
              <div class="detail-header-top-row">
                <div id="detail-method" class="method-tag">
                  {resolvedMethod()}
                </div>
                <div
                  id="detail-status-indicator"
                  class={`status-indicator ${dd().isError ? 'error' : 'success'}`}
                  title={dd().isError ? 'Request Failed' : 'Request Successful'}
                />
              </div>
              <div id="detail-url" class="detail-header-url" title={dd().url}>
                {dd().url}
              </div>

              {/* Contract info */}
              <Show when={decodeResult()?.contractName}>
                <div id="detail-contract-name" class="contract-info">
                  <div class="contract-name">{decodeResult()!.contractName}</div>
                  <div
                    class="contract-address"
                    title={decodeResult()!.to}
                    onClick={() => copyAddress(decodeResult()!.to)}
                  >
                    <span class="copy-hint">{copyHintText()}</span>
                    {truncateAddress(decodeResult()!.to)}
                  </div>
                </div>
              </Show>
            </div>

            <SimulateButton request={dd().request} subIndex={subIdx()} />
          </div>

          {/* Body */}
          <div class="detail-body">
            {/* Decoded Input */}
            <Show when={decodeResult()?.decodedInput || decodeResult()?.decodeError}>
              <CollapsibleSection
                title="Decoded Input"
                isOpen={true}
                id="section-decoded-input"
              >
                <div id="decoded-input-content" class="decoded-container">
                  <Show when={decodeResult()?.decodedInput} fallback={
                    <div style={{ color: 'var(--accent-error)', padding: '12px' }}>
                      <strong>Error: {decodeResult()?.decodeError}</strong>
                    </div>
                  }>
                    <DecodedParams args={decodeResult()!.decodedInput} />
                  </Show>
                </div>
              </CollapsibleSection>
            </Show>

            {/* Decoded Output */}
            <Show when={decodeResult()?.decodedOutput || decodeResult()?.errorOutput}>
              <CollapsibleSection
                title="Decoded Output"
                isOpen={true}
                id="section-decoded-output"
              >
                <div id="decoded-output-content" class="decoded-container">
                  <Show when={decodeResult()?.errorOutput}>
                    {(err) => (
                      <Show
                        when={!err().isEmptyRevert}
                        fallback={
                          <div style={{ color: 'var(--accent-error)', padding: '12px' }}>
                            Transaction Reverted (No Error Data)
                          </div>
                        }
                      >
                        <div class="decoded-error-name" style={{ 'margin-bottom': '12px', 'font-weight': 'bold' }}>
                          Error: {err().errorName}
                        </div>
                        <DecodedParams args={err().args} />
                      </Show>
                    )}
                  </Show>
                  <Show when={decodeResult()?.decodedOutput && !decodeResult()?.errorOutput}>
                    <DecodedParams args={decodeResult()!.decodedOutput} />
                  </Show>
                </div>
              </CollapsibleSection>
            </Show>

            {/* Raw Request Params */}
            <CollapsibleSection title="Request Params" isOpen={false}>
              <div class="code-block">
                {JSON.stringify(dd().displayReq, null, 2)}
              </div>
            </CollapsibleSection>

            {/* Raw Response */}
            <CollapsibleSection title="Response" isOpen={false}>
              <div class="code-block">
                {dd().displayRes ? JSON.stringify(dd().displayRes, null, 2) : 'No Response'}
              </div>
            </CollapsibleSection>
          </div>
        </div>
      )}
    </Show>
  );
};

export default DetailView;
