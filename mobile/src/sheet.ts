export const sections = [
  { id: 'skills', title: 'Perícias', icon: 'compass-outline' },
  { id: 'attacks', title: 'Combate', icon: 'flash-outline' },
  { id: 'abilities', title: 'Habilidades', icon: 'star-outline' },
  { id: 'spells', title: 'Magias', icon: 'sparkles-outline' },
  { id: 'inventory', title: 'Inventário', icon: 'briefcase-outline' },
  { id: 'conditions', title: 'Condições', icon: 'heart-outline' },
  { id: 'allies', title: 'Parceiros', icon: 'people-outline' },
  { id: 'info', title: 'Informações', icon: 'book-outline' },
] as const;

export type Section = (typeof sections)[number]['id'];
export type ListSection = 'attacks' | 'abilities' | 'spells' | 'inventory' | 'allies';
export type Entry = { id: string; fields: Record<string, string> };

type Field = { key: string; label: string; options?: string[]; multiline?: boolean };
const name = { key: 'name', label: 'Nome' };
const description = { key: 'description', label: 'Descrição', multiline: true };
const damage = { key: 'damage', label: 'Dano (ex. 1d8+3)' };

export const fields: Record<ListSection, Field[]> = {
  attacks: [name, { key: 'bonus', label: 'Bônus de ataque' }, damage, { key: 'critical', label: 'Crítico' }, description],
  abilities: [name, { key: 'activation', label: 'Ativação', options: ['Ativa', 'Passiva'] },
    { key: 'mana', label: 'Custo em PM' }, { key: 'health', label: 'Custo em PV' },
    { key: 'category', label: 'Categoria', options: ['Poder', 'Habilidade de classe', 'Habilidade de raça'] }, { key: 'type', label: 'Tipo', options: ['Combate', 'Destino', 'Magia', 'Concedido', 'Outro'] }, description],
  spells: [name, { key: 'category', label: 'Tipo', options: ['Arcana', 'Divina', 'Universal'] }, { key: 'school', label: 'Escola', options: ['Abjuração', 'Adivinhação', 'Convocação', 'Encantamento', 'Evocação', 'Ilusão', 'Necromancia', 'Transmutação'] }, { key: 'circle', label: 'Círculo', options: ['1º', '2º', '3º', '4º', '5º'] }, damage, { key: 'casting', label: 'Execução', options: ['Padrão', 'Movimento', 'Livre', 'Completa', 'Reação', 'Outra'] }, { key: 'range', label: 'Alcance', options: ['Pessoal', 'Toque', 'Curto', 'Médio', 'Longo', 'Ilimitado'] }, { key: 'target', label: 'Alvo ou área' }, { key: 'effect', label: 'Efeito' }, { key: 'duration', label: 'Duração' }, { key: 'resistance', label: 'Resistência' }, description],
  inventory: [name, { key: 'category', label: 'Tipo de item', options: ['Arma', 'Armadura', 'Escudo', 'Equipamento', 'Consumível', 'Outro'] }, description, { key: 'space', label: 'Espaços por unidade' }, { key: 'quantity', label: 'Quantidade' }, { key: 'proficiency', label: 'Categoria da arma', options: ['Simples', 'Marcial', 'Exótica'] }, { key: 'purpose', label: 'Propósito', options: ['Corpo a corpo', 'À distância'] }, { key: 'grip', label: 'Empunhadura', options: ['Leve', 'Uma mão', 'Duas mãos'] }, { key: 'range', label: 'Alcance', options: ['Curto', 'Médio', 'Longo'] }, { key: 'skill', label: 'Perícia do ataque' }, { key: 'attribute', label: 'Soma atributo?', options: ['Sim', 'Não'] }, damage, { key: 'critical', label: 'Crítico' }],
  allies: [name, { key: 'category', label: 'Tipo de parceiro' }, { key: 'rank', label: 'Grau', options: ['Iniciante', 'Veterano', 'Mestre'] }, { key: 'effect', label: 'Benefício', multiline: true }, description],
};

fields.attacks.splice(4, 0, { key: 'damageType', label: 'Tipo de dano' }, { key: 'range', label: 'Alcance' });
fields.spells.splice(1, 0, { key: 'mana', label: 'Custo em PM' },
  { key: 'preparable', label: 'Pode ser preparada?', options: ['Sim', 'Não'] });
fields.inventory.splice(3, 0, { key: 'price', label: 'Preço (T$)' },
  { key: 'defense', label: 'Bônus de Defesa' }, { key: 'penalty', label: 'Penalidade de armadura' });

export const dice = [4, 6, 8, 10, 12, 20, 100];

