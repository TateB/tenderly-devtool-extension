# Tenderly DevTools Helper

A Chrome DevTools extension that inspects Ethereum JSON-RPC requests from the Network tab and enables one-click simulation via the Tenderly API.

## Features

- **Request Capture**: Automatically intercepts `eth_estimateGas` and optionally `eth_call` requests.
- **Simulation**: Simulates transactions on Tenderly, preserving parameters, state overrides, and context.
- **Integrated UI**: Split-view interface with a request list and detailed inspection panel.
- **Configuration**: Full control over intercepted methods, network detection sequences, and project credentials.
- **Direct Links**: Specific links to full simulation traces on the Tenderly dashboard.

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top right.
4. Click **Load unpacked** and select the project directory.

## Configuration

1. Open Chrome DevTools.
2. Navigate to the **Tenderly** tab.
3. Click **Settings** in the header or **Setup Configuration** on the welcome screen.
4. Enter your Tenderly credentials:
   - **API Key**: From Tenderly dashboard settings.
   - **Account Slug**: Your username or organization.
   - **Project Slug**: The target project.
5. Configure behavior:
   - **Intercept eth_estimateGas**: Toggle capturing of gas estimation calls.
   - **Intercept eth_call**: Toggle capturing of read-only calls.
   - **Only intercept reverted calls**: Filter for failed requests only.
6. Network settings:
   - **Chain ID Override**: Manually specify a chain ID if auto-detection fails.

## Usage

1. Navigate to a dApp interacting with an Ethereum network.
2. Trigger a transaction or action.
3. Open the **Tenderly** tab in DevTools.
4. Select a captured request from the list.
5. Click **Simulate** in the details panel.
6. Click **View Simulation** to open the trace in Tenderly.
