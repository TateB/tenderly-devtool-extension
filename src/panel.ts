import { decodeFunctionData, decodeFunctionResult, type Hex } from 'viem';
import { EtherscanClient } from './etherscan';
import { MulticallDecoder } from './multicall';

// Interfaces
interface Config {
    tenderly_api_key?: string;
    etherscan_api_key?: string;
    tenderly_account_slug?: string;
    tenderly_project_slug?: string;
    tenderly_chain_id?: string;
    intercept_methods?: string[];
    intercept_reverted_only?: boolean;
}

interface RequestData {
    id: string;
    timestamp: Date;
    url: string;
    rpcRequest: any;
    rpcResponse: any;
    multicallData?: MulticallItem[];
}

interface MulticallItem {
    target: string;
    allowFailure: boolean;
    callData: string;
    success?: boolean;
    returnData?: string;
}

const splitView = document.getElementById('split-view') as HTMLElement;
const listElement = document.getElementById('request-list') as HTMLElement;
const detailContainer = document.getElementById('detaill-container') as HTMLElement;
const detailPlaceholder = document.getElementById('detail-placeholder') as HTMLElement;
const detailView = document.getElementById('detail-view') as HTMLElement;
const welcomeScreen = document.getElementById('welcome-screen') as HTMLElement;

// Settings View
const settingsView = document.getElementById('settings-view') as HTMLElement;
const navSettingsBtn = document.getElementById('nav-settings') as HTMLElement;
const closeSettingsBtn = document.getElementById('close-settings') as HTMLElement;
const saveStatus = document.getElementById('save-status') as HTMLElement;

// Welcome Actions
const btnOpenSettingsWelcome = document.getElementById('btn-open-settings-welcome') as HTMLButtonElement;

// Detail View Elements
const detailMethod = document.getElementById('detail-method') as HTMLElement;
const detailUrl = document.getElementById('detail-url') as HTMLElement;
const detailRequestCode = document.getElementById('detail-request-code') as HTMLElement;
const detailResponseCode = document.getElementById('detail-response-code') as HTMLElement;
const detailStatusIndicator = document.getElementById('detail-status-indicator') as HTMLElement;
const simulateBtn = document.getElementById('simulate-btn') as HTMLButtonElement;
const simulationResultContainer = document.getElementById('simulation-result-container') as HTMLElement;

// Config Inputs
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const accountSlugInput = document.getElementById('account-slug') as HTMLInputElement;
const projectSlugInput = document.getElementById('project-slug') as HTMLInputElement;
const chainIdInput = document.getElementById('chain-id-override') as HTMLInputElement;
const etherscanApiKeyInput = document.getElementById('etherscan-api-key') as HTMLInputElement;
const saveBtn = document.getElementById('save-config') as HTMLButtonElement;
const resetBtn = document.getElementById('reset-config') as HTMLButtonElement;

const interceptEstimateGasInput = document.getElementById('intercept-estimate-gas') as HTMLInputElement;
const interceptEthCallInput = document.getElementById('intercept-eth-call') as HTMLInputElement;
const interceptRevertedOnlyInput = document.getElementById('intercept-reverted-only') as HTMLInputElement;

// State
let requests: RequestData[] = []; 
let currentConfig: Config = {};
let etherscanClient: EtherscanClient | null = null;
let selectedRequestId: string | null = null;
const TABS = {
    REQUESTS: 'requests',
    SETTINGS: 'settings'
};
let activeTab = TABS.REQUESTS;

// --- Initialization ---

init();

function init() {
    loadConfig();
    setupEventListeners();
}

function setupEventListeners() {
    // Navigation
    if (navSettingsBtn) {
        navSettingsBtn.addEventListener('click', () => {
            switchTab(TABS.SETTINGS);
        });
    }

    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', () => {
            switchTab(TABS.REQUESTS);
        });
    }

    // Welcome Screen Action
    if (btnOpenSettingsWelcome) {
        btnOpenSettingsWelcome.addEventListener('click', () => {
            switchTab(TABS.SETTINGS);
        });
    }

    // Config Actions
    if (saveBtn) saveBtn.addEventListener('click', saveConfig);
    if (resetBtn) resetBtn.addEventListener('click', resetConfig);

    // Listen for network requests
    if (chrome.devtools && chrome.devtools.network) {
        chrome.devtools.network.onRequestFinished.addListener(handleRequest);
    }
}

