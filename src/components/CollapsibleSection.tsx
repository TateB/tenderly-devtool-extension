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
    <div class="collapsible-section" id={props.id}>
      <div class="collapsible-header" onClick={() => setOpen((o) => !o)}>
        <span class="collapsible-title">{props.title}</span>
        <span class={`collapsible-chevron ${open() ? 'open' : 'closed'}`}>
          ▼
        </span>
      </div>
      <div class={`collapsible-content ${open() ? 'open' : ''}`}>
        {props.children}
      </div>
    </div>
  );
};

export default CollapsibleSection;
