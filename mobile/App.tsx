import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { File, Paths } from 'expo-file-system';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Alert, BackHandler, Image, Modal, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { abilityCost, adjustResource, attackTest, catalog, conditions, dice, emptyResource, fields, infoFields, isList, resourceDefinitions, roll, sections, spendAbility } from './src/sheet';
import type { Entry, ListSection, Resource, Section } from './src/sheet';
import { attributes, defaultProfile, isCraft, signed, sizes, skills, skillTotal } from './src/skills';
import type { Attribute, Skill, SkillProfile, SkillValue } from './src/skills';

const ruby = require('./assets/rubi-da-virtude.png');
const colors = { bg: '#140D21', card: '#241636', ink: '#F9EDF9', muted: '#CDB9DD', border: '#493458', accent: '#E6B58A', selected: '#3A2251' };
const legacySheetKey = 'rubi20.sheet.v1';
const charactersKey = 'rubi20.characters.v1';
const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';

type Sheet = {
  lists: Partial<Record<ListSection, Entry[]>>;
  conditions: string[];
  skills: Partial<Record<Skill, SkillValue>>;
  skillProfile?: SkillProfile;
  info: Partial<Record<(typeof infoFields)[number]['key'], string>>;
  inventory: Record<string, string>;
  spells: Record<string, string>;
  combat?: Combat;
};
const initial: Sheet = { lists: {}, conditions: [], skills: {}, info: {}, inventory: {}, spells: {} };
type Draft = { section: ListSection; id?: string; values: Record<string, string> };
type Page = 'home' | Section;
type Icon = keyof typeof Ionicons.glyphMap;
type Identity = { name: string; race?: string; characterClass?: string; origin?: string; deity?: string; photo?: string };
type Character = Identity & { id: string; sheet: Sheet };
type Combat = { hp: Resource; mp: Resource; defense: number; speed: string };
const defaultCombat: Combat = { hp: emptyResource, mp: emptyResource, defense: 10, speed: '' };
const identityFields = [
  { key: 'name', label: 'Nome' }, { key: 'race', label: 'Raça' }, { key: 'characterClass', label: 'Classe' },
  { key: 'origin', label: 'Origem' }, { key: 'deity', label: 'Divindade' },
] as const;
const destinations = [
  { id: 'home', title: 'Home', icon: 'home-outline' },
  { id: 'characters', title: 'Personagens', icon: 'people-outline' },
  { id: 'campaigns', title: 'Campanhas', icon: 'map-outline' },
  { id: 'rules', title: 'Regras da casa', icon: 'book-outline' },
  { id: 'account', title: 'Conta', icon: 'person-circle-outline' },
] as const;
type Destination = (typeof destinations)[number]['id'];
const characterTabs = [
  { id: 'home', title: 'Home', icon: 'home-outline' },
  { id: 'attacks', title: 'Combate', icon: 'flash-outline' },
  { id: 'abilities', title: 'Habilidades', icon: 'star-outline' },
  { id: 'spells', title: 'Magias', icon: 'sparkles-outline' },
  { id: 'inventory', title: 'Inventário', icon: 'briefcase-outline' },
] as const;

function BottomMenu<T extends string>({ items, selected, navigate }: {
  items: readonly { id: T; title: string; icon: Icon }[]; selected: string; navigate: (id: T) => void;
}) {
  return <View accessibilityRole="tablist" style={s.navigation}>{items.map(item =>
    <Pressable key={item.id} accessibilityRole="tab" accessibilityLabel={item.title} accessibilityState={{ selected: selected === item.id }}
      onPress={() => navigate(item.id)} style={[s.tab, selected === item.id && s.tabActive]}>
      <Ionicons name={item.icon} size={20} color={selected === item.id ? colors.accent : colors.muted} />
      <Text style={[s.tabLabel, selected === item.id && s.gold]}>{item.title}</Text>
    </Pressable>)}</View>;
}

function CharacterPortrait({ uri }: { uri?: string }) {
  const [failed, setFailed] = useState(false);
  return uri && !failed ? <Image accessibilityLabel="Foto do personagem" source={{ uri }} style={s.ruby}
    onError={() => setFailed(true)} /> : <Image source={ruby} style={s.ruby} />;
}

function portraitUri(photo?: string) {
  return photo ? new File(Paths.document, photo).uri : undefined;
}
const skillFilters = ['A a Z', 'Z a A', 'Treinadas'] as const;
const simplify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const number = (value?: string) => Number(value?.replace(',', '.'));
const attributeNames: Record<Attribute, string> = {
  For: 'Força', Des: 'Destreza', Con: 'Constituição', Int: 'Inteligência', Sab: 'Sabedoria', Car: 'Carisma',
};
const integer = (value: string) => /^[+-]?\d{1,4}$/.test(value.trim());
const profileNumbers = [
  { key: 'level', label: 'Nível (1 a 20)' },
  ...attributes.map(key => ({ key, label: attributeNames[key] })),
  { key: 'armor', label: 'Penalidade da armadura' },
  { key: 'shield', label: 'Penalidade do escudo' },
];

function SkillProfileEditor({ profile, save, close }: {
  profile: SkillProfile; save: (profile: SkillProfile) => void; close: () => void;
}) {
  const [draft, setDraft] = useState(() => Object.fromEntries(
    Object.entries({ level: profile.level, ...profile.attributes, armor: profile.armor, shield: profile.shield })
      .map(([key, value]) => [key, String(value)]),
  ));
  const [size, setSize] = useState(profile.size);
  function submit() {
    const level = Number(draft.level);
    if (!Object.values(draft).every(integer) || level < 1 || level > 20 || Number(draft.armor) < 0 || Number(draft.shield) < 0) {
      Alert.alert('Revise os dados', 'Use números inteiros, nível de 1 a 20 e penalidades maiores ou iguais a zero.');
      return;
    }
    save({
      level, size, armor: Number(draft.armor), shield: Number(draft.shield),
      attributes: { For: Number(draft.For), Des: Number(draft.Des), Con: Number(draft.Con),
        Int: Number(draft.Int), Sab: Number(draft.Sab), Car: Number(draft.Car) },
    });
  }
  return <Overlay title="Nível e atributos" close={close}>
    <View style={s.grid}>{profileNumbers.map(({ key, label }) => <View key={key} style={s.profileField}>
      <Field label={label} value={draft[key]} onChange={value => setDraft(previous => ({ ...previous, [key]: value }))} />
    </View>)}</View>
    <Text style={s.label}>Tamanho</Text>
    <View style={s.wrap}>{sizes.map(option => <Chip key={option} label={option} active={size === option} onPress={() => setSize(option)} />)}</View>
    <Pressable accessibilityRole="button" style={s.primary} onPress={submit}><Text style={s.primaryText}>Salvar</Text></Pressable>
  </Overlay>;
}