function switchTab(tabName: string) {
    activeTab = tabName;
    
    if (tabName === TABS.SETTINGS) {
        loadConfig(); // Refresh config values when entering
        if (splitView) splitView.style.display = 'none';
        if (settingsView) settingsView.style.display = 'flex';
        // Hide settings button when in settings
        if (navSettingsBtn) navSettingsBtn.style.display = 'none';
    } else {
        if (settingsView) settingsView.style.display = 'none';
        if (splitView) splitView.style.display = 'flex';
        // Show settings button when in requests
        if (navSettingsBtn) navSettingsBtn.style.display = 'flex';
        updateViewState(); // Ensure correct detail/welcome/placeholder is shown
    }
}

// --- Configuration ---

function loadConfig() {
    const keys = [
        'tenderly_api_key', 
        'etherscan_api_key',
        'tenderly_account_slug', 
        'tenderly_project_slug', 
        'tenderly_chain_id',
        'intercept_methods',
        'intercept_reverted_only'
    ];

    chrome.storage.local.get(keys, (result) => {
        currentConfig = result as Config;


        // Populate Inputs
        if (apiKeyInput) apiKeyInput.value = currentConfig.tenderly_api_key || '';
        if (etherscanApiKeyInput) etherscanApiKeyInput.value = currentConfig.etherscan_api_key || '';
        if (accountSlugInput) accountSlugInput.value = currentConfig.tenderly_account_slug || '';
        if (projectSlugInput) projectSlugInput.value = currentConfig.tenderly_project_slug || '';
        if (chainIdInput) chainIdInput.value = currentConfig.tenderly_chain_id || '';

        // Checkboxes
        const methods = currentConfig.intercept_methods || ['eth_estimateGas']; 
        if (interceptEstimateGasInput) interceptEstimateGasInput.checked = methods.includes('eth_estimateGas');
        if (interceptEthCallInput) interceptEthCallInput.checked = methods.includes('eth_call');
        
        if (interceptRevertedOnlyInput) interceptRevertedOnlyInput.checked = !!currentConfig.intercept_reverted_only;
        
        // Update View State (Welcome/Placeholder/Detail)
        updateViewState();
        
        // Init Etherscan Client
        if (currentConfig.etherscan_api_key) {
            etherscanClient = new EtherscanClient(currentConfig.etherscan_api_key);
        } else {
            etherscanClient = null;
        }
    });
}

function updateViewState() {
    // Only affects Split View content
    const hasConfig = currentConfig.tenderly_api_key && currentConfig.tenderly_account_slug && currentConfig.tenderly_project_slug;
    
    if (!hasConfig) {
        // Show Welcome, Hide others
        if (welcomeScreen) welcomeScreen.style.display = 'flex';
        if (detailPlaceholder) detailPlaceholder.style.display = 'none';
        if (detailView) detailView.style.display = 'none';
    } else {
        // HIDE Welcome
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        
        // If nothing selected, show placeholder, else show detail
        if (selectedRequestId) {
             if (detailPlaceholder) detailPlaceholder.style.display = 'none';
             if (detailView) detailView.style.display = 'flex';
        } else {
             if (detailPlaceholder) detailPlaceholder.style.display = 'flex';
             if (detailView) detailView.style.display = 'none';
        }
    }
}

