/**
 * Pure utility functions extracted from panel.ts for testability.
 * These have no DOM dependencies and can be safely imported in unit tests.
 */

/**
 * Detects a chain ID from the RPC endpoint URL using keyword heuristics.
 * Returns '1' (mainnet) as the default fallback.
 */
export function detectNetworkFromUrl(requestUrl: string): string {
    if (!requestUrl) return '1';
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

/**
 * Renders decoded ABI params into an HTML string for display in the detail view.
 */
export function renderDecodedParams(args: any): string {
    if (!args) return '<div style="padding:12px; color:var(--text-muted);">No parameters</div>';
    
    // Check if empty array or object
    if (Array.isArray(args) && args.length === 0) return '<div style="padding:12px; color:var(--text-muted);">No parameters</div>';
    if (typeof args === 'object' && Object.keys(args).length === 0) return '<div style="padding:12px; color:var(--text-muted);">No parameters</div>';

    let html = '<div class="decoded-params-list">';
    
    if (typeof args === 'object' && args !== null) {
         const keys = Object.keys(args);
         // Check if we have any non-numeric keys (named params)
         const hasNamed = keys.some(k => !/^\d+$/.test(k));

         Object.entries(args).forEach(([key, value]) => {
             // If we have named parameters, skip the numeric indices to avoid duplication
             if (hasNamed && /^\d+$/.test(key)) return;

             let label = key;
             let valStr = String(value);
             
             if (typeof value === 'object') {
                 valStr = JSON.stringify(value, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2);
             } else if (typeof value === 'bigint') {
                 valStr = value.toString();
             }
             
             html += `
                <div class="decoded-param-row">
                    <div class="decoded-param-label">${label}</div>
                    <div class="decoded-param-value">${valStr}</div>
                </div>
             `;
         });
    } else {
        // Primitive?
        html += `<div style="padding:12px;">${args}</div>`;
    }
    
    html += '</div>';
    return html;
}

/**
 * Creates a collapsible section UI element with a clickable header.
 */
export function createCollapsibleSection(title: string, contentNode: HTMLElement, isOpen: boolean = false): HTMLElement {
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