function Action({ icon, label, onPress }: { icon: Icon; label: string; onPress: () => void }) {
  return <Pressable style={s.iconButton} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}><Ionicons name={icon} size={21} color={colors.accent} /></Pressable>;
}

function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress}
    style={[s.chip, active && s.selected]}><Text style={[s.label, active && s.gold]}>{label}</Text></Pressable>;
}

function Field({ label, value, onChange, multiline = false }: {
  label: string; value?: string; onChange: (value: string) => void; multiline?: boolean;
}) {
  return <View style={s.field}><Text style={s.label}>{label}</Text>
    <TextInput accessibilityLabel={label} style={[s.input, multiline && s.multiline]} value={value ?? ''}
      placeholderTextColor={colors.muted} onChangeText={onChange} multiline={multiline} />
  </View>;
}

function Overlay({ title, children, close }: { title: string; children: React.ReactNode; close: () => void }) {
  return <Modal visible animationType="slide" onRequestClose={close} presentationStyle="pageSheet">
    <SafeAreaView style={s.screen}>
      <View style={s.bar}><Text accessibilityRole="header" style={s.overlayTitle}>{title}</Text><Action icon="close" label="Fechar" onPress={close} /></View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    </SafeAreaView>
  </Modal>;
}

function CharacterEditor({ character, save, close }: {
  character?: Character; save: (identity: Identity, profile: SkillProfile) => void; close: () => void;
}) {
  const profile = character?.sheet.skillProfile ?? defaultProfile;
  const [identity, setIdentity] = useState<Identity>({
    name: character?.name ?? '', race: character?.race, characterClass: character?.characterClass,
    origin: character?.origin, deity: character?.deity,
  });
  const [level, setLevel] = useState(String(profile.level));
  const [scores, setScores] = useState(() => Object.fromEntries(attributes.map(key => [key, String(profile.attributes[key])])));
  const [photo, setPhoto] = useState(character?.photo);
  const [pickedPhoto, setPickedPhoto] = useState<string>();
  const [busy, setBusy] = useState(false);
  const preview = pickedPhoto ?? portraitUri(photo);

  async function pickPhoto() {
    setBusy(true);
    try {
      const result = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!result.canceled) setPickedPhoto(result.assets[0]?.uri);
    } catch {
      Alert.alert('Não foi possível abrir a galeria', 'Confira as permissões de fotos e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!integer(level) || Number(level) < 1 || Number(level) > 20 || !Object.values(scores).every(integer)) {
      Alert.alert('Revise a ficha', 'Informe um nível de 1 a 20 e valores inteiros para os atributos.');
      return;
    }
    const cleaned = { name: identity.name.trim(), race: identity.race?.trim(), characterClass: identity.characterClass?.trim(),
      origin: identity.origin?.trim(), deity: identity.deity?.trim() };
    setBusy(true);
    try {
      let savedPhoto = photo;
      if (pickedPhoto) {
        const source = new File(pickedPhoto);
        const extension = /^[.]\w{1,6}$/.test(source.extension) ? source.extension : '.jpg';
        savedPhoto = `rubi20-personagem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${extension}`;
        await source.copy(new File(Paths.document, savedPhoto));
      }
      save({ ...cleaned, photo: savedPhoto }, { ...profile, level: Number(level), attributes: {
        For: Number(scores.For), Des: Number(scores.Des), Con: Number(scores.Con),
        Int: Number(scores.Int), Sab: Number(scores.Sab), Car: Number(scores.Car),
      } });
    } catch {
      Alert.alert('Não foi possível salvar a foto', 'Escolha a imagem novamente e tente salvar.');
    } finally {
      setBusy(false);
    }
  }
  return <Overlay title={character ? 'Editar personagem' : 'Novo personagem'} close={() => { if (!busy) close(); }}>
    <View style={s.hero}>
      <CharacterPortrait key={preview} uri={preview} />
      <View style={s.heroText}>
        <Pressable accessibilityRole="button" disabled={busy} style={[s.primary, busy && s.disabled]} onPress={pickPhoto}>
          <Text style={s.primaryText}>{preview ? 'Trocar foto' : 'Escolher foto'}</Text>
        </Pressable>
        {!!preview && <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setPickedPhoto(undefined); setPhoto(undefined); }}>
          <Text style={s.caption}>Remover foto</Text>
        </Pressable>}
      </View>
    </View>
    {identityFields.map(({ key, label }) => <Field key={key} label={label} value={identity[key]}
      onChange={value => setIdentity(previous => ({ ...previous, [key]: value }))} />)}
    <Field label="Nível (1 a 20)" value={level} onChange={setLevel} />
    <Text style={s.cardTitle}>Atributos</Text>
    <View style={s.grid}>{attributes.map(key => <View key={key} style={s.profileField}>
      <Field label={attributeNames[key]} value={scores[key]} onChange={value => setScores(previous => ({ ...previous, [key]: value }))} />
    </View>)}</View>
    <Pressable accessibilityRole="button" disabled={busy || !identity.name.trim()} style={[s.primary, (busy || !identity.name.trim()) && s.disabled]} onPress={submit}>
      <Text style={s.primaryText}>{character ? 'Salvar personagem' : 'Criar personagem'}</Text>
    </Pressable>
  </Overlay>;
}

