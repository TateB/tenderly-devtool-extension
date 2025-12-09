// DOM Elements
const splitView = document.getElementById('split-view');
const listElement = document.getElementById('request-list');
const detailContainer = document.getElementById('detaill-container');
const detailPlaceholder = document.getElementById('detail-placeholder');
const detailView = document.getElementById('detail-view');
const welcomeScreen = document.getElementById('welcome-screen');

// Settings View
const settingsView = document.getElementById('settings-view');
const navSettingsBtn = document.getElementById('nav-settings');
const closeSettingsBtn = document.getElementById('close-settings');
const saveStatus = document.getElementById('save-status');

// Welcome Actions
const btnOpenSettingsWelcome = document.getElementById('btn-open-settings-welcome');

// Detail View Elements
const detailMethod = document.getElementById('detail-method');
const detailUrl = document.getElementById('detail-url');
const detailRequestCode = document.getElementById('detail-request-code');
const detailResponseCode = document.getElementById('detail-response-code');
const detailStatusIndicator = document.getElementById('detail-status-indicator');
const simulateBtn = document.getElementById('simulate-btn');
const simulationResultContainer = document.getElementById('simulation-result-container');

// Config Inputs
const apiKeyInput = document.getElementById('api-key');
const accountSlugInput = document.getElementById('account-slug');
const projectSlugInput = document.getElementById('project-slug');
const chainIdInput = document.getElementById('chain-id-override');
const saveBtn = document.getElementById('save-config');
const resetBtn = document.getElementById('reset-config');

const interceptEstimateGasInput = document.getElementById('intercept-estimate-gas');
const interceptEthCallInput = document.getElementById('intercept-eth-call');
const interceptRevertedOnlyInput = document.getElementById('intercept-reverted-only');

// State
let requests = []; // Store requests to easy access for details
let currentConfig = {};
let selectedRequestId = null;
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

