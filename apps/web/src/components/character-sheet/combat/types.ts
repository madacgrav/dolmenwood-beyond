export const MOUNT_TYPES = ['Horse', 'Mule', 'Dog', 'Pony', 'Other'] as const;
export type MountType = typeof MOUNT_TYPES[number];

/** Form state for the "Add Mount" panel. */
export interface NewMountState {
  name: string;
  mount_type: MountType;
  speed: number;
  has_full_stats: boolean;
  ac: number;
  hp_max: number;
  attack_bonus: number;
  morale: number;
}
