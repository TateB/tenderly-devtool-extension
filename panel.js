
// DOM Elements
const listElement = document.getElementById('request-list');
const saveStatus = document.getElementById('save-status');

// Tabs
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const welcomeScreen = document.getElementById('welcome-screen');
const getStartedBtn = document.getElementById('get-started-btn');

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
let hasRequests = false;
let currentConfig = {};

// --- Initialization ---

init();

function init() {
    setupTabs();
    loadConfig();
    setupEventListeners();
}

function setupTabs() {
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // Update Buttons
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update Content
            tabContents.forEach(c => {
                c.classList.remove('active');
                if (c.id === `tab-${tabName}`) c.classList.add('active');
            });
        });
    });

    // Sub-Tabs Logic
    function initSubTabs() {
        const subTabButtons = document.querySelectorAll('.sub-tab-btn');
        const subTabContents = document.querySelectorAll('.sub-tab-content');

        if (!subTabButtons.length) return;

        subTabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const subTabName = btn.dataset.subtab;
                
                // Update Buttons
                subTabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update Content
                subTabContents.forEach(c => {
                    c.classList.remove('active');
                    if (c.id === `subtab-${subTabName}`) c.classList.add('active');
                });
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSubTabs);
    } else {
        initSubTabs();
    }

    getStartedBtn.addEventListener('click', () => {
        welcomeScreen.style.display = 'none';
        const settingsTabBtn = document.querySelector('[data-tab="settings"]');
        if (settingsTabBtn) settingsTabBtn.click();
    });
}

function setupEventListeners() {
    saveBtn.addEventListener('click', saveConfig);
    resetBtn.addEventListener('click', resetConfig);
    
    // Listen for network refquests
    chrome.devtools.network.onRequestFinished.addListener(handleRequest);
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
        if (result.tenderly_api_key) apiKeyInput.value = result.tenderly_api_key;
        if (result.tenderly_account_slug) accountSlugInput.value = result.tenderly_account_slug;
        if (result.tenderly_project_slug) projectSlugInput.value = result.tenderly_project_slug;
        if (result.tenderly_chain_id) chainIdInput.value = result.tenderly_chain_id;

        // Checkboxes
        // Default to estimateGas if undefined
        const methods = result.intercept_methods || ['eth_estimateGas']; 
        interceptEstimateGasInput.checked = methods.includes('eth_estimateGas');
        interceptEthCallInput.checked = methods.includes('eth_call');
        
        interceptRevertedOnlyInput.checked = !!result.intercept_reverted_only;

        // Show Welcome Screen if no API key
        if (!result.tenderly_api_key) {
            welcomeScreen.style.display = 'flex';
        } else {
            welcomeScreen.style.display = 'none';
        }
    });
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
        saveStatus.style.display = 'block';
        setTimeout(() => saveStatus.style.display = 'none', 3000);
        
        // If we just set the key, hide welcome screen
        if (key) {
            welcomeScreen.style.display = 'none';
        }
    });
}

function resetConfig() {
    if (confirm('Are you sure you want to reset all settings to default?')) {
        chrome.storage.local.clear(() => {
            // Restore defaults for checkoxes visually or just reload
            apiKeyInput.value = '';
            accountSlugInput.value = '';
            projectSlugInput.value = '';
            chainIdInput.value = '';
            interceptEstimateGasInput.checked = true;
            interceptEthCallInput.checked = false;
            interceptRevertedOnlyInput.checked = false;
            
            // Reload from storage (which is now empty) effectively resets logic
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
        return; // Not JSON
    }

    // Support batch requests? For now handle single or first of batch
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
            // If no error in response, ignore
            if (!rpcResponse || !rpcResponse.error) return;
        }

        addRequestToList(rpcRequest, rpcResponse, request.request.url);
    });
}