function saveConfig() {
    const key = apiKeyInput.value.trim();
    const etherscanKey = etherscanApiKeyInput.value.trim();
    const account = accountSlugInput.value.trim();
    const project = projectSlugInput.value.trim();
    const chainId = chainIdInput.value.trim();

    const methods: string[] = [];
    if (interceptEstimateGasInput.checked) methods.push('eth_estimateGas');
    if (interceptEthCallInput.checked) methods.push('eth_call');

    const revertedOnly = interceptRevertedOnlyInput.checked;

    const newSettings: Config = {
        'tenderly_api_key': key,
        'etherscan_api_key': etherscanKey,
        'tenderly_account_slug': account,
        'tenderly_project_slug': project,
        'tenderly_chain_id': chainId,
        'intercept_methods': methods,
        'intercept_reverted_only': revertedOnly
    };

    chrome.storage.local.set(newSettings, () => {
        currentConfig = newSettings;
        
        if (saveStatus) {
            saveStatus.style.opacity = '1';
            setTimeout(() => {
                saveStatus.style.opacity = '0';
            }, 2000);
        }
    });
}

function resetConfig() {
    if (confirm('Are you sure you want to reset all settings to default?')) {
        chrome.storage.local.clear(() => {
            if(apiKeyInput) apiKeyInput.value = '';
            if(etherscanApiKeyInput) etherscanApiKeyInput.value = '';
            if(accountSlugInput) accountSlugInput.value = '';
            if(projectSlugInput) projectSlugInput.value = '';
            if(chainIdInput) chainIdInput.value = '';
            if(interceptEstimateGasInput) interceptEstimateGasInput.checked = true;
            if(interceptEthCallInput) interceptEthCallInput.checked = false;
            if(interceptRevertedOnlyInput) interceptRevertedOnlyInput.checked = false;
            
            // Reload logic
            loadConfig(); 
        });
    }
}

// --- Request Handling ---

async function handleRequest(request: any) {
    if (request.request.method !== 'POST') return;
    
    // Check content type
    const contentTypeHeader = request.request.headers.find((h: any) => h.name.toLowerCase() === 'content-type');
    if (!contentTypeHeader || !contentTypeHeader.value.includes('application/json')) {
        return;
    }

    if (!request.request.postData || !request.request.postData.text) return;

    let requestBody;
    try {
        requestBody = JSON.parse(request.request.postData.text);
    } catch (e) {
        return; 
    }

    const rpcRequest = Array.isArray(requestBody) ? requestBody[0] : requestBody;
    if (!rpcRequest || !rpcRequest.method) return;

    // Filter by Method
    const allowedMethods = currentConfig.intercept_methods || ['eth_estimateGas'];
    if (!allowedMethods.includes(rpcRequest.method)) return;

    // Get Response Content to check for errors/reverts
    request.getContent((content: string, encoding: string) => {
        let rpcResponse: any = null;
        try {
            rpcResponse = JSON.parse(content);
        } catch(e) {}
        
        // Filter Reverted Only
        if (currentConfig.intercept_reverted_only) {
            if (!rpcResponse || !rpcResponse.error) return;
        }
        
        // Check for Multicall3
        let multicallData: MulticallItem[] | null = null;
        let to: string | undefined;

        if (rpcRequest.params && rpcRequest.params.length > 0) {
            const txParams = rpcRequest.params[0];
            to = txParams.to;
            const data = txParams.data;
            
            if (to && MulticallDecoder.isMulticall(to, data)) {
                 try {
                     const subCallsRaw = MulticallDecoder.decode(data);
                     
                     // subCallsRaw is array of {target, allowFailure, callData}
                     
                     let subResults: any[] = [];
                     if (rpcResponse && rpcResponse.result) {
                         subResults = MulticallDecoder.decodeResult(rpcResponse.result) as any[];
                     }
                     
                     // Merge calls with results
                    multicallData = (subCallsRaw as any[]).map((call, index) => {
                         const res = subResults[index] || {};
                         // call is {target, allowFailure, callData} from viem object
                         return {
                             target: call.target,
                             allowFailure: call.allowFailure,
                             callData: call.callData,
                             success: res.success,
                             returnData: res.returnData
                         };
                     });
                 } catch(err) {
                     console.error('Multicall Decode Error', err);
                 }
            }
        }

        if (to && to !== '0x' && etherscanClient) {
            detectNetwork(request.request.url).then(chainId => {
                 etherscanClient?.prefetch(to, chainId);
            });
        }

        const reqId = Date.now() + Math.random().toString();
        const reqData: RequestData = {
            id: reqId,
            timestamp: new Date(),
            url: request.request.url,
            rpcRequest,
            rpcResponse,
            multicallData: multicallData || undefined 
        };
        
        requests.push(reqData);
        addRequestToList(reqData);
    });
}

