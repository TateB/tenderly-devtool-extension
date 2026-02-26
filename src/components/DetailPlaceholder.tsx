import { type Component } from 'solid-js';

const DetailPlaceholder: Component = () => {
  return (
    <div id="detail-placeholder" class="detail-placeholder">
      <div class="placeholder-emoji">⚡️</div>
      <h3>Select a Request</h3>
      <p>View transaction details and simulate with Tenderly</p>
    </div>
  );
};

export default DetailPlaceholder;
