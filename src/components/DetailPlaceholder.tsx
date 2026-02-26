import { type Component } from 'solid-js';

const DetailPlaceholder: Component = () => {
  return (
    <div id="detail-placeholder" class="detail-placeholder">
      <div style={{ 'font-size': '48px', 'margin-bottom': '20px' }}>⚡️</div>
      <h3>Select a Request</h3>
      <p>View transaction details and simulate with Tenderly</p>
    </div>
  );
};

export default DetailPlaceholder;