function switchTab(tabName) {
    activeTab = tabName;
    // updateNavState(); // Removed as we no longer have tabs
    
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
        'tenderly_account_slug', 
        'tenderly_project_slug', 
        'tenderly_chain_id',
        'intercept_methods',
        'intercept_reverted_only'
    ];

    chrome.storage.local.get(keys, (result) => {
        currentConfig = result;

        // Populate Inputs
        if (apiKeyInput) apiKeyInput.value = result.tenderly_api_key || '';
        if (accountSlugInput) accountSlugInput.value = result.tenderly_account_slug || '';
        if (projectSlugInput) projectSlugInput.value = result.tenderly_project_slug || '';
        if (chainIdInput) chainIdInput.value = result.tenderly_chain_id || '';

        // Checkboxes
        const methods = result.intercept_methods || ['eth_estimateGas']; 
        if (interceptEstimateGasInput) interceptEstimateGasInput.checked = methods.includes('eth_estimateGas');
        if (interceptEthCallInput) interceptEthCallInput.checked = methods.includes('eth_call');
        
        if (interceptRevertedOnlyInput) interceptRevertedOnlyInput.checked = !!result.intercept_reverted_only;
        
        // Update View State (Welcome/Placeholder/Detail)
        updateViewState();
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
    const account = accountSlugInput.value.trim();
    const project = projectSlugInput.value.trim();
    const chainId = chainIdInput.value.trim();

    const methods = [];
    if (interceptEstimateGasInput.checked) methods.push('eth_estimateGas');
    if (interceptEthCallInput.checked) methods.push('eth_call');

    const revertedOnly = interceptRevertedOnlyInput.checked;

    const newSettings = {
        'tenderly_api_key': key,
        'tenderly_account_slug': account,
        'tenderly_project_slug': project,
        'tenderly_chain_id': chainId,
        'intercept_methods': methods,
        'intercept_reverted_only': revertedOnly
    };

    chrome.storage.local.set(newSettings, () => {
        currentConfig = newSettings;
        // Don't auto-switch; user might want to stay in settings.
        // Just show success.
        
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

async function handleRequest(request) {
    if (request.request.method !== 'POST') return;
    
    // Check content type
    const contentTypeHeader = request.request.headers.find(h => h.name.toLowerCase() === 'content-type');
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
    request.getContent((content, encoding) => {
        let rpcResponse = null;
        try {
            rpcResponse = JSON.parse(content);
        } catch(e) {}
        
        // Filter Reverted Only
        if (currentConfig.intercept_reverted_only) {
            if (!rpcResponse || !rpcResponse.error) return;
        }
        
        // Check for Multicall3
        let multicallData = null;
        if (rpcRequest.params && rpcRequest.params.length > 0) {
            const txParams = rpcRequest.params[0];
            const to = txParams.to;
            const data = txParams.data;
            
            if (MulticallDecoder.isMulticall(to, data)) {
                 try {
                     const subCalls = MulticallDecoder.decode(data);
                     
                     let subResults = [];
                     if (rpcResponse && rpcResponse.result) {
                         subResults = MulticallDecoder.decodeResult(rpcResponse.result);
                     }
                     
                     // Merge calls with results
                     multicallData = subCalls.map((call, index) => {
                         const res = subResults[index] || {};
                         return {
                             ...call,
                             success: res.success,
                             returnData: res.returnData
                         };
                     });
                 } catch(err) {
                     console.error('Multicall Decode Error', err);
                 }
            }
        }

        const reqId = Date.now() + Math.random().toString();
        const reqData = {
            id: reqId,
            timestamp: new Date(),
            url: request.request.url,
            rpcRequest,
            rpcResponse,
            multicallData // Array of { target, allowFailure, callData, success, returnData }
        };
        
        requests.push(reqData);
        addRequestToList(reqData);
    });
}

function addRequestToList(reqData) {
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
        const iconInfo = item.querySelector('.expand-icon');
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
        
        if (isMulticall) {
            const subList = document.createElement('div');
            subList.className = 'sub-request-list';
            subList.id = `sub-list-${reqData.id}`;
            subList.style.display = 'none'; // Hidden by default
            
            reqData.multicallData.forEach((sub, idx) => {
                const subItem = document.createElement('div');
                subItem.className = 'request-item sub-item';
                subItem.dataset.id = `${reqData.id}-${idx}`; // Composite ID
                subItem.dataset.parentId = reqData.id;
                subItem.dataset.subIndex = idx;
                
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

function toggleMulticall(id) {
    const list = document.getElementById(`sub-list-${id}`);
    const grp = document.getElementById(`req-group-${id}`);
    
    if (list) {
        const isHidden = list.style.display === 'none';
        list.style.display = isHidden ? 'flex' : 'none';
        
        const icon = grp.querySelector('.expand-icon');
        if (icon) icon.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
    }
}

// backBtnHtml removed

function selectRequest(id, subReqIndex = null) {
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
        // Ensure parent expanded? Maybe.
    } else {
        // Select Main Item
        // Note: Main item doesn't have data-id on the div generated in addRequestToList anymore... wait.
        // In addRequestToList: item.dataset.id = reqData.id. 
        // So querySelector by data-id should work for main item.
        const itemEl = document.querySelector(`.request-item[data-id="${id}"]`);
        if (itemEl) itemEl.classList.add('active');
    }

    updateViewState(); // Ensure correct container shown

    // Handle Multicall View
    const isMulticall = !!reqData.multicallData;
    const isSubRequest = subReqIndex !== null;

    // If it is multicall main item, show overview OR just standard view?
    // User: "subrequests should drop down... showing all requests".
    // If clicking main item, maybe just show standard view (the aggregate call).
    // Let's remove renderMulticallList usage and stick to standard view for main item.
    
    // Prepare Detail View
    if (detailMethod) detailMethod.textContent = isSubRequest ? 'ETH_CALL (Sub)' : reqData.rpcRequest.method;
    if (detailUrl) detailUrl.textContent = reqData.url;
    
    // Header Actions
    // Clear any inserted back button (Sidebar handles navigation now)
    const existingBack = document.getElementById('detail-back-btn');
    if (existingBack) existingBack.remove();

    // Sub Request Data extraction
    let displayReq = reqData.rpcRequest;
    let displayRes = reqData.rpcResponse;
    let isError = reqData.rpcResponse && reqData.rpcResponse.error;
    let simData = reqData; // Object to pass to performSimulation

    if (isSubRequest) {
        const sub = reqData.multicallData[subReqIndex];
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
        isError = !sub.success;
        
        // Construct simData for sub-request
        simData = {
            url: reqData.url,
            rpcRequest: displayReq
        };
    }

    // Status Indicator Description
    if (detailStatusIndicator) {
         detailStatusIndicator.className = 'status-indicator ' + (isError ? 'error' : 'success');
         detailStatusIndicator.title = isError ? 'Request Failed' : 'Request Successful';
    }

    // Ensure detail-body is clean (if we previously used renderMulticallList)
    const body = document.querySelector('.detail-body');
    if (body) {
        // If the body doesn't contain the standard containers, restore them
        // Actually, since we removed `renderMulticallList`, the body should stay consistent.
        // Just in case, if the user was on the old view.
        if (!document.getElementById('detail-request-code')) {
             body.innerHTML = `
                <div class="section-title">Request Params</div>
                <div id="detail-request-code" class="code-block">${JSON.stringify(displayReq, null, 2)}</div>

                <div class="section-title">Response</div>
                <div id="detail-response-code" class="code-block">${displayRes ? JSON.stringify(displayRes, null, 2) : 'No Response'}</div>
            `;
            // Reassign globals
             const reqCodeEl = document.getElementById('detail-request-code');
             const resCodeEl = document.getElementById('detail-response-code');
             // We can't reassign const globals. But textContent set above won't work if elements didn't exist.
             // But here we set innerHTML with content. So it's fine.
        } else {
             // Standard update
             if (detailRequestCode) detailRequestCode.textContent = JSON.stringify(displayReq, null, 2);
             if (detailResponseCode) detailResponseCode.textContent = displayRes ? JSON.stringify(displayRes, null, 2) : 'No Response';
        }
    }

    // Reset Result Container
    if (simulationResultContainer) simulationResultContainer.innerHTML = '';

    // Reset Button
    if (simulateBtn) {
        simulateBtn.disabled = false;
        simulateBtn.style.background = ''; // reset to default css
        simulateBtn.innerHTML = '<span>Simulate Transaction</span>';
        
        // Wire up Simulate Button
        simulateBtn.onclick = () => performSimulation(simData);
    }
}

// Function renderMulticallList removed.

// Override or update selectRequest standard path to ensure DOM is ready
// I'll modify the top of selectRequest to Restore DOM if needed.


// --- Simulation Logic ---

async function performSimulation(reqData) {
    const btn = simulateBtn;
    const resultContainer = simulationResultContainer;
    
    // Check config
    const config = await new Promise(resolve => chrome.storage.local.get(['tenderly_api_key', 'tenderly_account_slug', 'tenderly_project_slug', 'tenderly_chain_id'], resolve));
    
    if (!config.tenderly_api_key || !config.tenderly_account_slug || !config.tenderly_project_slug) {
        alert('Configuration missing. Please check Settings.');
        if (settingsOverlay) settingsOverlay.classList.add('visible');
        updateNavState('settings');
        return;
    }

    const { rpcRequest, url } = reqData;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span>Simulating...</span>';
    btn.disabled = true;
    if (resultContainer) resultContainer.innerHTML = '';

    try {
        let txParams, stateOverrides;

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

        const simulationBody = {
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
             simulationBody.state_objects = {};
             for (const [address, override] of Object.entries(stateOverrides)) {
                 simulationBody.state_objects[address] = {};
                 if (override.balance) simulationBody.state_objects[address].balance = BigInt(override.balance).toString();
                 if (override.nonce) simulationBody.state_objects[address].nonce = parseInt(override.nonce, 16);
                 if (override.code) simulationBody.state_objects[address].code = override.code;
                 if (override.stateDiff) simulationBody.state_objects[address].storage = override.stateDiff;
                 else if (override.state) simulationBody.state_objects[address].storage = override.state;
             }
        }
        
        if (txParams.accessList) {
             simulationBody.access_list = txParams.accessList.map(item => ({
                 address: item.address,
                 storage_keys: item.storageKeys || []
             }));
        }
        
        const response = await fetch(`https://api.tenderly.co/api/v1/account/${config.tenderly_account_slug}/project/${config.tenderly_project_slug}/simulate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Access-Key': config.tenderly_api_key
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
                    'X-Access-Key': config.tenderly_api_key
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

async function detectNetwork(requestUrl) {
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