function CombatEditor({ combat, save, close }: { combat: Combat; save: (combat: Combat) => void; close: () => void }) {
  const rows = [
    { key: 'hpCurrent', label: 'PV atuais' }, { key: 'hpMax', label: 'PV máximos' },
    { key: 'mpCurrent', label: 'PM atuais' }, { key: 'mpMax', label: 'PM máximos' }, { key: 'defense', label: 'Defesa' },
  ] as const;
  const [draft, setDraft] = useState({ hpCurrent: String(combat.hp.current), hpMax: String(combat.hp.max),
    mpCurrent: String(combat.mp.current), mpMax: String(combat.mp.max), defense: String(combat.defense), speed: combat.speed });
  function submit() {
    if (!rows.every(({ key }) => integer(draft[key])) || Number(draft.hpMax) < 0 ||
      Number(draft.hpCurrent) > Number(draft.hpMax) || Number(draft.mpCurrent) < 0 ||
      Number(draft.mpCurrent) > Number(draft.mpMax) || Number(draft.defense) < 0) {
      Alert.alert('Revise os valores', 'Use valores inteiros e confira os limites de Vida e Mana.');
      return;
    }
    save({ hp: { current: Number(draft.hpCurrent), max: Number(draft.hpMax) },
      mp: { current: Number(draft.mpCurrent), max: Number(draft.mpMax) }, defense: Number(draft.defense), speed: draft.speed.trim() });
  }
  return <Overlay title="Dados de combate" close={close}>
    <View style={s.grid}>{rows.map(({ key, label }) => <View style={s.profileField} key={key}>
      <Field label={label} value={draft[key]} onChange={value => setDraft(previous => ({ ...previous, [key]: value }))} />
    </View>)}</View>
    <Field label="Deslocamento" value={draft.speed} onChange={value => setDraft(previous => ({ ...previous, speed: value }))} />
    <Pressable accessibilityRole="button" style={s.primary} onPress={submit}><Text style={s.primaryText}>Salvar</Text></Pressable>
  </Overlay>;
}

