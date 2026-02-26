import { type Component, createSignal } from 'solid-js';
import { detectNetwork } from '../lib/network';
import { config } from '../lib/store';
import type { RequestData } from '../lib/types';

interface SimulateButtonProps {
  request: RequestData;
  subIndex: number | null;
}

const SimulateButton: Component<SimulateButtonProps> = (props) => {
  const [state, setState] = createSignal<'idle' | 'simulating' | 'success' | 'error'>('idle');
  const [simulationId, setSimulationId] = createSignal<string | null>(null);

  const getDisplayData = () => {
    const req = props.request;
    if (props.subIndex !== null && req.multicallData) {
      const sub = req.multicallData[props.subIndex];
      if (sub) {
        const parentParams = req.rpcRequest.params ? req.rpcRequest.params[0] : {};
        return {
          url: req.url,
          rpcRequest: {
            method: 'eth_call',
            params: [{
              to: sub.target,
              data: sub.callData,
              from: parentParams.from,
              gas: parentParams.gas,
            }],
          },
        };
      }
    }
    return { url: req.url, rpcRequest: req.rpcRequest };
  };

  const simulate = async () => {
    const cfg = config();
    if (!cfg.tenderly_api_key || !cfg.tenderly_account_slug || !cfg.tenderly_project_slug) {
      alert('Configuration missing. Please check Settings.');
      return;
    }

    setState('simulating');

    try {
      const displayData = getDisplayData();
      const { rpcRequest, url } = displayData;

      let txParams: any, stateOverrides: any;
      if (rpcRequest.params && rpcRequest.params.length > 0) {
        txParams = rpcRequest.params[0];
        if (rpcRequest.params.length >= 3) {
          stateOverrides = rpcRequest.params[2];
        }
      } else {
        throw new Error('Invalid params');
      }

      let networkId = cfg.tenderly_chain_id;
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
        save_if_fails: true,
      };

      if (txParams.gas) simulationBody.gas = parseInt(txParams.gas, 16);
      if (txParams.gasPrice) simulationBody.gas_price = BigInt(txParams.gasPrice).toString();

      if (stateOverrides) {
        simulationBody.state_objects = {} as any;
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
          storage_keys: item.storageKeys || [],
        }));
      }

      const response = await fetch(
        `https://api.tenderly.co/api/v1/account/${cfg.tenderly_account_slug}/project/${cfg.tenderly_project_slug}/simulate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Access-Key': cfg.tenderly_api_key!,
          },
          body: JSON.stringify(simulationBody),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      const simId = data.simulation.id;
      const simStatus = data.simulation.status;
      setSimulationId(simId);

      // Share simulation
      try {
        await fetch(
          `https://api.tenderly.co/api/v1/account/${cfg.tenderly_account_slug}/project/${cfg.tenderly_project_slug}/simulations/${simId}/share`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Access-Key': cfg.tenderly_api_key!,
            },
          }
        );
      } catch (shareErr) {
        console.warn('Share failed', shareErr);
      }

      setState(simStatus ? 'success' : 'error');
    } catch (err) {
      console.error(err);
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  const handleClick = () => {
    if (state() === 'success' && simulationId()) {
      window.open(`https://www.tdly.co/shared/simulation/${simulationId()}`, '_blank');
    } else if (state() === 'idle') {
      simulate();
    }
  };

  const buttonText = () => {
    switch (state()) {
      case 'simulating': return 'Simulating...';
      case 'success': return 'View Simulation';
      case 'error': return 'Error';
      default: return 'Simulate Transaction';
    }
  };

  return (
    <div class="detail-actions">
      <div id="simulation-result-container">
        {state() === 'success' && (
          <span class="sim-badge success">Success</span>
        )}
        {state() === 'error' && (
          <span class="sim-badge error">
            {simulationId() ? 'Reverted' : 'Failed'}
          </span>
        )}
      </div>
      <button
        id="simulate-btn"
        class="btn btn-primary"
        disabled={state() === 'simulating'}
        style={state() === 'error' && !simulationId() ? { background: 'var(--accent-error)' } : {}}
        onClick={handleClick}
      >
        <span>{buttonText()}</span>
      </button>
    </div>
  );
};

export default SimulateButton;