function addRequestToList(rpcRequest, rpcResponse, url) {
    if (!hasRequests) {
        listElement.innerHTML = '';
        hasRequests = true;
    }

    const item = document.createElement('li');
    item.className = 'request-item';

    const containerDiv = document.createElement('div');
    containerDiv.className = 'request-container';
    containerDiv.onclick = (e) => {
        if (['BUTTON', 'A', 'INPUT'].includes(e.target.tagName)) return;
        item.classList.toggle('expanded');
    };

    const infoDiv = document.createElement('div');
    infoDiv.className = 'request-info';
    
    // Badge & Status Row
    const badgeRow = document.createElement('div');
    badgeRow.style.display = 'flex';
    badgeRow.style.alignItems = 'center';
    badgeRow.style.gap = '8px';

    const methodBadge = document.createElement('span');
    methodBadge.className = 'method-badge';
    methodBadge.textContent = rpcRequest.method;
    
    badgeRow.appendChild(methodBadge);

    // RPC Result Status
    if (rpcResponse) {
        const statusBadge = document.createElement('span');
        statusBadge.style.fontSize = '11px';
        statusBadge.style.fontWeight = '600';
        
        if (rpcResponse.error) {
            statusBadge.style.color = 'var(--accent-error)';
            statusBadge.textContent = 'Failed';
        } else {
            statusBadge.style.color = 'var(--accent-success)';
            statusBadge.textContent = 'Success';
        }
        badgeRow.appendChild(statusBadge);
    }

    const paramsPreview = document.createElement('span');
    paramsPreview.className = 'url-text';
    try {
        const paramsStr = JSON.stringify(rpcRequest.params);
        paramsPreview.textContent = paramsStr;
    } catch(e) {}

    infoDiv.appendChild(badgeRow);
    infoDiv.appendChild(paramsPreview);

    const actionContainer = document.createElement('div');
    actionContainer.className = 'action-container';

    const btn = document.createElement('button');
    btn.className = 'btn-primary';
    btn.innerHTML = '<span>Simulate</span>';
    btn.onclick = async (e) => {
        e.stopPropagation();
        await simulateTransaction(rpcRequest, url, btn, actionContainer);
    };

    actionContainer.appendChild(btn);
    containerDiv.appendChild(infoDiv);
    containerDiv.appendChild(actionContainer);

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'request-details';
    
    // Pretty print JSON (Request & Response)
    const reqTitle = document.createElement('div');
    reqTitle.textContent = "Request:";
    reqTitle.style.fontWeight = 'bold';
    reqTitle.style.marginBottom = '4px';
    detailsDiv.appendChild(reqTitle);

    const preReq = document.createElement('pre');
    preReq.style.margin = '0 0 12px 0';
    preReq.textContent = JSON.stringify(rpcRequest, null, 2);
    detailsDiv.appendChild(preReq);

    if (rpcResponse) {
        const resTitle = document.createElement('div');
        resTitle.textContent = "Response:";
        resTitle.style.fontWeight = 'bold';
        resTitle.style.marginBottom = '4px';
        detailsDiv.appendChild(resTitle);

        const preRes = document.createElement('pre');
        preRes.style.margin = '0';
        preRes.textContent = JSON.stringify(rpcResponse, null, 2);
        detailsDiv.appendChild(preRes);
    }

    item.appendChild(containerDiv);
    item.appendChild(detailsDiv);

    listElement.insertBefore(item, listElement.firstChild);
}

// --- Simulation Logic ---

async function simulateTransaction(rpcRequest, url, btn, container) {
    // Re-fetch config to be safe
    const config = await new Promise(resolve => chrome.storage.local.get(['tenderly_api_key', 'tenderly_account_slug', 'tenderly_project_slug', 'tenderly_chain_id'], resolve));
    
    if (!config.tenderly_api_key || !config.tenderly_account_slug || !config.tenderly_project_slug) {
        alert('Configuration missing. Please check the Settings tab.');
        return;
    }

    const originalText = btn.innerHTML;
    btn.innerHTML = '<span>Simulating...</span>';
    btn.disabled = true;

    try {
        let txParams, stateOverrides;

        // Handle both eth_estimateGas and eth_call which usually share [tx, block/state] structure
        // But for eth_call, the 2nd param is usually block tag.
        
        if (rpcRequest.params && rpcRequest.params.length > 0) {
            txParams = rpcRequest.params[0];
            
            // Check for state overrides in varying positions depending on method/client
            // Standard eth_estimateGas: [tx, block, stateOverrides] or [tx, stateOverrides] ?
            // Actually geth: [call, block] or [call]
            // We'll try to find an object that looks like state overrides if it exists
            // For now, let's just stick to the previous index logic slightly guarded
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

        // Map params to Renderly Simulation structure
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
        
        // State Overrides mapping
        if (stateOverrides) {
             simulationBody.state_objects = {};
             for (const [address, override] of Object.entries(stateOverrides)) {
                 simulationBody.state_objects[address] = {};
                 if (override.balance) {
                     simulationBody.state_objects[address].balance = BigInt(override.balance).toString();
                 }
                 if (override.nonce) {
                      simulationBody.state_objects[address].nonce = parseInt(override.nonce, 16);
                 }
                 if (override.code) {
                      simulationBody.state_objects[address].code = override.code;
                 }
                 if (override.stateDiff) {
                     simulationBody.state_objects[address].storage = override.stateDiff;
                 } else if (override.state) {
                     simulationBody.state_objects[address].storage = override.state;
                 }
             }
        }
        
        // Support Access List
        if (txParams.accessList) {
             simulationBody.access_list = txParams.accessList.map(item => ({
                 address: item.address,
                 storage_keys: item.storageKeys || []
             }));
        }
        
        // Execute Simulation
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
        const status = data.simulation.status; 

        // Share Simulation (make it public)
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

        // Update UI
        btn.style.display = 'none'; // Hide button

        // Status Indicator
        const statusSpan = document.createElement('span');
        if (status === true) {
            statusSpan.className = 'status-success';
            statusSpan.innerHTML = '<span>Success</span>';
        } else {
            statusSpan.className = 'status-error';
            statusSpan.innerHTML = '<span>Reverted</span>';
        }
        
        const link = document.createElement('a');
        link.className = 'link-external';
        link.textContent = 'View →';
        link.href = `https://www.tdly.co/shared/simulation/${simulationId}`;
        link.target = '_blank';
        
        container.appendChild(statusSpan);
        container.appendChild(link);

    } catch (err) {
        console.error(err);
        btn.innerHTML = '<span>Error</span>';
        btn.title = err.message;
        btn.style.backgroundColor = 'var(--accent-error)';
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.style.backgroundColor = '';
        }, 3000);
    }
}

async function detectNetwork(requestUrl) {
    if (!requestUrl) return '1';
    
    // Attempt RPC call to get chainId
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