function CharacterSheet({ character, setSheet, close, edit }: {
  character: Character; setSheet: (update: (sheet: Sheet) => Sheet) => void; close: () => void; edit: () => void;
}) {
  const { name, sheet } = character;
  const [page, setPage] = useState<Page>('home');
  const [draft, setDraft] = useState<Draft>();
  const [skill, setSkill] = useState<Skill>();
  const [skillDraft, setSkillDraft] = useState({ other: '0', trained: false, attribute: 'Des' as Attribute, specialty: '' });
  const [profileOpen, setProfileOpen] = useState(false);
  const [combatOpen, setCombatOpen] = useState(false);
  const [abilityPickerOpen, setAbilityPickerOpen] = useState(false);
  const [abilityQuery, setAbilityQuery] = useState('');
  const [selectedAbilityId, setSelectedAbilityId] = useState<string>();
  const [usedAbility, setUsedAbility] = useState('');
  const [entryFilter, setEntryFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState<(typeof skillFilters)[number]>('A a Z');
  const [library, setLibrary] = useState(false);
  const [query, setQuery] = useState('');
  const [catalogFilters, setCatalogFilters] = useState<Record<string, string>>({});
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<{ title: string; value: string }>();
  const profile = sheet.skillProfile ?? defaultProfile;
  const combat = sheet.combat ?? defaultCombat;
  const usableAbilities = (sheet.lists.abilities ?? []).filter(entry => entry.fields.activation !== 'Passiva');
  const selectedAbility = usableAbilities.find(entry => entry.id === selectedAbilityId);
  const selectedCost = selectedAbility ? abilityCost(selectedAbility) : null;

  function navigate(next: Page) {
    setPage(next);
    setQuery('');
    setCatalogFilters({});
    setLibrary(false);
    setEntryFilter('');
    setResult(undefined);
    setUsedAbility('');
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page === 'home') close();
      else navigate('home');
      return true;
    });
    return () => subscription.remove();
  }, [close, page]);

  const current = sections.find(section => section.id === page);
  const list = page !== 'home' && isList(page) ? page : undefined;
  const entries = list ? sheet.lists[list] ?? [] : [];
  const libraryEntries = list ? catalog[list] ?? [] : [];
  const usedSpace = (sheet.lists.inventory ?? []).reduce((sum, item) => {
    const unit = number(item.fields.space) || 0;
    const quantity = item.fields.quantity ? number(item.fields.quantity) || 0 : 1;
    return sum + unit * quantity;
  }, 0);
  const matches = (item: Entry) => simplify(item.fields.name).includes(simplify(query.trim()));
  const inventoryFilters = ['Equipados', ...new Set(entries.map(item => item.fields.category).filter(Boolean))];
  const abilityFilters = ['Ativas', 'Passivas', 'Sem classificação'];
  const visibleEntries = entries.filter(item => matches(item) && (!entryFilter ||
    (list === 'inventory' && (entryFilter === 'Equipados' ? item.fields.equipped === 'true' : item.fields.category === entryFilter)) ||
    (list === 'abilities' && (item.fields.activation === 'Ativa' ? 'Ativas' :
      item.fields.activation === 'Passiva' ? 'Passivas' : 'Sem classificação') === entryFilter)));
  const filteredCatalog = libraryEntries.filter(item =>
    matches(item) && Object.entries(catalogFilters).every(([key, value]) => !value || item.fields[key] === value));

  function openLibrary(open: boolean) {
    setLibrary(open);
    setQuery('');
    setCatalogFilters({});
  }

  function updateEntries(section: ListSection, update: (items: Entry[]) => Entry[]) {
    setSheet(previous => ({ ...previous, lists: { ...previous.lists, [section]: update(previous.lists[section] ?? []) } }));
  }

  function saveDraft() {
    if (!draft) return;
    const name = draft.values.name?.trim();
    if (!name) return;
    if (draft.section === 'inventory' && ['space', 'quantity'].some(key => {
      const value = draft.values[key]?.trim();
      const parsed = number(value);
      return value && (!Number.isFinite(parsed) || parsed < 0 || (key === 'quantity' && !Number.isInteger(parsed)));
    })) {
      Alert.alert('Revise a carga', 'Informe espaços válidos e uma quantidade inteira a partir de zero.');
      return;
    }
    const id = draft.id ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
    const entry = { id, fields: { ...draft.values, name } };
    if (draft.section === 'abilities' && !abilityCost(entry)) {
      Alert.alert('Revise os custos', 'Informe custos inteiros entre 0 e 9999 PV ou PM.');
      return;
    }
    updateEntries(draft.section, items => draft.id ? items.map(item => item.id === id ? entry : item) : [...items, entry]);
    setDraft(undefined);
    if (library) openLibrary(false);
  }

  function rollDice(title: string, value: string) {
    const outcome = roll(value);
    if (!outcome) {
      Alert.alert('Confira a expressão', 'Use uma expressão como 1d20+3 ou 2d6.');
      return;
    }
    setResult({ title, value: outcome });
  }

  function changeResource(id: 'hp' | 'mp', amount: number) {
    setSheet(previous => {
      const current = previous.combat ?? defaultCombat;
      if (id === 'mp' && current.mp.current + amount < 0) return previous;
      return { ...previous, combat: { ...current, [id]: adjustResource(current[id], amount) } };
    });
  }

  function castSpell(entry: Entry) {
    const cost = Number(entry.fields.mana);
    if (!Number.isInteger(cost) || cost < 0 || !entry.fields.mana?.trim()) {
      Alert.alert('Custo em PM', 'Edite a magia e informe seu custo em PM.');
      return;
    }
    if (cost > combat.mp.current) {
      Alert.alert('Mana insuficiente', `Esta magia custa ${cost} PM.`);
      return;
    }
    changeResource('mp', -cost);
  }

  function useSelectedAbility() {
    if (!selectedAbility || !selectedCost) return;
    if (!spendAbility(combat, selectedCost)) {
      Alert.alert('Recursos insuficientes', 'Confira os PV e PM necessários para usar esta habilidade.');
      return;
    }
    setSheet(previous => {
      const updated = spendAbility(previous.combat ?? defaultCombat, selectedCost);
      return updated ? { ...previous, combat: updated } : previous;
    });
    setUsedAbility(`${selectedAbility.fields.name} usada.`);
  }

  const search = <TextInput accessibilityLabel="Pesquisar por nome" placeholder="Pesquisar por nome"
    placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={s.input} />;

  return <View style={s.fill}>
    <View style={s.bar}>
      <Action icon="arrow-back" label={page === 'home' ? 'Voltar aos personagens' : 'Voltar à ficha'}
        onPress={page === 'home' ? close : () => navigate('home')} />
      <Text accessibilityRole="header" numberOfLines={2} style={s.title}>{current?.title ?? name}</Text>
      {page === 'home' && <Action icon="create-outline" label="Editar personagem" onPress={edit} />}
      {list && <Action icon="add" label={list === 'attacks' ? 'Criar ataque' : 'Criar registro'} onPress={() => setDraft({ section: list, values: {} })} />}
      {list && catalog[list] && <Action icon="library-outline" label="Abrir catálogo" onPress={() => openLibrary(true)} />}
    </View>
    <ScrollView key={page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {page === 'home' && <>
        <View style={s.hero}>
          <CharacterPortrait key={character.photo} uri={portraitUri(character.photo)} />
          <View style={s.heroText}>
            <Text style={s.kicker}>FICHA DE ARTON</Text><Text style={s.heroTitle}>{name}</Text>
            <Text style={s.caption}>{[character.race, character.characterClass, `Nível ${profile.level}`].filter(Boolean).join(' · ')}</Text>
            {!!(character.origin || character.deity) && <Text style={s.caption}>
              {[character.origin && `Origem: ${character.origin}`, character.deity && `Divindade: ${character.deity}`].filter(Boolean).join(' · ')}
            </Text>}
          </View>
        </View>
        <View style={s.grid}>{sections.filter(section => !characterTabs.some(tab => tab.id === section.id)).map(section => (
          <Pressable key={section.id} accessibilityRole="button" onPress={() => navigate(section.id)} style={s.tile}>
            <Ionicons name={section.icon} size={24} color={colors.accent} /><Text style={s.cardTitle}>{section.title}</Text>
          </Pressable>
        ))}</View>
      </>}
      {list === 'attacks' && <>
        <View style={s.card}>
          <View style={s.inline}>
            <Text style={[s.cardTitle, s.grow]}>Defesa {combat.defense}</Text>
            <Action icon="options-outline" label="Configurar dados de combate" onPress={() => setCombatOpen(true)} />
          </View>
          {resourceDefinitions.map(({ id, name: resourceName, label, color }) => {
            const resource = combat[id];
            const progress = resource.max ? Math.max(0, resource.current / resource.max) : 0;
            return <View style={s.resourceRow} key={id}>
              <Action icon="remove" label={`Reduzir ${resourceName}`} onPress={() => changeResource(id, -1)} />
              <View style={s.grow}>
                <Text style={s.label}>{resource.current} / {resource.max} {label}</Text>
                <View style={s.track}><View style={[s.trackFill, { width: `${progress * 100}%`, backgroundColor: color }]} /></View>
              </View>
              <Action icon="add" label={`Aumentar ${resourceName}`} onPress={() => changeResource(id, 1)} />
            </View>;
          })}
          {!!combat.speed && <Text style={s.caption}>Deslocamento {combat.speed}</Text>}
        </View>
        <View style={s.card}>
          <Text accessibilityRole="header" style={s.cardTitle}>Usar habilidade</Text>
          {usableAbilities.length === 0 ? <Text style={s.caption}>Adicione uma habilidade ativa na aba Habilidades.</Text> : <>
            <Pressable accessibilityRole="button" style={[s.row, s.abilityChoice]} onPress={() => {
              setAbilityQuery(''); setAbilityPickerOpen(true);
            }}>
              <Text style={[s.label, s.grow]}>{selectedAbility?.fields.name ?? 'Escolher habilidade'}</Text>
              <Ionicons name="chevron-down" size={18} color={colors.accent} />
            </Pressable>
            {selectedAbility && <>
              <Text style={s.caption}>{selectedCost ? `Custo · ${selectedCost.mp} PM · ${selectedCost.hp} PV` : 'Revise o custo na aba Habilidades.'}</Text>
              {!!selectedAbility.fields.description && <Text style={s.caption}>{selectedAbility.fields.description}</Text>}
              <Pressable accessibilityRole="button" disabled={!selectedCost} style={[s.primary, !selectedCost && s.disabled]} onPress={useSelectedAbility}>
                <Text style={s.primaryText}>Usar</Text>
              </Pressable>
            </>}
          </>}
          {!!usedAbility && <Text accessibilityLiveRegion="polite" style={s.gold}>{usedAbility}</Text>}
        </View>
      </>}
      {page === 'skills' && <>
        <Pressable accessibilityRole="button" style={s.row} onPress={() => setProfileOpen(true)}>
          <View style={s.grow}><Text style={s.cardTitle}>Nível e atributos</Text>
            <Text style={s.caption}>Nível {profile.level} · Metade do nível {signed(Math.floor(profile.level / 2))}</Text>
          </View>
          <Ionicons name="create-outline" size={20} color={colors.accent} />
        </Pressable>
        <View style={s.wrap}>{skillFilters.map(filter => <Chip key={filter} label={filter} active={filter === skillFilter} onPress={() => setSkillFilter(filter)} />)}</View>
        {result && <View style={s.card} accessibilityLiveRegion="polite"><Text style={s.label}>{result.title}</Text><Text style={s.result}>{result.value}</Text></View>}
        {skillFilter === 'Treinadas' && !skills.some(key => sheet.skills[key]?.trained) && <Text style={s.empty}>Marque uma perícia como treinada para vê-la aqui.</Text>}
        {(skillFilter === 'Z a A' ? [...skills].reverse() : skills)
          .filter(key => skillFilter !== 'Treinadas' || sheet.skills[key]?.trained)
          .map(key => {
            const value = sheet.skills[key];
            const parts = skillTotal(key, value, profile);
            const title = value?.specialty ? `Ofício (${value.specialty})` : key;
            return <View key={key} style={s.row}>
              <Pressable style={s.grow} accessibilityRole="button" accessibilityLabel={`Editar ${title}`} onPress={() => {
                setSkill(key);
                setSkillDraft({ other: String(parts.other), trained: !!value?.trained, attribute: parts.attribute, specialty: value?.specialty ?? '' });
              }}>
                <Text style={s.cardTitle}>{title} · {parts.available ? signed(parts.total) : 'Exige treino'}</Text>
                <Text style={s.caption}>{parts.attribute} · {value?.trained ? 'Treinada' : 'Sem treino'}</Text>
                {parts.available && <Text style={s.caption}>
                  {[
                    `½ nível ${signed(parts.half)}`, `${parts.attribute} ${signed(parts.attributeValue)}`,
                    `Treino ${signed(parts.training)}`, `Outros ${signed(parts.other)}`,
                    ...(parts.armor ? [`Penalidade ${signed(-parts.armor)}`] : []),
                    ...(parts.size ? [`Tamanho ${signed(parts.size)}`] : []),
                  ].join(' · ')}
                </Text>}
              </Pressable>{parts.available && <Action icon="dice-outline" label={`Rolar ${title}`}
                onPress={() => rollDice(title, `1d20${signed(parts.total)}`)} />}
            </View>;
          })}
      </>}
      {page === 'conditions' && <>
        <Text style={s.label}>{sheet.conditions.length} {sheet.conditions.length === 1 ? 'condição ativa' : 'condições ativas'}</Text>
        <View style={s.wrap}>{conditions.map(key => {
          const active = sheet.conditions.includes(key);
          return <Chip key={key} label={key} active={active} onPress={() => setSheet(previous => ({
            ...previous, conditions: active ? previous.conditions.filter(item => item !== key) : [...previous.conditions, key],
          }))} />;
        })}</View>
      </>}
      {page === 'info' && infoFields.map(({ key, label }) => <Field key={key} label={label} value={sheet.info[key]} multiline
        onChange={value => setSheet(previous => ({ ...previous, info: { ...previous.info, [key]: value } }))} />)}
      {list === 'attacks' && <>
        <Text accessibilityRole="header" style={s.cardTitle}>Dados e ataques</Text>
        <View style={s.wrap}>{dice.map(sides => <Chip key={sides} label={`d${sides}`} onPress={() => rollDice(`d${sides}`, `1d${sides}`)} />)}</View>
        <View style={s.inline}><TextInput accessibilityLabel="Expressão de dados" style={[s.input, s.grow]} placeholder="Ex. 1d20+3"
          placeholderTextColor={colors.muted} value={expression} onChangeText={setExpression} onSubmitEditing={() => rollDice('Rolagem', expression)} />
          <Action icon="dice-outline" label="Rolar dados" onPress={() => rollDice('Rolagem', expression)} /></View>
        {result && <View style={s.card} accessibilityLiveRegion="polite"><Text style={s.label}>{result.title}</Text><Text style={s.result}>{result.value}</Text></View>}
      </>}
      {list === 'inventory' && <View style={s.card}>
        <Text style={s.cardTitle}>Tibares</Text>
        <View style={s.inline}>{['TC', 'TS', 'TO'].map(key => <View key={key} style={s.grow}><Field label={key} value={sheet.inventory[key]}
          onChange={value => setSheet(previous => ({ ...previous, inventory: { ...previous.inventory, [key]: value } }))} /></View>)}</View>
        <Text style={s.caption}>Carga atual · {usedSpace.toLocaleString('pt-BR')} espaços</Text>
        <Field label="Carga máxima" value={sheet.inventory.capacity}
          onChange={value => setSheet(previous => ({ ...previous, inventory: { ...previous.inventory, capacity: value } }))} />
        <Text style={s.caption}>{(entries.filter(item => item.fields.equipped === 'true' && ['Armadura', 'Escudo'].includes(item.fields.category))
          .map(item => item.fields.name).join(' · ')) || 'Nenhuma armadura ou escudo equipado'}</Text>
      </View>}
      {list === 'spells' && <View style={s.card}>
        <Text style={s.caption}>Mana disponível · {combat.mp.current} / {combat.mp.max} PM</Text>
        <Field label="Atributo-chave" value={sheet.spells.attribute}
          onChange={value => setSheet(previous => ({ ...previous, spells: { ...previous.spells, attribute: value } }))} />
        <View style={s.inline}>{[{ key: 'modifier', title: 'Modificador' }, { key: 'dc', title: 'CD de resistência' }].map(({ key, title }) =>
          <View key={key} style={s.grow}><Field label={title} value={sheet.spells[key]}
            onChange={value => setSheet(previous => ({ ...previous, spells: { ...previous.spells, [key]: value } }))} /></View>)}</View>
      </View>}
      {list && <>
        {search}
        {(list === 'inventory' || list === 'abilities') && entries.length > 0 && <View style={s.wrap}>
          <Chip label="Todos" active={!entryFilter} onPress={() => setEntryFilter('')} />
          {(list === 'inventory' ? inventoryFilters : abilityFilters).map(filter =>
            <Chip key={filter} label={filter} active={entryFilter === filter} onPress={() => setEntryFilter(filter)} />)}
        </View>}
        {visibleEntries.map(entry => <View style={s.row} key={entry.id}>
          <Pressable style={s.grow} accessibilityRole="button" onPress={() => setDraft({ section: list, id: entry.id, values: entry.fields })}>
            <Text style={s.cardTitle}>{entry.fields.name}</Text>
            <Text style={s.caption} numberOfLines={3}>{[entry.fields.category, entry.fields.rank, entry.fields.activation, entry.fields.school, entry.fields.circle,
              entry.fields.mana && `${entry.fields.mana} PM`, entry.fields.health && `${entry.fields.health} PV`, entry.fields.bonus && `Ataque ${entry.fields.bonus}`, entry.fields.damage, entry.fields.critical,
              entry.fields.equipped === 'true' && 'Equipado', entry.fields.effect || entry.fields.description].filter(Boolean).join(' · ')}</Text>
          </Pressable>
          {list === 'attacks' && <Action icon="flash-outline" label={`Rolar ataque de ${entry.fields.name}`}
            onPress={() => rollDice(`Ataque · ${entry.fields.name}`, attackTest(entry.fields.bonus))} />}
          {list === 'attacks' && entry.fields.damage && <Action icon="dice-outline" label={`Rolar dano de ${entry.fields.name}`}
            onPress={() => rollDice(entry.fields.name, entry.fields.damage)} />}
          {list === 'inventory' && <Action icon={entry.fields.equipped === 'true' ? 'checkmark-circle' : 'ellipse-outline'}
            label={entry.fields.equipped === 'true' ? 'Desequipar item' : 'Equipar item'} onPress={() => updateEntries(list, items => items.map(item =>
              item.id === entry.id ? { ...item, fields: { ...item.fields, equipped: String(item.fields.equipped !== 'true') } } : item))} />}
          {list === 'spells' && <Chip label="Usar" onPress={() => castSpell(entry)} />}
        </View>)}
        {entries.length === 0 ? <Text style={s.empty}>Use + para criar o primeiro registro{catalog[list] ? ' ou abra o catálogo' : ''}.</Text> :
          visibleEntries.length === 0 && <Text style={s.empty}>Nenhum resultado.</Text>}
      </>}
    </ScrollView>
    <BottomMenu items={characterTabs} selected={characterTabs.some(tab => tab.id === page) ? page : 'home'} navigate={navigate} />
    {abilityPickerOpen && <Overlay title="Escolher habilidade" close={() => setAbilityPickerOpen(false)}>
      <Field label="Pesquisar habilidade" value={abilityQuery} onChange={setAbilityQuery} />
      {usableAbilities.filter(entry => simplify(entry.fields.name).includes(simplify(abilityQuery.trim()))).map(entry => {
        const cost = abilityCost(entry);
        return <Pressable key={entry.id} accessibilityRole="button" style={s.row} onPress={() => {
          setSelectedAbilityId(entry.id); setUsedAbility(''); setAbilityPickerOpen(false);
        }}>
          <View style={s.grow}><Text style={s.cardTitle}>{entry.fields.name}</Text>
            <Text style={s.caption}>{cost ? `${cost.mp} PM · ${cost.hp} PV` : 'Custo inválido'}</Text></View>
          <Ionicons name={entry.id === selectedAbilityId ? 'checkmark-circle' : 'chevron-forward'} size={20} color={colors.accent} />
        </Pressable>;
      })}
      {!usableAbilities.some(entry => simplify(entry.fields.name).includes(simplify(abilityQuery.trim()))) &&
        <Text style={s.empty}>Nenhuma habilidade encontrada.</Text>}
    </Overlay>}
    {(draft || (library && list)) && <Overlay
      title={draft ? (draft.id ? 'Editar registro' : 'Novo registro') : `Catálogo de ${current?.title.toLowerCase()}`}
      close={() => draft ? setDraft(undefined) : openLibrary(false)}>
      {library && list && !draft && <>
      {search}
      {fields[list].filter(field => field.options && libraryEntries.some(item => item.fields[field.key])).map(field => {
        const options = field.options?.filter(option => libraryEntries.some(item => item.fields[field.key] === option)) ?? [];
        return <View key={field.key} style={s.field}><Text style={s.label}>{field.label}</Text><View style={s.wrap}>
          {options.map(option => <Chip key={option} label={option} active={catalogFilters[field.key] === option} onPress={() =>
            setCatalogFilters(previous => ({ ...previous, [field.key]: previous[field.key] === option ? '' : option }))} />)}
        </View></View>;
      })}
      {filteredCatalog.map(item =>
        <Pressable key={item.id} accessibilityRole="button" style={s.row} onPress={() => setDraft({ section: list, values: { ...item.fields } })}>
          <View style={s.grow}><Text style={s.cardTitle}>{item.fields.name}</Text><Text style={s.caption}>{[item.fields.category, item.fields.damage, item.fields.description].filter(Boolean).join(' · ')}</Text></View>
          <Ionicons name="add-circle-outline" color={colors.accent} size={24} />
        </Pressable>)}
      {filteredCatalog.length === 0 && <Text style={s.empty}>Nenhum resultado.</Text>}
      </>}
      {draft && <>
      {fields[draft.section].filter(field => {
        if (draft.section !== 'inventory') return true;
        if (['defense', 'penalty'].includes(field.key)) return ['Armadura', 'Escudo'].includes(draft.values.category);
        return draft.values.category === 'Arma' || !['proficiency', 'purpose', 'grip', 'range', 'skill', 'attribute', 'damage', 'critical'].includes(field.key);
      }).map(field => field.options ?
        <View key={field.key} style={s.field}><Text style={s.label}>{field.label}</Text><View style={s.wrap}>{field.options.map(option =>
          <Chip key={option} label={option} active={draft.values[field.key] === option} onPress={() => setDraft({
            ...draft, values: { ...draft.values, [field.key]: draft.values[field.key] === option ? '' : option },
          })} />)}</View></View> :
        <Field key={field.key} label={field.label} value={draft.values[field.key]} multiline={field.multiline}
          onChange={value => setDraft({ ...draft, values: { ...draft.values, [field.key]: value } })} />)}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !draft.values.name?.trim() }} disabled={!draft.values.name?.trim()}
        style={[s.primary, !draft.values.name?.trim() && s.disabled]} onPress={saveDraft}><Text style={s.primaryText}>Salvar</Text></Pressable>
      {draft.id && <Chip label="Excluir registro" onPress={() => Alert.alert('Excluir registro?', draft.values.name, [
        { text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => {
          updateEntries(draft.section, items => items.filter(item => item.id !== draft.id)); setDraft(undefined);
        } },
      ])} />}
      </>}
    </Overlay>}
    {combatOpen && <CombatEditor combat={combat} close={() => setCombatOpen(false)} save={next => {
      setSheet(previous => ({ ...previous, combat: next }));
      setCombatOpen(false);
    }} />}
    {profileOpen && <SkillProfileEditor profile={profile} close={() => setProfileOpen(false)} save={skillProfile => {
      setSheet(previous => ({ ...previous, skillProfile }));
      setResult(undefined);
      setProfileOpen(false);
    }} />}
    {skill && <Overlay title={skill} close={() => setSkill(undefined)}>
      {isCraft(skill) && <Field label="Especialidade" value={skillDraft.specialty}
        onChange={specialty => setSkillDraft({ ...skillDraft, specialty })} />}
      <Text style={s.label}>Atributo da perícia</Text>
      <View style={s.wrap}>{attributes.map(attribute => <Chip key={attribute} label={attribute}
        active={attribute === skillDraft.attribute} onPress={() => setSkillDraft({ ...skillDraft, attribute })} />)}</View>
      <Chip label="Treinada" active={skillDraft.trained} onPress={() => setSkillDraft({ ...skillDraft, trained: !skillDraft.trained })} />
      <Field label="Outros bônus e penalidades" value={skillDraft.other} onChange={other => setSkillDraft({ ...skillDraft, other })} />
      <Pressable accessibilityRole="button" style={s.primary} onPress={() => {
        const other = skillDraft.other.trim() || '0';
        if (!integer(other)) { Alert.alert('Informe um bônus inteiro'); return; }
        const value: SkillValue = { ...skillDraft, other: Number(other), specialty: skillDraft.specialty.trim() };
        setSheet(previous => ({ ...previous, skills: { ...previous.skills, [skill]: value } }));
        setResult(undefined);
        setSkill(undefined);
      }}><Text style={s.primaryText}>Salvar</Text></Pressable>
    </Overlay>}
  </View>;
}

