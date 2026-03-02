import { Button } from '@/components/ui/button';

type WorkspaceToolbarProps = {
  onAddModule: () => void;
  onResetLayout: () => void;
};

export function WorkspaceToolbar({ onAddModule, onResetLayout }: WorkspaceToolbarProps) {
  return (
    <section className="workspace-toolbar">
      <p>
        Drag and drop modules to rearrange your workspace. Drop on empty canvas area to move a
        module to the end.
      </p>
      <div className="workspace-controls">
        <Button type="button" variant="soft" onClick={onAddModule}>
          Add Module
        </Button>
        <Button type="button" variant="soft" onClick={onResetLayout}>
          Reset Layout
        </Button>
      </div>
    </section>
  );
}