export const resourceDefinitions = [
  { id: 'hp', label: 'PV', name: 'Vida', color: '#D6718C' },
  { id: 'mp', label: 'PM', name: 'Mana', color: '#A58AED' },
] as const;

export type Resource = { current: number; max: number };
export const emptyResource: Resource = { current: 0, max: 0 };
export const adjustResource = (resource: Resource, amount: number): Resource => ({
  ...resource, current: Math.min(resource.max, resource.current + amount),
});

export function abilityCost(entry: Entry): { hp: number; mp: number } | null {
  const health = entry.fields.health?.trim() ?? '';
  const mana = entry.fields.mana?.trim() ?? '';
  if (!/^\d{0,4}$/.test(health) || !/^\d{0,4}$/.test(mana)) return null;
  return { hp: Number(health), mp: Number(mana) };
}

export function spendAbility<T extends { hp: Resource; mp: Resource }>(combat: T, cost: { hp: number; mp: number }): T | null {
  if ((cost.hp > 0 && combat.hp.current < cost.hp) || (cost.mp > 0 && combat.mp.current < cost.mp)) return null;
  return { ...combat, hp: adjustResource(combat.hp, -cost.hp), mp: adjustResource(combat.mp, -cost.mp) };
}

export function attackTest(bonus: string | undefined) {
  const text = bonus?.trim() || '0';
  return /^[+-]?\d{1,4}$/.test(text) ? `1d20${text.startsWith('-') || text.startsWith('+') ? '' : '+'}${text}` : '';
}

export const catalog: Partial<Record<ListSection, Entry[]>> = {
  inventory: [
    { id: 'dagger', fields: { name: 'Adaga', category: 'Arma', proficiency: 'Simples', purpose: 'Corpo a corpo', grip: 'Leve', damage: '1d4', critical: '19/x2', quantity: '1', space: '1' } },
    { id: 'bow', fields: { name: 'Arco curto', category: 'Arma', proficiency: 'Simples', purpose: 'À distância', grip: 'Duas mãos', damage: '1d6', critical: '20/x3', quantity: '1', space: '2' } },
    { id: 'javelin', fields: { name: 'Azagaia', category: 'Arma', proficiency: 'Simples', purpose: 'À distância', grip: 'Uma mão', damage: '1d6', critical: '20/x2', quantity: '1', space: '1' } },
  ],
  spells: [
    { id: 'alarm', fields: { name: 'Alarme', category: 'Arcana', school: 'Abjuração', circle: '1º', casting: 'Padrão', range: 'Curto', duration: '1 dia', description: 'Protege uma área e avisa quando alguém entra.' } },
  ],
  abilities: [
    { id: 'finesse', fields: { name: 'Acuidade com Arma', category: 'Poder', type: 'Combate', description: 'Permite usar Destreza com determinadas armas leves ou de arremesso.' } },
    { id: 'throw', fields: { name: 'Arremesso Potente', category: 'Poder', type: 'Combate', description: 'Permite usar Força em ataques com armas de arremesso.' } },
  ],
};

export const conditions = 'Abalado|Agarrado|Alquebrado|Apavorado|Atordoado|Caído|Cego|Confuso|Debilitado|Desprevenido|Doente|Em chamas|Enfeitiçado|Enjoado|Enredado|Envenenado|Esmorecido|Exausto|Fascinado|Fatigado|Fraco|Frustrado|Imóvel|Inconsciente|Indefeso|Lento|Ofuscado|Paralisado|Petrificado|Sangrando|Sobrecarregado|Surdo|Surpreendido|Vulnerável'.split('|');

export const infoFields = [
  { key: 'description', label: 'Descrição' },
  { key: 'history', label: 'História' },
  { key: 'notes', label: 'Anotações' },
] as const;

export const isList = (section: Section): section is ListSection => section in fields;

export function roll(expression: string): string | null {
  const normalized = expression.replace(/\s/g, '').toLowerCase();
  if (!/^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/.test(normalized) || normalized.length > 80) return null;
  let total = 0;
  const detail: string[] = [];
  for (const term of normalized.match(/[+-]?[^+-]+/g) ?? []) {
    const [count, size] = term.replace(/^[+-]/, '').split('d');
    const sign = term.startsWith('-') ? -1 : 1;
    const amount = Number(count || 1);
    const sides = Number(size);
    if (!Number.isSafeInteger(amount) || amount > 1000000) return null;
    if (size && (amount < 1 || amount > 100 || sides < 2 || sides > 1000)) return null;
    const values = size ? Array.from({ length: amount }, () => 1 + Math.floor(Math.random() * sides)) : [amount];
    total += sign * values.reduce((sum, value) => sum + value, 0);
    detail.push((sign < 0 ? '− ' : '+ ') + values.join(', '));
  }
  return `${total}  ·  ${detail.join(' ')}`;
}