type JournalKind = 'campaigns' | 'rules';
type JournalEntry = { id: string; name: string; detail: string; description: string };

function Journal({ kind }: { kind: JournalKind }) {
  const storageKey = `rubi20.${kind}.v1`;
  const campaign = kind === 'campaigns';
  const subject = campaign ? 'campanha' : 'regra da casa';
  const detailLabel = campaign ? 'Mestre' : 'Tipo';
  const [items, setItems] = useState<JournalEntry[]>();
  const [draft, setDraft] = useState<JournalEntry>();
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey).then(raw => {
      if (active) setItems(raw ? JSON.parse(raw) : []);
    }).catch(() => {
      if (active) setError('Não foi possível carregar os registros.');
    });
    return () => { active = false; };
  }, [storageKey]);

  async function save(next: JournalEntry[]) {
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      setItems(next);
      setDraft(undefined);
      setError('');
    } catch {
      setError('Não foi possível salvar os registros.');
      Alert.alert('Não foi possível salvar');
    }
  }

  const filtered = items?.filter(item => simplify(`${item.name} ${item.detail}`).includes(simplify(query.trim())));
  return <>
    {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {items && <>
      <Pressable accessibilityRole="button" style={s.primary} onPress={() => setDraft({ id: '', name: '', detail: '', description: '' })}>
        <Text style={s.primaryText}>Nova {subject}</Text>
      </Pressable>
      {items.length > 0 && <Field label={`Buscar por nome ou ${detailLabel.toLowerCase()}`} value={query} onChange={setQuery} />}
      {filtered?.map(item => <Pressable accessibilityRole="button" key={item.id} style={s.row} onPress={() => setDraft(item)}>
        <View style={s.grow}><Text style={s.cardTitle}>{item.name}</Text>
          {!!item.detail && <Text style={s.caption}>{detailLabel} · {item.detail}</Text>}
          {!!item.description && <Text style={s.caption} numberOfLines={2}>{item.description}</Text>}</View>
        <Ionicons name="chevron-forward-outline" size={20} color={colors.muted} />
      </Pressable>)}
      {filtered?.length === 0 && <Text style={s.empty}>{query.trim() ? 'Nenhum resultado.' : `Nenhuma ${subject} cadastrada.`}</Text>}
    </>}
    {draft && items && <Overlay title={draft.id ? `Editar ${subject}` : `Nova ${subject}`} close={() => setDraft(undefined)}>
      <Field label="Nome" value={draft.name} onChange={name => setDraft({ ...draft, name })} />
      <Field label={detailLabel} value={draft.detail} onChange={detail => setDraft({ ...draft, detail })} />
      <Field label="Descrição" multiline value={draft.description} onChange={description => setDraft({ ...draft, description })} />
      <Pressable accessibilityRole="button" disabled={!draft.name.trim()} style={[s.primary, !draft.name.trim() && s.disabled]} onPress={() => {
        const entry = { id: draft.id || Date.now().toString(36) + Math.random().toString(36).slice(2), name: draft.name.trim(),
          detail: draft.detail.trim(), description: draft.description.trim() };
        void save(draft.id ? items.map(item => item.id === draft.id ? entry : item) : [...items, entry]);
      }}><Text style={s.primaryText}>Salvar</Text></Pressable>
      {!!draft.id && <Chip label="Excluir" onPress={() => Alert.alert(`Excluir ${subject}?`, draft.name, [
        { text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive',
          onPress: () => { void save(items.filter(item => item.id !== draft.id)); } },
      ])} />}
    </Overlay>}
  </>;
}

