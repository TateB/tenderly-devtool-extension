import { type Component, Show, createSignal } from 'solid-js';
import { clearAbiCache, config, loadConfig, resetConfig as resetConfigStore, saveConfig, setActiveTab } from '../lib/store';
import type { Config } from '../lib/types';

const SettingsView: Component = () => {
  const [saveVisible, setSaveVisible] = createSignal(false);
  const [cacheCleared, setCacheCleared] = createSignal(false);

  // Local form state initialized from store config
  let apiKeyRef!: HTMLInputElement;
  let etherscanKeyRef!: HTMLInputElement;
  let accountSlugRef!: HTMLInputElement;
  let projectSlugRef!: HTMLInputElement;
  let chainIdRef!: HTMLInputElement;
  let estimateGasRef!: HTMLInputElement;
  let ethCallRef!: HTMLInputElement;
  let revertedOnlyRef!: HTMLInputElement;

  const currentConfig = () => config();

  const methods = () => currentConfig().intercept_methods || ['eth_estimateGas'];

  const handleSave = async () => {
    const newMethods: string[] = [];
    if (estimateGasRef.checked) newMethods.push('eth_estimateGas');
    if (ethCallRef.checked) newMethods.push('eth_call');

    const newConfig: Config = {
      tenderly_api_key: apiKeyRef.value.trim(),
      etherscan_api_key: etherscanKeyRef.value.trim(),
      tenderly_account_slug: accountSlugRef.value.trim(),
      tenderly_project_slug: projectSlugRef.value.trim(),
      tenderly_chain_id: chainIdRef.value.trim(),
      intercept_methods: newMethods,
      intercept_reverted_only: revertedOnlyRef.checked,
    };

    await saveConfig(newConfig);
    setSaveVisible(true);
    setTimeout(() => setSaveVisible(false), 2000);
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      await resetConfigStore();
      await loadConfig();
    }
  };

  return (
    <div id="settings-view" class="settings-view">
      <div class="settings-container">
        <div class="settings-header-page">
          <button
            id="close-settings"
            class="btn btn-back"
            onClick={() => setActiveTab('requests')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M12 19L5 12L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Back
          </button>
          <h2 class="settings-title">Settings</h2>
        </div>

        <div class="settings-body-page">
          <div class="settings-section">
            <h3 class="section-title">Tenderly API</h3>
            <div class="form-stack">
              <div class="form-group">
                <label>API Key</label>
                <input
                  type="password"
                  id="api-key"
                  placeholder="Tenderly API Key"
                  class="input-field"
                  ref={apiKeyRef}
                  value={currentConfig().tenderly_api_key || ''}
                />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Account Slug</label>
                  <input
                    type="text"
                    id="account-slug"
                    placeholder="Account Slug"
                    class="input-field"
                    ref={accountSlugRef}
                    value={currentConfig().tenderly_account_slug || ''}
                  />
                </div>
                <div class="form-group">
                  <label>Project Slug</label>
                  <input
                    type="text"
                    id="project-slug"
                    placeholder="Project Slug"
                    class="input-field"
                    ref={projectSlugRef}
                    value={currentConfig().tenderly_project_slug || ''}
                  />
                </div>
              </div>
              <div class="form-hint">
                Found in your Tenderly Dashboard URL or Project Settings.
              </div>
            </div>

            <div class="divider" />

            <h3 class="section-title">Etherscan API</h3>
            <div class="form-section-spacing">
              <div class="form-group">
                <label>Etherscan API Key</label>
                <input
                  type="password"
                  id="etherscan-api-key"
                  placeholder="Etherscan API Key"
                  class="input-field"
                  ref={etherscanKeyRef}
                  value={currentConfig().etherscan_api_key || ''}
                />
              </div>
              <div class="form-hint">
                Required for fetching contract ABIs automatically.
              </div>
            </div>

            <h3 class="section-title">Behavior</h3>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  id="intercept-estimate-gas"
                  ref={estimateGasRef}
                  checked={methods().includes('eth_estimateGas')}
                />{' '}
                Intercept eth_estimateGas
              </label>
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  id="intercept-eth-call"
                  ref={ethCallRef}
                  checked={methods().includes('eth_call')}
                />{' '}
                Intercept eth_call
              </label>
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  id="intercept-reverted-only"
                  ref={revertedOnlyRef}
                  checked={!!currentConfig().intercept_reverted_only}
                />{' '}
                Only intercept reverted calls
              </label>
            </div>

            <div class="divider" />

            <h3 class="section-title">Network</h3>
            <div class="form-section-spacing-lg">
              <div class="form-group">
                <label>Chain ID Override</label>
                <input
                  type="text"
                  id="chain-id-override"
                  placeholder="Force Chain ID (e.g., 1 for Mainnet)"
                  class="input-field"
                  ref={chainIdRef}
                  value={currentConfig().tenderly_chain_id || ''}
                />
              </div>
              <div class="form-hint">
                Optional: Force a specific Chain ID if auto-detection fails.
              </div>
            </div>

            <div class="button-row">
              <button id="save-config" class="btn btn-primary btn-save" onClick={handleSave}>
                Save Changes
              </button>
              <button id="reset-config" class="btn btn-secondary" onClick={handleReset}>
                Reset to Defaults
              </button>
            </div>
            <div
              id="save-status"
              class="save-status"
              style={{ opacity: saveVisible() ? '1' : '0' }}
            >
              Saved Successfully
            </div>

            <div class="divider" />

            <h3 class="section-title">Cache</h3>
            <div class="form-section-spacing">
              <div class="form-hint" style={{ "margin-bottom": "12px" }}>
                Contract ABIs and names are cached permanently and refreshed automatically after 7 days.
              </div>
              <button
                class="btn btn-secondary"
                onClick={async () => {
                  await clearAbiCache();
                  setCacheCleared(true);
                  setTimeout(() => setCacheCleared(false), 2000);
                }}
              >
                Clear ABI Cache
              </button>
              <Show when={cacheCleared()}>
                <span class="save-status" style={{ opacity: '1', "margin-left": "12px" }}>
                  Cache Cleared
                </span>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