function addRequestToList(reqData: RequestData) {
    // Remove empty state if present
    const emptyState = listElement.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const item = document.createElement('div');
    item.className = 'request-item';
    item.dataset.id = reqData.id;
    item.role = 'button'; 
    item.tabIndex = 0;
    
    const isError = reqData.rpcResponse && reqData.rpcResponse.error;
    const statusClass = isError ? 'error' : 'success';
    
    const timeStr = reqData.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const isMulticall = !!reqData.multicallData;

    item.innerHTML = `
        <div class="req-header">
            <div style="display:flex; align-items:center; gap:6px;">
                ${isMulticall ? `<div class="expand-icon">▶</div>` : ''}
                <span class="method-tag">${reqData.rpcRequest.method}</span>
                ${isMulticall ? '<span class="method-tag" style="background:var(--accent-purple); color:white; font-size:9px;">MULTI</span>' : ''}
            </div>
            <span class="status-indicator ${statusClass}"></span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; width: 100%;">
             <div class="req-summary">${reqData.rpcRequest.params ? JSON.stringify(reqData.rpcRequest.params).substring(0, 30) : '[]'}...</div>
             <div class="req-time">${timeStr}</div>
        </div>
    `;

    if (isMulticall) {
        const iconInfo = item.querySelector('.expand-icon') as HTMLElement;
        if (iconInfo) {
            iconInfo.onclick = (e) => {
                e.stopPropagation();
                toggleMulticall(reqData.id);
            };
        }
    }

    item.onclick = () => selectRequest(reqData.id);
    item.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            selectRequest(reqData.id);
        }
    };

    // Prepend to list
    if (listElement) {
        // Wrap in container to hold main item + sublist
        const container = document.createElement('div');
        container.className = 'request-group';
        container.id = `req-group-${reqData.id}`;
        
        container.appendChild(item);
        
        if (isMulticall && reqData.multicallData) {
            const subList = document.createElement('div');
            subList.className = 'sub-request-list';
            subList.id = `sub-list-${reqData.id}`;
            subList.style.display = 'none'; // Hidden by default
            
            reqData.multicallData.forEach((sub, idx) => {
                const subItem = document.createElement('div');
                subItem.className = 'request-item sub-item';
                subItem.dataset.id = `${reqData.id}-${idx}`; // Composite ID
                subItem.dataset.parentId = reqData.id;
                subItem.dataset.subIndex = idx.toString();
                
                const subStatus = sub.success ? 'success' : 'error';
                
                subItem.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="status-indicator ${subStatus}" style="width:4px; height:4px;"></span>
                        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-secondary);">
                           Call #${idx + 1}
                        </div>
                    </div>
                    <div style="font-size:10px; opacity:0.5; font-family:var(--font-mono);">${sub.target.substring(0, 6)}...</div>
                `;
                
                subItem.onclick = (e) => {
                    e.stopPropagation();
                    selectRequest(reqData.id, idx);
                };
                
                subList.appendChild(subItem);
            });
            
            container.appendChild(subList);
        }
        
        listElement.insertBefore(container, listElement.firstChild);
    }

    // Auto-select if first AND we are not in Welcome Mode (which shouldn't happen if we have requests receiving, but logic should handle)
    const hasConfig = currentConfig.tenderly_api_key && currentConfig.tenderly_account_slug;
    if (requests.length === 1 && hasConfig) {
        selectRequest(reqData.id);
    }
}

function toggleMulticall(id: string) {
    const list = document.getElementById(`sub-list-${id}`);
    const grp = document.getElementById(`req-group-${id}`);
    
    if (list) {
        const isHidden = list.style.display === 'none';
        list.style.display = isHidden ? 'flex' : 'none';
        
        const icon = grp ? grp.querySelector('.expand-icon') as HTMLElement : null;
        if (icon) icon.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
    }
}

// backBtnHtml removed

function selectRequest(id: string, subReqIndex: number | null = null) {
    selectedRequestId = id;
    const reqData = requests.find(r => r.id === id);
    if (!reqData) return;

    // View State Update handled by updateViewState if we were switching contexts, but here we assume detail is accessible
    // Update List Selection
    document.querySelectorAll('.request-item').forEach(el => el.classList.remove('active'));
    
    if (subReqIndex !== null) {
        // Select Sub Item
        const subEl = document.querySelector(`.request-item[data-id="${id}-${subReqIndex}"]`);
        if (subEl) subEl.classList.add('active');
    } else {
        // Select Main Item
        const itemEl = document.querySelector(`.request-item[data-id="${id}"]`);
        if (itemEl) itemEl.classList.add('active');
    }

    updateViewState(); // Ensure correct container shown

    // Handle Multicall View
    const isSubRequest = subReqIndex !== null;

    // Prepare Detail View Header
    if (detailMethod) detailMethod.textContent = isSubRequest ? 'ETH_CALL (Sub)' : reqData.rpcRequest.method;
    if (detailUrl) detailUrl.textContent = reqData.url;
    
    // Clear Header extra elements (Contract Name)
    const existingContractName = document.getElementById('detail-contract-name');
    if (existingContractName) existingContractName.remove();

    // Sub Request Data extraction
    let displayReq = reqData.rpcRequest;
    let displayRes = reqData.rpcResponse;
    const isError = reqData.rpcResponse && reqData.rpcResponse.error;
    let simData: any = reqData; // Object to pass to performSimulation

    if (isSubRequest && reqData.multicallData) {
        const sub = reqData.multicallData[subReqIndex as number];
        if (sub) {
            const parentParams = reqData.rpcRequest.params ? reqData.rpcRequest.params[0] : {};
            
            // Construct pseudo RPC request for display
            displayReq = {
                method: 'eth_call',
                params: [{
                    to: sub.target,
                    data: sub.callData,
                    from: parentParams.from, // Inherit sender
                    gas: parentParams.gas    // Inherit gas
                }]
            };
            displayRes = sub.returnData ? { result: sub.returnData } : { error: { message: "Failed or no data" } };
            
            // Construct simData for sub-request
            simData = {
                url: reqData.url,
                rpcRequest: displayReq
            };
        }
    }

    // Status Indicator
    if (detailStatusIndicator) {
         let currentError = isError;
         if (isSubRequest && reqData.multicallData) {
              const sub = reqData.multicallData[subReqIndex as number];
              if (sub) currentError = !sub.success;
         }
         
         detailStatusIndicator.className = 'status-indicator ' + (currentError ? 'error' : 'success');
         detailStatusIndicator.title = currentError ? 'Request Failed' : 'Request Successful';
    }

    // --- REBUILD DETAIL BODY WITH COLLAPSIBLES ---
    const body = document.querySelector('.detail-body');
    if (body) {
        body.innerHTML = ''; // Clear everything

        // 1. Request Params
        const reqParamsContent = document.createElement('div');
        reqParamsContent.className = 'code-block';
        reqParamsContent.textContent = JSON.stringify(displayReq, null, 2);
        body.appendChild(createCollapsibleSection('Request Params', reqParamsContent, false));

        // 2. Decoded Input (Placeholder)
        const decodedInputContent = document.createElement('div');
        decodedInputContent.id = 'decoded-input-content';
        decodedInputContent.className = 'code-block';
        decodedInputContent.textContent = 'Loading...';
        const decodedInputSection = createCollapsibleSection('Decoded Input', decodedInputContent, true); // Default Open
        decodedInputSection.id = 'section-decoded-input';
        decodedInputSection.style.display = 'none'; // Hide until loaded
        body.appendChild(decodedInputSection);

        // 3. Response
        const responseContent = document.createElement('div');
        responseContent.className = 'code-block';
        responseContent.textContent = displayRes ? JSON.stringify(displayRes, null, 2) : 'No Response';
        body.appendChild(createCollapsibleSection('Response', responseContent, false));

         // 4. Decoded Output (Placeholder)
        const decodedOutputContent = document.createElement('div');
        decodedOutputContent.id = 'decoded-output-content';
        decodedOutputContent.className = 'code-block';
        decodedOutputContent.textContent = 'Loading...';
        const decodedOutputSection = createCollapsibleSection('Decoded Output', decodedOutputContent, false);
        decodedOutputSection.id = 'section-decoded-output';
        decodedOutputSection.style.display = 'none'; // Hide until loaded
        body.appendChild(decodedOutputSection);
    }

    // Reset Result Container
    if (simulationResultContainer) simulationResultContainer.innerHTML = '';

    // Reset Button
    if (simulateBtn) {
        simulateBtn.disabled = false;
        simulateBtn.style.background = ''; // reset to default css
        simulateBtn.innerHTML = '<span>Simulate Transaction</span>';
        simulateBtn.onclick = () => performSimulation(simData);
    }

    // Trigger metadata fetch & decoding
    decodeRequestIfPossible(reqData, subReqIndex);
}

// Function renderMulticallList removed.

// Override or update selectRequest standard path to ensure DOM is ready
// I'll modify the top of selectRequest to Restore DOM if needed.


// --- Simulation Logic ---

async function performSimulation(reqData: RequestData) {
    const btn = simulateBtn;
    const resultContainer = simulationResultContainer;
    
    // Check config
    const configRaw = await new Promise(resolve => chrome.storage.local.get(['tenderly_api_key', 'tenderly_account_slug', 'tenderly_project_slug', 'tenderly_chain_id'], resolve)) as Config;
    const config = configRaw; // define type
    
    if (!config.tenderly_api_key || !config.tenderly_account_slug || !config.tenderly_project_slug) {
        alert('Configuration missing. Please check Settings.');
        // settingsOverlay? No such var anymore.
        // if (settingsOverlay) settingsOverlay.classList.add('visible');
        switchTab(TABS.SETTINGS); // use switchTab instead
        return;
    }

    const { rpcRequest, url } = reqData;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span>Simulating...</span>';
    btn.disabled = true;
    if (resultContainer) resultContainer.innerHTML = '';

    try {
        let txParams: any, stateOverrides: any;

        if (rpcRequest.params && rpcRequest.params.length > 0) {
            txParams = rpcRequest.params[0];
             if (rpcRequest.params.length >= 3) {
                 stateOverrides = rpcRequest.params[2];
             }
        } else {
             throw new Error("Invalid params");
        }

        let networkId = config.tenderly_chain_id;
        if (!networkId) {
             networkId = await detectNetwork(url);
        }

        const simulationBody: any = {
            network_id: networkId,
            from: txParams.from || '0x0000000000000000000000000000000000000000',
            to: txParams.to,
            input: txParams.data || '0x',
            value: BigInt(txParams.value || 0).toString(),
            save: true,
            save_if_fails: true
        };

        if (txParams.gas) simulationBody.gas = parseInt(txParams.gas, 16);
        if (txParams.gasPrice) simulationBody.gas_price = BigInt(txParams.gasPrice).toString();
        
        if (stateOverrides) {
             simulationBody.state_objects = {} as any;
             // Use explicit casting to avoid never type inference issues
             const entries = Object.entries(stateOverrides) as [string, any][];
             for (const [address, override] of entries) {
                 simulationBody.state_objects[address] = {} as any;
                 if (override.balance) simulationBody.state_objects[address].balance = BigInt(override.balance).toString();
                 if (override.nonce) simulationBody.state_objects[address].nonce = parseInt(override.nonce, 16);
                 if (override.code) simulationBody.state_objects[address].code = override.code;
                 if (override.stateDiff) simulationBody.state_objects[address].storage = override.stateDiff;
                 else if (override.state) simulationBody.state_objects[address].storage = override.state;
             }
        }
        
        if (txParams.accessList) {
             simulationBody.access_list = txParams.accessList.map((item: any) => ({
                 address: item.address,
                 storage_keys: item.storageKeys || []
             }));
        }
        
        const response = await fetch(`https://api.tenderly.co/api/v1/account/${config.tenderly_account_slug}/project/${config.tenderly_project_slug}/simulate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Access-Key': config.tenderly_api_key as string
            },
            body: JSON.stringify(simulationBody)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const simulationId = data.simulation.id;
        const simStatus = data.simulation.status; // boolean usually
        
        // Share Simulation
        try {
            await fetch(`https://api.tenderly.co/api/v1/account/${config.tenderly_account_slug}/project/${config.tenderly_project_slug}/simulations/${simulationId}/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Key': config.tenderly_api_key as string
                }
            });
        } catch (shareErr) {
            console.warn('Share failed', shareErr);
        }

        // Success State
        btn.innerHTML = '<span>View Simulation</span>';
        btn.disabled = false;
        btn.onclick = () => {
             window.open(`https://www.tdly.co/shared/simulation/${simulationId}`, '_blank');
        };
        
        // Render Result Badge
        if (resultContainer) {
            const statusText = simStatus ? 'Success' : 'Reverted';
            const statusClass = simStatus ? 'success' : 'error';
            resultContainer.innerHTML = `<span class="sim-badge ${statusClass}">${statusText}</span>`;
        }

    } catch (err) {
        console.error(err);
        btn.innerHTML = '<span>Error</span>';
        btn.style.background = 'var(--accent-error)';
        
        if (resultContainer) {
            resultContainer.innerHTML = `<span class="sim-badge error">Failed</span>`;
        }
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.style.background = '';
            btn.onclick = () => performSimulation(reqData);
        }, 3000);
    }
}