function Rubi20() {
  const [destination, setDestination] = useState<Destination>('home');
  const [characters, setCharacters] = useState<Character[]>();
  const [characterId, setCharacterId] = useState<string>();
  const [characterEditor, setCharacterEditor] = useState<'new' | 'edit'>();
  const [storageError, setStorageError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    async function loadCharacters() {
      try {
        const saved = await AsyncStorage.getItem(charactersKey);
        if (saved !== null) {
          const stored = JSON.parse(saved);
          if (!Array.isArray(stored)) throw new Error('Formato de personagens inválido');
          setCharacters(stored);
          return;
        }
        const previous = await AsyncStorage.getItem(legacySheetKey);
        const sheet: Sheet = { ...initial, ...(previous ? JSON.parse(previous) : {}) };
        const hasData = Object.values(sheet).some(value => Object.keys(value).length > 0);
        setCharacters(hasData ? [{ id: 'legacy-sheet', name: 'Ficha de Arton', sheet }] : []);
      } catch {
        setStorageError(true);
      }
    }
    void loadCharacters();
  }, [loadAttempt]);

  useEffect(() => {
    if (!characters) return;
    AsyncStorage.setItem(charactersKey, JSON.stringify(characters))
      .then(() => setStorageError(false)).catch(() => setStorageError(true));
  }, [characters]);

  const character = characters?.find(item => item.id === characterId);
  const active = destinations.find(item => item.id === destination);

  useEffect(() => {
    if (characterId || destination === 'home') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setDestination('home');
      return true;
    });
    return () => subscription.remove();
  }, [characterId, destination]);

  function openDestination(next: Destination) {
    setCharacterId(undefined);
    setDestination(next);
  }

  function saveCharacter(identity: Identity, skillProfile: SkillProfile) {
    if (!identity.name || !characters) return;
    if (characterEditor === 'edit' && character) {
      setCharacters(previous => previous?.map(item => item.id === character.id ?
        { ...item, ...identity, sheet: { ...item.sheet, skillProfile } } : item));
    } else {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
      setCharacters(previous => [...(previous ?? []), { id, ...identity, sheet: { ...initial, skillProfile } }]);
    }
    setCharacterEditor(undefined);
  }

  return <SafeAreaView style={s.screen}>
    {storageError && <Text accessibilityRole="alert" style={s.error}>
      {characters ? 'Não foi possível salvar os personagens neste aparelho.' : 'Não foi possível carregar os personagens neste aparelho.'}
    </Text>}
    {character ? <CharacterSheet key={character.id} character={character} close={() => setCharacterId(undefined)} edit={() => setCharacterEditor('edit')}
      setSheet={update => setCharacters(previous => previous?.map(item => item.id === character.id ?
        { ...item, sheet: update(item.sheet) } : item))} /> : <View style={s.fill}>
      <View style={s.bar}>
        <Text accessibilityRole="header" style={s.title}>{destination === 'home' ? 'Rubi20' : active?.title}</Text>
        {destination === 'characters' && !!characters?.length &&
          <Action icon="add" label="Criar personagem" onPress={() => setCharacterEditor('new')} />}
      </View>
      <ScrollView key={destination} contentContainerStyle={s.content}>
        {destination === 'home' && <>
          <View style={s.hero}>
            <Image source={ruby} style={s.ruby} />
            <View style={s.heroText}><Text style={s.kicker}>TORMENTA20</Text><Text style={s.heroTitle}>Boas-vindas a Arton</Text></View>
          </View>
          <View style={s.grid}>{destinations.filter(item => item.id !== 'home').map(item =>
            <Pressable key={item.id} accessibilityRole="button" onPress={() => openDestination(item.id)} style={s.tile}>
              <Ionicons name={item.icon} size={24} color={colors.accent} /><Text style={s.cardTitle}>{item.title}</Text>
            </Pressable>)}
          </View>
        </>}
        {destination === 'characters' && <>
          {!characters && (storageError ? <Chip label="Tentar novamente" onPress={() => {
            setStorageError(false);
            setLoadAttempt(attempt => attempt + 1);
          }} /> : <Text style={s.empty}>Carregando personagens…</Text>)}
          {characters?.map(item =>
            <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Abrir ficha de ${item.name}`}
              onPress={() => setCharacterId(item.id)} style={s.row}>
              <Ionicons name="person-outline" size={21} color={colors.accent} />
              <View style={s.grow}>
                <Text style={s.cardTitle}>{item.name}</Text>
                <Text style={s.caption}>{[item.race, item.characterClass, `Nível ${item.sheet.skillProfile?.level ?? 1}`].filter(Boolean).join(' · ')}</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={20} color={colors.muted} />
            </Pressable>)}
          {characters?.length === 0 && <>
            <Text style={s.empty}>Você ainda não tem personagens.</Text>
            <Pressable accessibilityRole="button" style={s.primary} onPress={() => setCharacterEditor('new')}>
              <Text style={s.primaryText}>Criar personagem</Text>
            </Pressable>
          </>}
        </>}
        {(destination === 'campaigns' || destination === 'rules') && <Journal key={destination} kind={destination} />}
        {destination === 'account' && <View style={s.card}>
          <Text style={s.label}>As fichas estão salvas neste aparelho. O acesso à conta será disponibilizado em uma próxima etapa.</Text>
        </View>}
      </ScrollView>
    </View>}
    {!character && <BottomMenu items={destinations} selected={destination} navigate={openDestination} />}
    {characterEditor && <CharacterEditor character={characterEditor === 'edit' ? character : undefined}
      save={saveCharacter} close={() => setCharacterEditor(undefined)} />}
  </SafeAreaView>;
}

export default function App() {
  return <SafeAreaProvider><StatusBar style="light" /><Rubi20 /></SafeAreaProvider>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  bar: { minHeight: 64, borderBottomWidth: 1, borderColor: colors.border, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { color: colors.ink, fontFamily: serif, fontWeight: '700', fontSize: 26, flex: 1 },
  overlayTitle: { color: colors.ink, fontFamily: serif, fontSize: 23, flex: 1 },
  content: { width: '100%', maxWidth: 660, alignSelf: 'center', padding: 18, gap: 12 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  ruby: { width: 102, height: 112 },
  heroText: { flex: 1, gap: 6, paddingRight: 12 },
  kicker: { fontSize: 11, letterSpacing: 2.5, color: colors.accent, fontWeight: '800' },
  heroTitle: { color: colors.ink, fontFamily: serif, fontSize: 24, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  profileField: { flexBasis: '46%', flexGrow: 1 },
  tile: { minWidth: '46%', flexBasis: '46%', flexGrow: 1, minHeight: 84, padding: 13, justifyContent: 'center', gap: 7, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, gap: 10 },
  cardTitle: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, paddingLeft: 14 },
  resourceRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  abilityChoice: { minHeight: 44, backgroundColor: colors.bg },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden', marginTop: 5 },
  trackFill: { height: '100%', borderRadius: 3 },
  grow: { flex: 1 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  caption: { color: colors.muted, fontSize: 13, marginTop: 4 },
  empty: { color: colors.muted, paddingVertical: 22, textAlign: 'center' },
  field: { gap: 5 },
  label: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.card, color: colors.ink, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, fontSize: 15 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  inline: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderColor: colors.border, borderWidth: 1, backgroundColor: colors.card },
  selected: { backgroundColor: colors.selected, borderColor: colors.accent },
  gold: { color: colors.accent },
  primary: { backgroundColor: colors.accent, padding: 12, borderRadius: 10, alignItems: 'center' },
  primaryText: { color: colors.bg, fontWeight: '800' },
  disabled: { opacity: 0.44 },
  result: { color: colors.accent, fontWeight: '700', fontSize: 18 },
  error: { color: colors.accent, padding: 12 },
  navigation: { flexDirection: 'row', padding: 6, gap: 3, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  tab: { flex: 1, minHeight: 50, justifyContent: 'center', alignItems: 'center', gap: 4, borderRadius: 10 },
  tabActive: { backgroundColor: colors.selected },
  tabLabel: { color: colors.muted, fontSize: 10, fontWeight: '600', textAlign: 'center' },
});
