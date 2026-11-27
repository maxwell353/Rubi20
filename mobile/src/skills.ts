export const attributes = ['For', 'Des', 'Con', 'Int', 'Sab', 'Car'] as const;
export type Attribute = (typeof attributes)[number];
export const sizes = ['Minúsculo', 'Pequeno', 'Médio', 'Grande', 'Enorme', 'Colossal'] as const;
type Size = (typeof sizes)[number];
export type SkillProfile = {
  level: number;
  attributes: Record<Attribute, number>;
  armor: number;
  shield: number;
  size: Size;
};
export const defaultProfile: SkillProfile = {
  level: 1, attributes: { For: 0, Des: 0, Con: 0, Int: 0, Sab: 0, Car: 0 },
  armor: 0, shield: 0, size: 'Médio',
};

const definitions = {
  Acrobacia: 'Des', Adestramento: 'Car', Atletismo: 'For', Atuação: 'Car',
  Cavalgar: 'Des', Conhecimento: 'Int', Cura: 'Sab', Diplomacia: 'Car', Enganação: 'Car',
  Fortitude: 'Con', Furtividade: 'Des', Guerra: 'Int', Iniciativa: 'Des', Intimidação: 'Car',
  Intuição: 'Sab', Investigação: 'Int', Jogatina: 'Car', Ladinagem: 'Des', Luta: 'For',
  Misticismo: 'Int', Nobreza: 'Int', Ofício: 'Int', 'Ofício 2': 'Int', Percepção: 'Sab',
  Pilotagem: 'Des', Pontaria: 'Des', Reflexos: 'Des', Religião: 'Sab', Sobrevivência: 'Sab', Vontade: 'Sab',
} as const;
export type Skill = keyof typeof definitions;
export const skills = Object.keys(definitions) as Skill[];
const requiresTraining = new Set<Skill>([
  'Adestramento', 'Conhecimento', 'Guerra', 'Jogatina', 'Ladinagem', 'Misticismo', 'Nobreza', 'Ofício', 'Ofício 2', 'Pilotagem', 'Religião',
]);
const armorSkills = new Set<Skill>(['Acrobacia', 'Furtividade', 'Ladinagem']);
const stealthBySize: Record<Size, number> = { Minúsculo: 5, Pequeno: 2, Médio: 0, Grande: -2, Enorme: -5, Colossal: -10 };

export type SkillValue = { trained: boolean; attribute?: Attribute; other?: number; specialty?: string; bonus?: string };
export const isCraft = (skill: Skill) => skill === 'Ofício' || skill === 'Ofício 2';
export const signed = (value: number) => value < 0 ? String(value) : '+' + value;

export function skillTotal(skill: Skill, value: SkillValue | undefined, profile: SkillProfile) {
  const attribute = value?.attribute ?? definitions[skill];
  const attributeValue = profile.attributes[attribute];
  const available = !requiresTraining.has(skill) || !!value?.trained;
  const half = Math.floor(profile.level / 2);
  const training = value?.trained ? (profile.level >= 15 ? 6 : profile.level >= 7 ? 4 : 2) : 0;
  const armor = armorSkills.has(skill) ? profile.armor + profile.shield : 0;
  const size = skill === 'Furtividade' ? stealthBySize[profile.size] : 0;
  // The old editor stored a total. At the default profile only the training bonus needs to be subtracted.
  const other = value?.other ?? (value?.bonus === undefined ? 0 : Number(value.bonus) - (value.trained ? 2 : 0));
  return { available, attribute, attributeValue, half, training, armor, size, other,
    total: available ? half + attributeValue + training + other + size - armor : 0 };
}