async function detectNetwork(requestUrl: string) {
    if (!requestUrl) return '1';
    
    try {
        const response = await fetch(requestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_chainId',
                params: [],
                id: 1
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.result) {
                return parseInt(data.result, 16).toString();
            }
        }
    } catch (e) {
        console.warn('Network detection via RPC failed', e);
    }
    
    const lowerUrl = requestUrl.toLowerCase();
    
    if (lowerUrl.includes('sepolia')) return '11155111';
    if (lowerUrl.includes('holesky')) return '17000';
    if (lowerUrl.includes('goerli')) return '5'; 
    if (lowerUrl.includes('optimism') || lowerUrl.includes('opt')) return '10';
    if (lowerUrl.includes('arbitrum') || lowerUrl.includes('arb')) return '42161';
    if (lowerUrl.includes('polygon') || lowerUrl.includes('matic')) return '137';
    if (lowerUrl.includes('base')) return '8453';

    return '1'; 
}

async function decodeRequestIfPossible(reqData: RequestData, subIndex: number | null) {
    if (!etherscanClient) return;
    
    // Determine Target and Data
    let to: string | undefined;
    let data: string | undefined;
    let returnData: string | undefined;
    
    if (subIndex !== null && reqData.multicallData) {
         const sub = reqData.multicallData[subIndex];
         if (sub) {
             to = sub.target;
             data = sub.callData;
             returnData = sub.returnData;
         }
    } else {
        const params = reqData.rpcRequest.params?.[0];
        to = params?.to;
        data = params?.data;
        // Determine return data from rpcResponse
        if (reqData.rpcResponse && !reqData.rpcResponse.error) {
            returnData = reqData.rpcResponse.result;
        }
    }
    
    if (!to || !data || data === '0x') return;
    
    try {
        // Get Chain ID (async)
        const chainId = currentConfig.tenderly_chain_id || await detectNetwork(reqData.url);
        
        const metadata = await etherscanClient.getContractMetadata(to, chainId);
        
        // Verify same request
        if (selectedRequestId !== reqData.id) return;

        if (metadata) {
            const { contractName, abi } = metadata;

            // 1. Display Contract Name (if available)
            if (contractName) {
                 let nameEl = document.getElementById('detail-contract-name');
                 if (!nameEl) {
                     nameEl = document.createElement('div');
                     nameEl.id = 'detail-contract-name';
                     nameEl.style.fontSize = '12px';
                     nameEl.style.color = 'var(--text-secondary)';
                     nameEl.style.marginTop = '4px';
                     // Fix: Insert after detailUrl, inside its parent wrapper
                     if (detailUrl.parentNode) {
                        detailUrl.parentNode.insertBefore(nameEl, detailUrl.nextSibling);
                     }
                 }
                 nameEl.textContent = `Contract: ${contractName}`;
            }

            // 2. Decode Input
            try {
                const decoded = decodeFunctionData({ abi, data: data as Hex });
                if (detailMethod) {
                    detailMethod.textContent = decoded.functionName;
                }

                const decodedInputSection = document.getElementById('section-decoded-input');
                const decodedInputContent = document.getElementById('decoded-input-content');
                
                if (decodedInputSection && decodedInputContent) {
                    decodedInputSection.style.display = 'block';
                    decodedInputContent.textContent = JSON.stringify(decoded.args, (key, value) => 
                        typeof value === 'bigint' ? value.toString() : value
                    , 2);
                }

                // 3. Decode Output
                if (returnData && returnData !== '0x') {
                    try {
                        const decodedResult = decodeFunctionResult({
                            abi,
                            functionName: decoded.functionName,
                            data: returnData as Hex
                        });

                        const decodedOutputSection = document.getElementById('section-decoded-output');
                        const decodedOutputContent = document.getElementById('decoded-output-content');
                        
                        if (decodedOutputSection && decodedOutputContent) {
                            decodedOutputSection.style.display = 'block';
                            decodedOutputContent.textContent = JSON.stringify(decodedResult, (key, value) => 
                                typeof value === 'bigint' ? value.toString() : value
                            , 2);
                        }
                    } catch (err) {
                        console.warn('Output decode failed', err);
                    }
                }

            } catch (err) {
                // console.warn('Input decode failed', err);
            }
        }
    } catch (e) {
        // console.warn('Decode failed', e);
    }
}

