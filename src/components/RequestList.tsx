import { type Component, For, Show } from 'solid-js';
import { requests } from '../lib/store';
import RequestItem from './RequestItem';

const RequestList: Component = () => {
  return (
    <aside class="sidebar">
      <div id="request-list" class="request-list-container">
        <Show
          when={requests.length > 0}
          fallback={
            <div class="empty-state">
              <div class="empty-icon">📡</div>
              <p>Waiting for requests...</p>
              <div style={{ 'font-size': '11px', opacity: '0.6', 'margin-top': '4px' }}>
                Interact with your dApp
              </div>
            </div>
          }
        >
          <For each={requests}>
            {(req) => <RequestItem request={req} />}
          </For>
        </Show>
      </div>
    </aside>
  );
};

export default RequestList;
