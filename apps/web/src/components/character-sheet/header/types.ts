import type { CharacterWithNotes } from '@dolmenwood/types';

export interface CharacterSheetHeaderProps {
  character: CharacterWithNotes;
  editMode: boolean;
  onToggleEdit: () => void;
  onUpdate: (updates: Partial<CharacterWithNotes>) => void | Promise<void>;
  /** XP edits go through the dedicated adjust-xp route (logged server-side). */
  onAdjustXP?: (newTotal: number) => void | Promise<void>;
  /** dm-correction enables the XP editor on a read-only sheet (DM signed delta). */
  xpVariant?: 'owner' | 'dm-correction';
  onCorrectXP?: (delta: number) => void | Promise<void>;
  onBack: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
}