function createCollapsibleSection(title: string, contentNode: HTMLElement, isOpen: boolean = false): HTMLElement {
    const container = document.createElement('div');
    container.className = 'collapsible-section';
    container.style.border = '1px solid var(--border-color)';
    container.style.borderRadius = '4px';
    container.style.marginBottom = '8px';
    container.style.overflow = 'hidden';

    // Header
    const header = document.createElement('div');
    header.style.padding = '8px 12px';
    header.style.background = 'var(--bg-secondary)';
    header.style.cursor = 'pointer';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.userSelect = 'none';

    const titleEl = document.createElement('span');
    titleEl.textContent = title;
    titleEl.style.fontWeight = '500';
    titleEl.style.fontSize = '12px';

    const icon = document.createElement('span');
    icon.textContent = '▼';
    icon.style.fontSize = '10px';
    icon.style.transition = 'transform 0.2s';
    icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(-90deg)';

    header.appendChild(titleEl);
    header.appendChild(icon);

    // Content Wrapper
    const content = document.createElement('div');
    content.style.display = isOpen ? 'block' : 'none';
    content.style.padding = '12px';
    content.style.background = 'var(--bg-primary)';
    content.style.borderTop = '1px solid var(--border-color)';
    
    content.appendChild(contentNode);

    // Interaction
    header.onclick = () => {
        const isCurrentlyOpen = content.style.display === 'block';
        content.style.display = isCurrentlyOpen ? 'none' : 'block';
        icon.style.transform = isCurrentlyOpen ? 'rotate(-90deg)' : 'rotate(0deg)';
    };

    container.appendChild(header);
    container.appendChild(content);

    return container;
}
