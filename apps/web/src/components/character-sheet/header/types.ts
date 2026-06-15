import type { CharacterWithNotes } from '@dolmenwood/types';

export interface CharacterSheetHeaderProps {
  character: CharacterWithNotes;
  editMode: boolean;
  onToggleEdit: () => void;
  onUpdate: (updates: Partial<CharacterWithNotes>) => void | Promise<void>;
  onBack: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
}
