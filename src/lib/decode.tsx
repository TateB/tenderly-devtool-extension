import { type Component, For, Show } from 'solid-js';

interface DecodedParamsProps {
  args: any;
}

/**
 * Renders decoded ABI params as a Solid component.
 */
const DecodedParams: Component<DecodedParamsProps> = (props) => {
  const isEmpty = () => {
    const a = props.args;
    if (!a) return true;
    if (Array.isArray(a) && a.length === 0) return true;
    if (typeof a === 'object' && Object.keys(a).length === 0) return true;
    return false;
  };

  const entries = () => {
    const a = props.args;
    if (!a || typeof a !== 'object') return [];

    const keys = Object.keys(a);
    const hasNamed = keys.some((k) => !/^\d+$/.test(k));

    return Object.entries(a)
      .filter(([key]) => !(hasNamed && /^\d+$/.test(key)))
      .map(([key, value]) => ({
        key,
        value: formatValue(value),
      }));
  };

  return (
    <Show
      when={!isEmpty()}
      fallback={
        <div class="decode-empty-text">No parameters</div>
      }
    >
      <Show
        when={typeof props.args === 'object' && props.args !== null}
        fallback={<div class="decode-raw-text">{String(props.args)}</div>}
      >
        <div class="decoded-params-list">
          <For each={entries()}>
            {(entry) => (
              <div class="decoded-param-row">
                <div class="decoded-param-label">{entry.key}</div>
                <div class="decoded-param-value">{entry.value}</div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </Show>
  );
};

function formatValue(value: any): string {
  if (typeof value === 'object') {
    return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return String(value);
}

export default DecodedParams;
