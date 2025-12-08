# Tenderly DevTools Helper

A Chrome DevTools extension that inspects `eth_estimateGas` JSON-RPC requests from the Network tab and enables one-click simulation via the Tenderly API.

## Features

- **Request Capture**: Automatically detects `eth_estimateGas` calls made by the current page.
- **Simulation**: Simulates transactions on Tenderly with preserved parameters including value, input data, and gas settings.
- **State Overrides**: Supports advanced simulation scenarios by respecting `stateOverrides` (balance, nonce, code, storage) from the original request.
- **Instant Feedback**: Displays transaction status (Success/Reverted) within the DevTools panel.
- **Deep Links**: clear direct links to the full simulation trace on the Tenderly dashboard.

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the project directory.

## Configuration

1. Open Chrome DevTools (Cmd+Option+I on Mac, Ctrl+Shift+I on Windows).
2. Navigate to the **Tenderly** tab.
3. Click the **Settings** icon in the top right.
4. Enter your Tenderly credentials:
   - **API Key**: Generated from your Tenderly dashboard settings.
   - **Account Slug**: Your username or organization name.
   - **Project Slug**: The specific project identifier.
5. Click **Save Configuration**.

## Usage

1. Navigate to any dApp or page that interacts with an Ethereum network.
2. Trigger an action that requires gas estimation (e.g., initiating a swap or transfer).
3. Open the **Tenderly** tab in DevTools.
4. Locate the captured request and click **Simulate**.
5. Once complete, click **View** to open the detailed simulation in Tenderly.
