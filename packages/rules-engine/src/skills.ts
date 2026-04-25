import skillData from './data/skills.json';

export interface SkillEntry {
  name: string;
  target: number;
  isUniversal: boolean;
}

interface UniversalSkill {
  name: string;
  defaultTarget: number;
  description: string;
  kindredModifiers?: { kindred: string; target: number; condition?: string }[];
}

interface ClassSkillData {
  skills: string[];
  targets: Record<string, number>[];
}

// Map camelCase skill keys to display names for class-based skills
const SKILL_KEY_TO_NAME: Record<string, string> = {
  decipherDoc: 'Decipher Document',
  legerdemain: 'Legerdemain',
  listen: 'Listen',
  monsterLore: 'Monster Lore',
  alertness: 'Alertness',
  stalking: 'Stalking',
  survival: 'Survival',
  tracking: 'Tracking',
  detectMagic: 'Detect Magic',
  climbWall: 'Climb Wall',
  disarmMech: 'Disarm Mechanism',
  pickLock: 'Pick Lock',
  search: 'Search',
  stealth: 'Stealth',
};

export function getUniversalSkills(kindred?: string): SkillEntry[] {
  const universal = skillData.universal as { skills: UniversalSkill[] };
  return universal.skills.map((skill) => {
    let target = skill.defaultTarget;
    if (kindred) {
      const kindredMod = skill.kindredModifiers?.find((m) => m.kindred === kindred);
      if (kindredMod) target = kindredMod.target;
    }
    return { name: skill.name, target, isUniversal: true };
  });
}

export function getClassSkills(className: string, level: number): SkillEntry[] {
  const classBased = skillData.classBased as Record<string, ClassSkillData>;
  const classEntry = classBased[className];
  if (!classEntry) return [];

  const levelRow = classEntry.targets.find((r) => r['level'] === level) ?? classEntry.targets[classEntry.targets.length - 1];
  if (!levelRow) return [];

  return classEntry.skills.map((skillName) => {
    // Find the camelCase key for this skill name
    const key = Object.entries(SKILL_KEY_TO_NAME).find(([, v]) => v === skillName)?.[0];
    const target = key && levelRow[key] !== undefined ? (levelRow[key] as number) : 6;
    return { name: skillName, target, isUniversal: false };
  });
}

export function getAllSkills(className: string, level: number, kindred?: string): SkillEntry[] {
  return [...getUniversalSkills(kindred), ...getClassSkills(className, level)];
}
