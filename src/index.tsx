import { render } from 'solid-js/web';
import App from './App';
import { handleRequest, loadConfig } from './lib/store';

// Mount the app
const root = document.getElementById('root');
if (root) {
  render(() => <App />, root);
  root.setAttribute('data-ready', 'true');
}

// Initialize config and wire up DevTools API
loadConfig().then(() => {
  if (chrome.devtools && chrome.devtools.network) {
    chrome.devtools.network.onRequestFinished.addListener(handleRequest);
  }
  // Expose for E2E testing
  (window as any).__tenderly_handleRequest = handleRequest;
});
