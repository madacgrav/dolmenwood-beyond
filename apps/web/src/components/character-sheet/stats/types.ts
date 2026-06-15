import type { Kindred, CharacterClass } from '@dolmenwood/types';

export const KINDREDS: Kindred[] = ['Human', 'Breggle', 'Elf', 'Grimalkin', 'Mossling', 'Woodgrue'];
export const CHARACTER_CLASSES: CharacterClass[] = ['Bard', 'Cleric', 'Enchanter', 'Fighter', 'Friar', 'Hunter', 'Knight', 'Magician', 'Thief'];

/** Form state for the "New Retainer" panel. */
export interface NewRetainerState {
  name: string;
  kindred: string;
  character_class: string;
  level: number;
  ac: number;
  hp_current: number;
  hp_max: number;
  attack_bonus: number;
  morale: number;
  loyalty: number;
  wage_type: 'daily' | 'share';
  wage_amount: number;
}
