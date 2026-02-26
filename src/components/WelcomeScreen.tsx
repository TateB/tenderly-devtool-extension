import { type Component } from 'solid-js';
import { setActiveTab } from '../lib/store';

const WelcomeScreen: Component = () => {
  return (
    <div id="welcome-screen" class="welcome-screen">
      <div class="placeholder-emoji lg">👋</div>
      <h3>Welcome to Tenderly DevTools</h3>
      <p>Connect your Tenderly account to simulate transactions and debug smart contracts directly from Chrome.</p>
      <button
        id="btn-open-settings-welcome"
        class="btn btn-primary"
        onClick={() => setActiveTab('settings')}
      >
        Setup Configuration
      </button>
    </div>
  );
};

export default WelcomeScreen;
