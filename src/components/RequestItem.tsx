import { type Component, For, Show } from 'solid-js';
import { selectedRequestId, selectedSubIndex, selectRequest } from '../lib/store';
import type { RequestData } from '../lib/types';

interface RequestItemProps {
  request: RequestData;
}

const RequestItem: Component<RequestItemProps> = (props) => {
  const req = () => props.request;
  const isError = () => req().rpcResponse && req().rpcResponse.error;
  const isMulticall = () => !!req().multicallData;

  const statusClass = () => (isError() ? 'error' : 'success');
  const statusLabel = () => (isError() ? 'Request Failed' : 'Request Successful');
  const timeStr = () =>
    req().timestamp.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const methodLabel = () => {
    const resolved = req().resolvedFunctionName;
    if (resolved) return resolved;

    let label = req().rpcRequest.method;
    if (label === 'eth_call' || label === 'eth_estimateGas') {
      const data = req().rpcRequest.params?.[0]?.data;
      if (data && data.length >= 10) {
        label = data.substring(0, 10);
      }
    }
    return label;
  };

  const multiInfo = () => {
    if (!isMulticall() || !req().multicallData) return null;
    const total = req().multicallData!.length;
    const successCount = req().multicallData!.filter((m) => m.success).length;
    let multiClass = 'success';
    if (successCount === 0 && total > 0) multiClass = 'error';
    else if (successCount < total) multiClass = 'warning';
    return { total, multiClass };
  };

  const isActive = () =>
    selectedRequestId() === req().id && selectedSubIndex() === null;

  const summary = () => {
    const mi = multiInfo();
    if (mi) return `(${mi.total} calls)`;
    const params = req().rpcRequest.params;
    return params ? JSON.stringify(params).substring(0, 30) + '...' : '[]...';
  };

  return (
    <div class="request-group" id={`req-group-${req().id}`}>
      {/* Main item */}
      <div
        class={`request-item${isActive() ? ' active' : ''}`}
        data-id={req().id}
        role="button"
        tabIndex={0}
        onClick={() => selectRequest(req().id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') selectRequest(req().id);
        }}
      >
        <div class="req-header">
          <div class="req-header-left">
            <span class="method-tag" id={`method-tag-${req().id}`}>
              {methodLabel()}
            </span>
            <Show when={multiInfo()}>
              <span class={`method-tag multi ${multiInfo()!.multiClass} multi-label`}>
                MULTI
              </span>
            </Show>
          </div>
          <div class="tooltip-wrapper">
            <span class={`status-indicator ${statusClass()}`} />
            <span class="tooltip">{statusLabel()}</span>
          </div>
        </div>
        <div class="req-bottom-row">
          <div class="req-summary">
            {summary()}
          </div>
          <div class="req-time">{timeStr()}</div>
        </div>
      </div>

      {/* Sub-items for multicall */}
      <Show when={isMulticall()}>
        <div class="sub-request-list" id={`sub-list-${req().id}`}>
          <For each={req().multicallData}>
            {(sub, idx) => {
              const subId = () => `${req().id}-${idx()}`;
              const subStatus = () => (sub.success ? 'success' : 'error');
              const subLabel = () => (sub.success ? 'Call Successful' : 'Call Failed');
              const subSelector = () => sub.callData.substring(0, 10);
              const subActive = () =>
                selectedRequestId() === req().id && selectedSubIndex() === idx();

              return (
                <div
                  class={`request-item sub-item${subActive() ? ' active' : ''}`}
                  data-id={subId()}
                  data-parent-id={req().id}
                  data-sub-index={idx()}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectRequest(req().id, idx());
                  }}
                >
                  <div class="sub-item-row">
                    <div class="tooltip-wrapper">
                      <span class={`status-indicator sm ${subStatus()}`} />
                      <span class="tooltip">{subLabel()}</span>
                    </div>
                    <div class="sub-item-info">
                      #{idx() + 1}{' '}
                      <span class="sub-item-selector">
                        {sub.resolvedFunctionName || subSelector()}
                      </span>
                    </div>
                  </div>
                  <div class="sub-item-target">
                    {sub.resolvedContractName || `${sub.target.substring(0, 8)}...`}
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default RequestItem;
