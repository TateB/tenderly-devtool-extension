import { type Component, createSignal, For, Show } from 'solid-js';
import { selectedRequestId, selectedSubIndex, selectRequest } from '../lib/store';
import type { RequestData } from '../lib/types';

interface RequestItemProps {
  request: RequestData;
}

const RequestItem: Component<RequestItemProps> = (props) => {
  const [expanded, setExpanded] = createSignal(false);

  const req = () => props.request;
  const isError = () => req().rpcResponse && req().rpcResponse.error;
  const isMulticall = () => !!req().multicallData;

  const statusClass = () => (isError() ? 'error' : 'success');
  const timeStr = () =>
    req().timestamp.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const methodLabel = () => {
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
          <div style={{ display: 'flex', 'align-items': 'center', gap: '6px', 'min-width': '0' }}>
            <Show when={isMulticall()}>
              <div
                class="expand-icon"
                style={{ transform: expanded() ? 'rotate(90deg)' : 'rotate(0deg)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
              >
                ▶
              </div>
            </Show>
            <span class="method-tag" id={`method-tag-${req().id}`}>
              {methodLabel()}
            </span>
            <Show when={multiInfo()}>
              <span class={`method-tag multi ${multiInfo()!.multiClass}`} style={{ 'font-size': '9px' }}>
                MULTI
              </span>
            </Show>
          </div>
          <span class={`status-indicator ${statusClass()}`} />
        </div>
        <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', width: '100%' }}>
          <div class="req-summary">
            {summary()}
          </div>
          <div class="req-time">{timeStr()}</div>
        </div>
      </div>

      {/* Sub-items for multicall */}
      <Show when={isMulticall() && expanded()}>
        <div class="sub-request-list" id={`sub-list-${req().id}`}>
          <For each={req().multicallData}>
            {(sub, idx) => {
              const subId = () => `${req().id}-${idx()}`;
              const subStatus = () => (sub.success ? 'success' : 'error');
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
                  <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                    <span class={`status-indicator ${subStatus()}`} style={{ width: '4px', height: '4px' }} />
                    <div style={{ 'font-family': "'JetBrains Mono', monospace", 'font-size': '11px', color: 'var(--text-secondary)' }}>
                      #{idx() + 1}{' '}
                      <span style={{ opacity: '0.7', 'font-size': '10px' }}>{subSelector()}</span>
                    </div>
                  </div>
                  <div style={{ 'font-size': '10px', opacity: '0.5', 'font-family': 'var(--font-mono)' }}>
                    {sub.target.substring(0, 8)}...
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
