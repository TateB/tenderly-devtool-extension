import { type Component, Show } from 'solid-js';
import DetailPlaceholder from './components/DetailPlaceholder';
import DetailView from './components/DetailView';
import Header from './components/Header';
import RequestList from './components/RequestList';
import SettingsView from './components/SettingsView';
import WelcomeScreen from './components/WelcomeScreen';
import { activeTab, hasConfig, selectedRequestId } from './lib/store';

const App: Component = () => {
  return (
    <div class="app-container">
      <Header />

      {/* Split View (requests tab) */}
      <Show when={activeTab() === 'requests'}>
        <div id="split-view" class="split-view">
          <RequestList />

          <main id="detaill-container" class="main-content">
            <Show
              when={hasConfig()}
              fallback={<WelcomeScreen />}
            >
              <Show
                when={selectedRequestId()}
                fallback={<DetailPlaceholder />}
              >
                <DetailView />
              </Show>
            </Show>
          </main>
        </div>
      </Show>

      {/* Settings View */}
      <Show when={activeTab() === 'settings'}>
        <SettingsView />
      </Show>
    </div>
  );
};

export default App;
