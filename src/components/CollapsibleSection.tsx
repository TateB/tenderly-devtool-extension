import { type Component, type JSX, createSignal } from 'solid-js';

interface CollapsibleSectionProps {
  title: string;
  isOpen?: boolean;
  id?: string;
  children: JSX.Element;
}

const CollapsibleSection: Component<CollapsibleSectionProps> = (props) => {
  const [open, setOpen] = createSignal(props.isOpen ?? false);

  return (
    <div
      class="collapsible-section"
      id={props.id}
      style={{
        border: '1px solid var(--border-color)',
        'border-radius': '4px',
        'margin-bottom': '8px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          background: 'var(--bg-secondary)',
          cursor: 'pointer',
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          'user-select': 'none',
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ 'font-weight': '500', 'font-size': '12px' }}>{props.title}</span>
        <span
          style={{
            'font-size': '10px',
            transition: 'transform 0.2s',
            transform: open() ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        >
          ▼
        </span>
      </div>
      <div
        style={{
          display: open() ? 'block' : 'none',
          padding: '12px',
          background: 'var(--bg-primary)',
          'border-top': '1px solid var(--border-color)',
        }}
      >
        {props.children}
      </div>
    </div>
  );
};

export default CollapsibleSection;
