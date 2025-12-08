
const listElement = document.getElementById('request-list');
// Maintain a reference to the empty state so we can restore it or hide it
const emptyStateHTML = `
    <div class="empty-state">
      <div class="empty-icon">📡</div>
      <p>Listening for <code>eth_estimateGas</code> requests...</p>
      <small>Requests will appear here as you browse.</small>
    </div>
`;

let hasRequests = false;

// Config Handling
const apiKeyInput = document.getElementById('api-key');
const accountSlugInput = document.getElementById('account-slug');
const projectSlugInput = document.getElementById('project-slug');
const saveBtn = document.getElementById('save-config');
const saveStatus = document.getElementById('save-status');
const configSection = document.getElementById('config-section');
const settingsToggle = document.getElementById('settings-toggle');

// Toggle Settings
settingsToggle.onclick = () => {
    configSection.style.display = configSection.style.display === 'none' ? 'block' : 'none';
};

// Load saved config
chrome.storage.local.get(['tenderly_api_key', 'tenderly_account_slug', 'tenderly_project_slug'], (result) => {
    if (result.tenderly_api_key) apiKeyInput.value = result.tenderly_api_key;
    if (result.tenderly_account_slug) accountSlugInput.value = result.tenderly_account_slug;
    if (result.tenderly_project_slug) projectSlugInput.value = result.tenderly_project_slug;
    
    // Auto-hide if all configured
    if (result.tenderly_api_key && result.tenderly_account_slug && result.tenderly_project_slug) {
        configSection.style.display = 'none';
    } else {
        configSection.style.display = 'block'; // Show if not configured
    }
});

saveBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    const account = accountSlugInput.value.trim();
    const project = projectSlugInput.value.trim();

    chrome.storage.local.set({
        'tenderly_api_key': key,
        'tenderly_account_slug': account,
        'tenderly_project_slug': project
    }, () => {
        saveStatus.style.display = 'block';
        setTimeout(() => saveStatus.style.display = 'none', 3000);
        // Hide config after save
        setTimeout(() => configSection.style.display = 'none', 1000);
    });
});

chrome.devtools.network.onRequestFinished.addListener(async (request) => {
    if (request.request.method !== 'POST') return;
    
    const contentTypeHeader = request.request.headers.find(h => h.name.toLowerCase() === 'content-type');
    if (!contentTypeHeader || !contentTypeHeader.value.includes('application/json')) {
        return;
    }

    if (!request.request.postData || !request.request.postData.text) return;

    try {
        const body = JSON.parse(request.request.postData.text);
        let rpcRequest = Array.isArray(body) ? body[0] : body;

        if (rpcRequest.method === 'eth_estimateGas') {
            addRequestToList(rpcRequest, request.request.url);
        }

    } catch (e) {
        // Not JSON
    }
});

function addRequestToList(rpcRequest, url) {
    if (!hasRequests) {
        listElement.innerHTML = '';
        hasRequests = true;
    }

    const item = document.createElement('li');
    item.className = 'request-item';

    const containerDiv = document.createElement('div');
    containerDiv.className = 'request-container';
    containerDiv.onclick = (e) => {
        // Only toggle if not clicking interactive elements inside
        if (['BUTTON', 'A', 'INPUT'].includes(e.target.tagName)) return;
        item.classList.toggle('expanded');
    };

    const infoDiv = document.createElement('div');
    infoDiv.className = 'request-info';
    
    const methodBadge = document.createElement('span');
    methodBadge.className = 'method-badge';
    methodBadge.textContent = rpcRequest.method;
    
    const paramsPreview = document.createElement('span');
    paramsPreview.className = 'url-text';
    try {
        const paramsStr = JSON.stringify(rpcRequest.params);
        paramsPreview.textContent = paramsStr;
    } catch(e) {}

    infoDiv.appendChild(methodBadge);
    infoDiv.appendChild(paramsPreview);

    const actionContainer = document.createElement('div');
    actionContainer.style.display = 'flex';
    actionContainer.style.alignItems = 'center';
    actionContainer.style.gap = '8px';

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
    
    // Pretty print JSON
    const pre = document.createElement('pre');
    pre.style.margin = '0';
    pre.textContent = JSON.stringify(rpcRequest, null, 2);
    detailsDiv.appendChild(pre);

    item.appendChild(containerDiv);
    item.appendChild(detailsDiv);

    // Prepend to list (newest first)
    listElement.insertBefore(item, listElement.firstChild);
}

async function simulateTransaction(rpcRequest, url, btn, container) {
    // Get config
    const config = await new Promise(resolve => chrome.storage.local.get(['tenderly_api_key', 'tenderly_account_slug', 'tenderly_project_slug'], resolve));
    
    if (!config.tenderly_api_key || !config.tenderly_account_slug || !config.tenderly_project_slug) {
        alert('Please configure API Key, Account Slug, and Project Slug first (click the settings icon).');
        configSection.style.display = 'block';
        return;
    }

    const originalText = btn.innerHTML;
    btn.innerHTML = '<span>Simulating...</span>';
    btn.disabled = true;

    try {
        const txParams = rpcRequest.params[0];
        const stateOverrides = rpcRequest.params[2];

        const networkId = detectNetwork(url);

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
        
        // 1. Execute Simulation
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

        // 2. Share Simulation
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

function detectNetwork(requestUrl) {
    if (!requestUrl) return '1'; 
    const lowerUrl = requestUrl.toLowerCase();
    
    if (lowerUrl.includes('sepolia')) return '11155111';
    if (lowerUrl.includes('holesky')) return '17000';
    if (lowerUrl.includes('goerli')) return '5'; 
    if (lowerUrl.includes('mainnet') || lowerUrl.includes('eth')) return '1'; 

    return '1'; 
}
