import {
  addDoc, auth, collection, createUserWithEmailAndPassword, deleteDoc,
  deleteObject, doc, firestore, getDownloadURL, getDoc, getDocs, limit,
  onAuthStateChanged, onSnapshot, orderBy, query, serverTimestamp, setDoc,
  signInWithEmailAndPassword, signOut, storage, storageRef, updateDoc,
  updateProfile, uploadBytes, where, writeBatch,
} from "./firebase.js";

// ═══════════════════════════════════════════════════════════════════════════════
// NiarTale Grimório — app.js v3
// Melhorias: habilidades/inventário estáveis (sem perda de foco), permissões
// visuais (player-mode oculta elementos, não só desabilita), UI compacta.
// ═══════════════════════════════════════════════════════════════════════════════

const CAMPAIGN_ID = "default";
const LEGACY_KEYS = ["niartale-rpg-core-v1", "niartale-undertale-grimoire-v2", "niartale-codex-v1"];

const ATTRIBUTE_KEYS = [
  ["for", "FOR", "Forca"],
  ["con", "CON", "Constituicao"],
  ["agi", "AGI", "Agilidade"],
  ["int", "INT", "Inteligencia"],
  ["mag", "MAG", "Magia"],
];

const SKILL_NAMES = [
  "Atletismo","Acrobacia","Luta","Arcanismo","Adestramento","Crime",
  "Diplomacia","Enganacao","Fe","Furtividade","Intimidacao","Tecnologia",
  "Vontade","Estrategia","Intuicao","Medicina","Ocultismo","Investigacao",
  "Oficio","Percepcao","Artesanato","Pontaria","Reflexo","Sobrevivencia",
  "Vitalidade","Magia",
];

const SHEET_TABS = [
  ["general","Geral"],["stats","Atributos"],["skills","Pericias"],
  ["abilities","Habilidades"],["inventory","Inventario"],["equipment","Equipamentos"],
  ["notes","Notas"],["history","Historia"],["resources","Recursos"],
];
const COMBAT_FLOW_SLOTS = 5;
const MAX_PDFS_PER_CHARACTER = 10;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
// Tipos de armadura explicitos (Sprint 3). "" = nenhum tipo definido.
const ARMOR_TYPE_KEYS = ["", "leve", "media", "pesada"];
const ARMOR_TYPE_LABELS = { "":"Nenhuma", leve:"Leve", media:"Media", pesada:"Pesada" };

// Fontes personalizadas por ficha (Sprint Fontes). Afetam apenas --char-font (conteudo);
// HUD/numeros continuam em --pixel. "padrao" equivale ao visual atual.
const FONT_KEYS   = ["padrao", "serif", "fantasia", "manuscrita", "medieval"];
const FONT_LABELS = {
  padrao:"Padrao", serif:"Serif", fantasia:"Fantasia",
  manuscrita:"Manuscrita", medieval:"Medieval",
};
// Mapeamento chave → font stack. Medieval usa fonte web self-hosted como primeiro valor;
// o fallback generico (serif) garante render offline ou quando a fonte nao carrega.
function fontStackFor(key) {
  return ({
    padrao:     `var(--sans)`,
    serif:      `Georgia, "Times New Roman", serif`,
    fantasia:   `"Papyrus", "Luminari", fantasy`,
    manuscrita: `"Segoe Script", "Bradley Hand", "Comic Sans MS", cursive`,
    medieval:   `"MedievalSharp", "UnifrakturCook", "Old English Text MT", serif`,
  })[key] || `var(--sans)`;
}

// Chaves canônicas persistidas no Firestore (ver docs/Especificacao_Raca_SubRaca.md)
const RACE_KEYS = ["humano", "monstro", "nenhum"];
const SUB_RACE_KEYS = [
  "nenhum", "anfibio", "esqueleto", "elemental", "fantasma",
  "reptil", "alcadethes", "aranha", "flor", "parasita", "variados",
  "boneco magico",
];
const RACE_LABELS = { humano: "Humano", monstro: "Monstro", nenhum: "Nenhum" };
const SUB_RACE_LABELS = {
  nenhum: "Nenhum", anfibio: "Anfíbio", esqueleto: "Esqueleto", elemental: "Elemental",
  fantasma: "Fantasma", reptil: "Réptil", alcadethes: "Alcadethes", aranha: "Aranha",
  flor: "Flor", parasita: "Parasita", variados: "Variados",
  "boneco magico": "Boneco Mágico",
};
const RACE_ALIASES = {
  humana: "humano", human: "humano",
  monster: "monstro",
  none: "nenhum",
};

// Bônus por sub-raça (aba Ficha — G8 / H15–X16). Única tabela usada em excelCalc.
const SUB_RACE_SR = {
  anfibio:   { forMod:2, agiMod:2, caBonus1:0, rdFis:6, rdMag:6 },
  alcadethes:{ forMod:6, agiMod:-3, magMod:6, hpBonus:"con", caBonus1:0 },
  reptil:    { forMod:6, caBonus1:2, caBonus2:-6, dodgePen:6, rdFis:22, rdMag:22, suppressForBuf:true },
  esqueleto: { agiMod:5, hpPen:10, caBonus1:0 },
  parasita:  { conMod:-10, agiMod:6, hpPen:10, caBonus1:7, blockPen:5 },
  aranha:    { agiMod:4, caBonus1:0 },
  elemental: { hpZero:true, ppDouble:true },
};

function norm(v) {
  return String(v ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function customFieldVal(c, label) {
  return c.customFields?.find((f) => norm(f.label) === norm(label))?.value;
}

function resolveRaceKey(raw) {
  const k = norm(raw);
  if (RACE_KEYS.includes(k)) return k;
  if (RACE_ALIASES[k]) return RACE_ALIASES[k];
  return "nenhum";
}

function resolveSubRaceKey(raw) {
  const k = norm(raw);
  if (SUB_RACE_KEYS.includes(k)) return k;
  return "nenhum";
}

function stripSubRaceCustomFields(fields) {
  return (fields || []).filter((f) => norm(f.label) !== "sub-raca");
}

// Garante que todo campo extra tenha id (fichas antigas sem id ficavam
// ineditaveis/inremoviveis, pois editar/excluir operam por id). Aditivo e
// idempotente: preserva ids existentes e nao altera label/value preenchidos.
function normalizeCustomFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields.map((f) => ({
    ...f,
    id: f?.id || uid("cf"),
    label: f?.label ?? "",
    value: f?.value ?? "",
  }));
}

function hasSubRaceCustomField(fields) {
  return (fields || []).some((f) => norm(f.label) === "sub-raca");
}

function applyRaceSubRaceNormalization(merged, rawData = {}) {
  const legacySubRaw = customFieldVal(merged, "Sub-raca");
  const mergedSubKey = resolveSubRaceKey(merged.subRace ?? "");
  const subRaceAlreadyValid = mergedSubKey !== "nenhum";
  // Se subRace já vier válido e diferente de "nenhum", ele prevalece sobre custom legado.
  const subRaw = subRaceAlreadyValid ? mergedSubKey : (legacySubRaw ?? merged.subRace ?? "nenhum");
  const rawRaceInput = [rawData.race, rawData.ancestry, merged.race].find((v) => String(v ?? "").trim() !== "") ?? "nenhum";
  const raceKey = resolveRaceKey(rawRaceInput);
  const subRaceKey = resolveSubRaceKey(subRaw);

  // I2: backfill de id em todo campo extra.
  // I3: so remove o custom "Sub-raca" quando ele e a fonte da migracao (subRace
  // ainda nao resolvido). Se subRace ja e valido, preserva campos do usuario,
  // evitando perda silenciosa de um campo legitimamente chamado "Sub-raca".
  let customFields = normalizeCustomFields(merged.customFields);
  if (!subRaceAlreadyValid) customFields = stripSubRaceCustomFields(customFields);

  const migration = { ...(merged._migration || rawData._migration || {}) };
  const rawRace = rawRaceInput;
  if (rawRace != null && String(rawRace).trim() && raceKey === "nenhum" && norm(rawRace) !== "nenhum") {
    migration.raceFrom = String(rawRace);
  }
  const rawSub = customFieldVal({ customFields: merged.customFields }, "Sub-raca") ?? merged.subRace;
  if (rawSub != null && String(rawSub).trim() && subRaceKey === "nenhum" && norm(rawSub) !== "nenhum") {
    migration.subRaceFrom = String(rawSub);
  }

  const out = { ...merged, race: raceKey, subRace: subRaceKey, customFields };
  if (Object.keys(migration).length) out._migration = migration;
  else delete out._migration;
  return out;
}

function mergeRaceSubRaceIntoCharacter(target, source, opts = {}) {
  const overwriteCustomFields = opts.overwriteCustomFields ?? true;
  target.race = source.race;
  target.subRace = source.subRace;
  if (overwriteCustomFields) target.customFields = source.customFields;
  if (source._migration) target._migration = { ...target._migration, ...source._migration };
}

function characterNeedsRaceSubRacePersist(raw, normalized) {
  if (raw.race !== normalized.race) return true;
  if (raw.subRace !== normalized.subRace) return true;
  if (!raw.subRace) return true;
  if (hasSubRaceCustomField(raw.customFields)) return true;
  return false;
}

function buildRaceSubRaceFirestorePatch(raw, normalized) {
  const patch = {
    race: normalized.race,
    subRace: normalized.subRace,
    customFields: normalized.customFields,
    updatedAt: serverTimestamp(),
  };
  if (normalized._migration?.raceFrom || normalized._migration?.subRaceFrom) {
    patch._migration = {
      ...(raw._migration || {}),
      ...normalized._migration,
      raceSubRaceAt: serverTimestamp(),
    };
  }
  return patch;
}

function isKnownRaceInput(raw) {
  const k = norm(raw);
  return RACE_KEYS.includes(k) || Boolean(RACE_ALIASES[k]);
}

function isKnownSubRaceInput(raw) {
  return SUB_RACE_KEYS.includes(norm(raw));
}

// Sincroniza c.race / c.subRace em memória; remove custom Sub-raca legado.
// Sub-raca: chave valida em c.subRace vence (UI); senao custom legado (migracao).
function ensureCharacterRaceSubRace(c) {
  if (!c) return { race: "nenhum", subRace: "nenhum" };
  const race = resolveRaceKey(c.race);
  const subKey = norm(c.subRace ?? "");
  const subRaceFromKey = SUB_RACE_KEYS.includes(subKey);
  const subRace = subRaceFromKey
    ? subKey
    : resolveSubRaceKey(customFieldVal(c, "Sub-raca") ?? c.subRace);
  c.race = race;
  c.subRace = subRace;
  // I3: so remove o custom "Sub-raca" quando ele foi a fonte do valor (subRace
  // nao veio de uma chave valida). Caso contrario, preserva campos do usuario.
  if (!subRaceFromKey && hasSubRaceCustomField(c.customFields)) {
    c.customFields = stripSubRaceCustomFields(c.customFields);
  }
  return { race, subRace };
}

function clampResourcesToDerivedMax(c, calc) {
  const { hpMax, ppMax } = calc ?? excelCalc(c);
  let adjusted = false;
  if (c.resources?.hp && hpMax >= 0 && c.resources.hp.current > hpMax) {
    c.resources.hp.current = hpMax;
    adjusted = true;
  }
  if (c.resources?.mp && ppMax >= 0 && c.resources.mp.current > ppMax) {
    c.resources.mp.current = ppMax;
    adjusted = true;
  }
  return adjusted;
}

// Valida e corrige raca/sub-raca antes de calcular ou persistir.
function sanitizeCharacterForPersist(c) {
  const warnings = [];
  const rawRace = c.race;
  const rawSub = customFieldVal(c, "Sub-raca") ?? c.subRace;

  const normalized = applyRaceSubRaceNormalization({ ...c }, c);
  Object.assign(c, {
    race: normalized.race,
    subRace: normalized.subRace,
    customFields: normalized.customFields,
  });
  if (normalized._migration) {
    c._migration = { ...(c._migration || {}), ...normalized._migration };
  }
  c.exp = Math.max(0, Number(c.exp || 0));
  c.xp = Math.max(0, Number(c.xp || 0));
  c.nvl = Math.max(0, Number(c.nvl || 0));
  c.combat = normalizeCombatState(c.combat);
  c.abilities = normalizeAbilities(c.abilities);
  c.inventory = normalizeInventory(c.inventory);
  c.equipment = normalizeEquipment(c.equipment);
  c.documents = normalizeDocuments(c.documents);
  if (c.theme && !FONT_KEYS.includes(c.theme.font)) c.theme = { ...c.theme, font: "padrao" };

  if (rawRace != null && String(rawRace).trim() && normalized.race === "nenhum" && !isKnownRaceInput(rawRace)) {
    warnings.push(`Raca "${rawRace}" nao reconhecida; salva como Nenhum.`);
  }
  if (rawSub != null && String(rawSub).trim() && normalized.subRace === "nenhum" && !isKnownSubRaceInput(rawSub)) {
    warnings.push(`Sub-raca "${rawSub}" nao reconhecida; salva como Nenhum.`);
  }

  const calc = excelCalc(c);
  if (clampResourcesToDerivedMax(c, calc)) {
    warnings.push("HP/MP atuais ajustados ao maximo derivado.");
  }

  return { warnings, calc };
}

function emptyExcelCalc() {
  return {
    mods: { for:0, con:0, agi:0, int:0, mag:0 },
    hpMax: 0, ppMax: 0, ca: 0, initiative: 0, dodge: 0, block: 0, pa: 0,
    physicalReduction: 0, magicReduction: 0,
    race: "nenhum", subRace: "nenhum",
  };
}

// ─── Estado global ─────────────────────────────────────────────────────────────

let state = {
  authReady: false, user: null, profile: null,
  campaign: null, characters: [], diceLog: [], authMode: "login",
};

let currentView = "sheet";
let currentTab  = "general";
let selectedCharacterId = null;
let toastTimer;

// Estado de colapso das secoes (Sprint UX-1). Efemero por sessao: NAO persiste
// no Firestore e nao altera o modelo da ficha. Chave = `${characterId}:${secao}`.
const collapsedSections = {};

// Estado de expansao por item (Sprint UX-1: cards colapsaveis individuais).
// Efemero por sessao; NAO persiste e nao altera o modelo. Default = recolhido
// (item ausente do Set). Item recem-criado e marcado como expandido.
// Chave = `${characterId}:${categoria}:${itemId}`.
const expandedItems = new Set();
let unsubscribers = [];
let campaignSaveTimer;

// Debounce de save por personagem, keyed pelo id
const characterSaveTimers = new Map();

// Personagens com edições locais ainda não confirmadas pelo Firestore snapshot.
// Enquanto marcados aqui, snapshots não sobrescrevem o estado em memória.
const locallyDirtyCharacters = new Set();

// ─── Refs DOM ──────────────────────────────────────────────────────────────────

const el = {
  body:          document.body,
  searchInput:   document.querySelector("#searchInput"),
  characterList: document.querySelector("#characterList"),
  campaignName:  document.querySelector("#campaignName"),
  dashboardView: document.querySelector("#dashboardView"),
  sheetView:     document.querySelector("#sheetView"),
  masterView:    document.querySelector("#masterView"),
  diceView:      document.querySelector("#diceView"),
  loginView:     document.querySelector("#loginView"),
  toast:         document.querySelector("#toast"),
  userPanel:     document.querySelector("#userPanel"),
};

// ─── Utilitários ───────────────────────────────────────────────────────────────

function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultTheme() {
  return { type: "linear", angle: 135, colors: ["#ff4fd8", "#6ee7ff", "#ffe66d"], font: "padrao" };
}

function normalizeCombatSeries(series) {
  const values = Array.isArray(series) ? series : [];
  const out = [];
  for (let i = 0; i < COMBAT_FLOW_SLOTS; i++) {
    out.push(Math.max(0, Number(values[i] || 0)));
  }
  return out;
}

function defaultCombatState() {
  return {
    hpDamage: normalizeCombatSeries(),
    hpHeal: normalizeCombatSeries(),
    ppSpend: normalizeCombatSeries(),
    ppRecover: normalizeCombatSeries(),
  };
}

function normalizeCombatState(combat) {
  const base = defaultCombatState();
  const src = combat || {};
  return {
    hpDamage: normalizeCombatSeries(src.hpDamage ?? base.hpDamage),
    hpHeal: normalizeCombatSeries(src.hpHeal ?? base.hpHeal),
    ppSpend: normalizeCombatSeries(src.ppSpend ?? base.ppSpend),
    ppRecover: normalizeCombatSeries(src.ppRecover ?? base.ppRecover),
  };
}

// Normaliza a lista de equipamentos garantindo a forma por item (Sprint 3).
// Migracao lazy/aditiva: itens antigos sem `armorType` recebem "" (mantem o
// comportamento atual via fallback de inferencia por nome em armorState).
function normalizeEquipmentItem(item) {
  const src = item || {};
  const armorType = ARMOR_TYPE_KEYS.includes(src.armorType) ? src.armorType : "";
  return {
    id: src.id || uid("eq"),
    slot: src.slot ?? "",
    name: src.name ?? "",
    equipped: Boolean(src.equipped),
    notes: src.notes ?? "",
    armorType,
  };
}

function normalizeEquipment(equipment) {
  if (!Array.isArray(equipment)) return [];
  return equipment.map(normalizeEquipmentItem);
}

// Sprint Imagens: normaliza itens de Habilidades/Inventario garantindo `imageUrl`.
// Migracao lazy/aditiva: fichas antigas sem o campo recebem "".
function normalizeAbilityItem(item) {
  const src = item || {};
  return {
    id: src.id || uid("ab"),
    name: src.name ?? "",
    cost: src.cost ?? "",
    effects: src.effects ?? "",
    description: src.description ?? "",
    observations: src.observations ?? "",
    imageUrl: src.imageUrl ?? "",
  };
}

function normalizeInventoryItem(item) {
  const src = item || {};
  return {
    id: src.id || uid("it"),
    name: src.name ?? "",
    description: src.description ?? "",
    qty: Number(src.qty ?? 0),
    weight: Number(src.weight ?? 0),
    observations: src.observations ?? "",
    imageUrl: src.imageUrl ?? "",
  };
}

function normalizeAbilities(abilities) {
  if (!Array.isArray(abilities)) return [];
  return abilities.map(normalizeAbilityItem);
}

function normalizeInventory(inventory) {
  if (!Array.isArray(inventory)) return [];
  return inventory.map(normalizeInventoryItem);
}

function normalizeDocumentItem(item) {
  const src = item && typeof item === "object" ? item : {};
  return {
    ...src,
    id: src.id || uid("doc"),
    name: String(src.name ?? ""),
    url: String(src.url ?? ""),
    storagePath: String(src.storagePath ?? ""),
    size: Math.max(0, Number(src.size || 0)),
    uploadedAt: src.uploadedAt ?? null,
  };
}

function normalizeDocuments(documents) {
  if (!Array.isArray(documents)) return [];
  return documents.map(normalizeDocumentItem);
}

function defaultCharacter(overrides = {}) {
  return {
    ownerId:    state.user?.uid || "",
    ownerName:  state.profile?.displayName || "Jogador",
    player:     state.profile?.displayName || "Jogador",
    campaignId: CAMPAIGN_ID,
    name: "Nova ficha", race: "humano", subRace: "nenhum",
    campaign: state.campaign?.name || "Campanha Principal",
    group: "Grupo principal",
    flavor: "* A alma pulsa como uma pagina viva.",
    avatarUrl: "", lv: 1, nvl: 0, exp: 0, xp: 0, status: "DETERMINADO",
    theme: defaultTheme(),
    attributes: { for:{value:4}, con:{value:6}, agi:{value:7}, int:{value:5}, mag:{value:3} },
    buffs: { for:0, agi:0, int:0, mag:0, con:0, hp:0, pp:0, physicalReduction:0, magicReduction:0 },
    conditions: { inversion: false, hateBoost: false },
    resources: {
      hp:     { label:"HP",   current:20, max:20,  color:"#ff3b5f" },
      mp:     { label:"MP",   current:7,  max:7,   color:"#6ee7ff" },
      cash:   { label:"CASH", current:0,  max:999, color:"#d6ff6e" },
    },
    combat: defaultCombatState(),
    skills: SKILL_NAMES.map((name) => ({ id:uid("sk"), name, trained:false, master:false, extra:0 })),
    abilities: [{
      id: uid("ab"), name: "Ato de Determinacao", cost: "1 MP",
      effects: "Recupera foco narrativo.", description: "Acao especial da ficha.", observations: "", imageUrl: "",
    }],
    inventory: [{
      id: uid("it"), name: "Caderno", description: "Anotacoes da sessao.",
      qty: 1, weight: 0, observations: "", imageUrl: "",
    }],
    equipment: [
      { id:uid("eq"), slot:"Arma",    name:"Faca cega",       equipped:true, notes:"", armorType:"" },
      { id:uid("eq"), slot:"Armadura",name:"Casaco listrado",  equipped:true, notes:"", armorType:"" },
    ],
    documents: [],
    customFields: [
      { id:uid("cf"), label:"Almas", value:"Nenhum" },
    ],
    notes: "Notas rapidas.", history: "Background do personagem.",
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function normalizeCharacter(id, data) {
  const base = defaultCharacter();
  const merged = {
    id, ...base, ...data,
    theme:        { ...base.theme,       ...(data.theme       || {}) },
    attributes:   { ...base.attributes,  ...(data.attributes  || {}) },
    buffs:        { ...base.buffs,       ...(data.buffs        || {}) },
    conditions:   { ...base.conditions,  ...(data.conditions  || {}) },
    resources:    { ...base.resources,   ...(data.resources   || {}) },
    combat:       normalizeCombatState(data.combat ?? base.combat),
    skills:       data.skills?.length ? mergeSkills(data.skills) : base.skills,
    abilities:    normalizeAbilities(data.abilities ?? base.abilities),
    inventory:    normalizeInventory(data.inventory ?? base.inventory),
    equipment:    normalizeEquipment(data.equipment ?? base.equipment),
    documents:    normalizeDocuments(data.documents ?? base.documents),
    customFields: data.customFields ?? base.customFields,
  };
  merged.exp = Math.max(0, Number(data.exp ?? base.exp) || 0);
  merged.xp = Math.max(0, Number(data.xp ?? base.xp) || 0);
  merged.nvl = Math.max(0, Number(data.nvl ?? base.nvl) || 0);
  return applyRaceSubRaceNormalization(merged, data);
}

function mergeSkills(skills) {
  const saved = new Map(skills.map((s) => [norm(s.name), s]));
  return SKILL_NAMES.map((name) => {
    const m = saved.get(norm(name));
    return { id: m?.id || uid("sk"), name, trained: Boolean(m?.trained), master: Boolean(m?.master), extra: Number(m?.extra || 0) };
  });
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

onAuthStateChanged(auth, async (user) => {
  cleanupSubscriptions();
  state = { ...state, authReady:true, user, profile:null, campaign:null, characters:[], diceLog:[] };
  if (!user) { render(); return; }
  state.profile = await ensureUserProfile(user);
  await ensureDefaultCampaign();
  await migrateLegacyLocalDataOnce();
  await migrateRaceSubRaceOnce();
  subscribeToFirestoreData();
  render();
});

async function ensureUserProfile(user, displayName = "") {
  const ref  = doc(firestore, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return { uid: user.uid, ...snap.data() };
  const profile = {
    uid: user.uid, email: user.email,
    displayName: displayName || user.displayName || user.email?.split("@")[0] || "Jogador",
    role: "player", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  return profile;
}

async function ensureDefaultCampaign() {
  const ref  = doc(firestore, "campaigns", CAMPAIGN_ID);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    name: "Campanha Principal", summary: "Sistema central para fichas e dados.",
    status: "Ativa", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

function subscribeToFirestoreData() {
  unsubscribers.push(
    onSnapshot(doc(firestore, "campaigns", CAMPAIGN_ID), (snap) => {
      state.campaign = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      renderIfSafe();
    })
  );

  const charQ = isMaster()
    ? query(collection(firestore, "characters"), where("campaignId","==",CAMPAIGN_ID))
    : query(collection(firestore, "characters"), where("campaignId","==",CAMPAIGN_ID), where("ownerId","==",state.user.uid));

  unsubscribers.push(
    onSnapshot(charQ, (snap) => {
      const byId = new Map(state.characters.map((c) => [c.id, c]));
      state.characters = snap.docs
        .map((d) => {
          // Preserva edições locais durante digitação — não sobrescreve com snapshot
          if (locallyDirtyCharacters.has(d.id) && byId.has(d.id)) {
            const local = byId.get(d.id);
            mergeRaceSubRaceIntoCharacter(local, normalizeCharacter(d.id, d.data()), { overwriteCustomFields: false });
            return local;
          }
          return normalizeCharacter(d.id, d.data());
        })
        .sort((a, b) => String(b.updatedAt?.seconds || "").localeCompare(String(a.updatedAt?.seconds || "")));
      if (!selectedCharacterId || !selectedCharacter()) {
        selectedCharacterId = state.characters[0]?.id || null;
      }
      renderIfSafe();
    })
  );

  unsubscribers.push(
    onSnapshot(query(collection(firestore, "diceLog"), orderBy("createdAt","desc"), limit(40)), (snap) => {
      state.diceLog = snap.docs.map((d) => ({ id:d.id, ...d.data() })).filter((r) => r.campaignId === CAMPAIGN_ID);
      renderIfSafe();
    })
  );
}

function cleanupSubscriptions() {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
}

async function migrateLegacyLocalDataOnce() {
  if (state.profile?.legacyMigratedAt) return;
  const raw = LEGACY_KEYS.map((k) => [k, localStorage.getItem(k)]).find(([,v]) => v);
  if (!raw) {
    await updateDoc(doc(firestore, "users", state.user.uid), { legacyMigratedAt: serverTimestamp() });
    return;
  }
  try {
    const legacy = JSON.parse(raw[1]);
    const batch  = writeBatch(firestore);
    (legacy.characters || []).slice(0, 50).forEach((c) => {
      const normalized = normalizeCharacter("legacy", {
        ...defaultCharacter({
          ownerId: isMaster() ? c.ownerId || state.user.uid : state.user.uid,
          ownerName: c.ownerName || state.profile.displayName,
          player:    c.player    || state.profile.displayName,
          name:      c.name      || "Ficha importada",
          race:      c.race      || c.ancestry || "Humano",
          lv: Number(c.lv || 1),
          notes: c.notes || "", history: c.history || "",
          customFields: c.customFields,
        }),
      });
      const { id: _dropId, ...payload } = normalized;
      batch.set(doc(collection(firestore, "characters")), {
        ...payload,
        importedFromLocalStorage: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    batch.update(doc(firestore, "users", state.user.uid), { legacyMigratedAt: serverTimestamp() });
    await batch.commit();
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    toast("Dados locais migrados para Firestore");
  } catch (e) {
    console.warn("Legacy migration failed:", e);
    toast("Nao foi possivel migrar dados locais");
  }
}

async function migrateRaceSubRaceOnce() {
  const masterMigrationVersion = 1;
  const masterScopeMigrated = Number(state.profile?.raceSubRaceMasterVersion || 0) >= masterMigrationVersion;
  if (state.profile?.raceSubRaceMigratedAt && (!isMaster() || masterScopeMigrated)) return;

  const charQ = isMaster()
    ? query(collection(firestore, "characters"), where("campaignId", "==", CAMPAIGN_ID))
    : query(
        collection(firestore, "characters"),
        where("campaignId", "==", CAMPAIGN_ID),
        where("ownerId", "==", state.user.uid)
      );

  let snap;
  try {
    snap = await getDocs(charQ);
  } catch (e) {
    console.warn("Race/subRace migration query failed:", e);
    return;
  }

  let batch = writeBatch(firestore);
  let ops = 0;
  let migrated = 0;
  const unknownRaces = [];

  try {
    for (const d of snap.docs) {
      const raw = d.data();
      const normalized = normalizeCharacter(d.id, raw);

      if (locallyDirtyCharacters.has(d.id)) {
        const local = state.characters.find((c) => c.id === d.id);
        if (local) mergeRaceSubRaceIntoCharacter(local, normalized);
        continue;
      }

      if (!characterNeedsRaceSubRacePersist(raw, normalized)) continue;

      if (normalized._migration?.raceFrom) {
        unknownRaces.push({ id: d.id, name: raw.name || d.id, from: normalized._migration.raceFrom });
      }

      batch.update(d.ref, buildRaceSubRaceFirestorePatch(raw, normalized));
      ops += 1;
      migrated += 1;

      if (ops >= 500) {
        await batch.commit();
        batch = writeBatch(firestore);
        ops = 0;
      }
    }

    if (ops > 0) await batch.commit();
    const profilePatch = {
      raceSubRaceMigratedAt: serverTimestamp(),
      ...(isMaster() ? { raceSubRaceMasterVersion: masterMigrationVersion } : {}),
    };
    await updateDoc(doc(firestore, "users", state.user.uid), profilePatch);
    state.profile = {
      ...state.profile,
      raceSubRaceMigratedAt: new Date(),
      ...(isMaster() ? { raceSubRaceMasterVersion: masterMigrationVersion } : {}),
    };
    if (migrated > 0) {
      toast(`Raca/sub-raca: ${migrated} ficha(s) migrada(s)`);
    }
    if (unknownRaces.length && isMaster()) {
      console.warn("Fichas com raca nao reconhecida (mapeadas para nenhum):", unknownRaces);
    }
  } catch (e) {
    console.warn("Race/subRace migration failed:", e);
    toast("Nao foi possivel migrar raca/sub-raca");
  }
}

// ─── Permissões ────────────────────────────────────────────────────────────────

function isMaster() {
  return state.profile?.role === "master";
}

function selectedCharacter() {
  return state.characters.find((c) => c.id === selectedCharacterId) || state.characters[0] || null;
}

function canEdit(character = selectedCharacter()) {
  return Boolean(character && (isMaster() || character.ownerId === state.user?.uid));
}

// ─── Navegação ─────────────────────────────────────────────────────────────────

function setView(view) {
  // Players não acessam a view de Mestre — redirecionam para sheet
  if (view === "master" && !isMaster()) view = "sheet";
  currentView = view;
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach((s) => s.classList.remove("active"));
  document.querySelector(`#${view}View`)?.classList.add("active");
  render();
}

// ─── Render principal ──────────────────────────────────────────────────────────

function render() {
  if (!state.authReady) { renderLoading(); return; }
  if (!state.user)      { renderLogin();   return; }

  el.body.classList.remove("auth-locked");

  // body.player-mode ativa as regras CSS:
  //   body.player-mode [data-master-only] { display: none !important }
  // Isso oculta completamente qualquer elemento marcado como restrito a Mestre.
  el.body.classList.toggle("player-mode", !isMaster());

  applyTheme();
  el.campaignName.value    = state.campaign?.name || "";
  el.campaignName.disabled = !isMaster();

  renderUserPanel();
  renderSidebar();

  // Garante que a view de Mestre nunca seja exibida para Players
  if (currentView === "master" && !isMaster()) {
    currentView = "sheet";
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === "sheet"));
    document.querySelectorAll(".view").forEach((s) => s.classList.remove("active"));
    document.querySelector("#sheetView")?.classList.add("active");
  }

  if (currentView === "dashboard") renderDashboard();
  if (currentView === "sheet")     renderSheet();
  if (currentView === "master")    renderMaster();
  if (currentView === "dice")      renderDice();
}

// renderIfSafe: adia o render enquanto um input está com foco,
// evitando recriar o DOM e causar perda de posição de cursor.
function renderIfSafe() {
  if (isTyping()) {
    document.addEventListener("focusout", function handler() {
      document.removeEventListener("focusout", handler);
      setTimeout(() => { if (!isTyping()) render(); }, 50);
    }, { once: true });
    return;
  }
  render();
}

function isTyping() {
  const a = document.activeElement;
  return Boolean(a && ["INPUT","TEXTAREA","SELECT"].includes(a.tagName));
}

// ─── Auth screens ──────────────────────────────────────────────────────────────

function renderLoading() {
  document.querySelectorAll(".view").forEach((s) => s.classList.remove("active"));
  el.loginView.classList.add("active");
  el.loginView.replaceChildren(card("Carregando", [p("Conectando ao Firebase...")]));
}

function renderLogin() {
  el.body.classList.add("auth-locked");
  document.querySelectorAll(".view").forEach((s) => s.classList.remove("active"));
  el.loginView.classList.add("active");
  el.loginView.replaceChildren(
    node("section", "login-screen panel", [
      label_("NIARTALE RPG CORE"),
      node("h2", "big-title", state.authMode === "login" ? "Entrar" : "Cadastro"),
      p("Autenticacao real via Firebase Auth."),
      authForm(),
      btn(state.authMode === "login" ? "Criar conta" : "Ja tenho conta", "ghost-btn", () => {
        state.authMode = state.authMode === "login" ? "register" : "login";
        renderLogin();
      }),
    ])
  );
}

function authForm() {
  const form  = document.createElement("form");
  form.className = "stack";
  const fName  = field("Nome",  "", ()=>{}, { system:true });
  const fEmail = field("Email", "", ()=>{}, { system:true, type:"email" });
  const fPass  = field("Senha", "", ()=>{}, { system:true, type:"password" });
  if (state.authMode === "login") fName.style.display = "none";
  form.append(fName, fEmail, fPass, btn(state.authMode === "login" ? "Entrar" : "Cadastrar", "primary-btn", ()=>{}));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const email = fEmail.querySelector("input").value.trim();
      const pass  = fPass.querySelector("input").value;
      if (state.authMode === "login") {
        await signInWithEmailAndPassword(auth, email, pass);
      } else {
        const name = fName.querySelector("input").value.trim() || email.split("@")[0];
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(cred.user, { displayName: name });
        await ensureUserProfile(cred.user, name);
      }
    } catch (err) {
      console.error(err);
      toast(firebaseErr(err));
    }
  });
  return form;
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────

function renderUserPanel() {
  el.userPanel.replaceChildren(
    node("span", "tag", `${state.profile.displayName} / ${isMaster() ? "Mestre" : "Jogador"}`)
  );
}

function renderSidebar() {
  const q = el.searchInput.value.trim().toLowerCase();
  el.characterList.replaceChildren();

  state.characters
    .filter((c) => [c.name, c.player, c.group, c.campaign].join(" ").toLowerCase().includes(q))
    .forEach((c) => {
      const pill = btn("", `character-pill${c.id === selectedCharacterId ? " active" : ""}`, () => {
        selectedCharacterId = c.id;
        currentTab = "general";
        setView("sheet");
      });
      pill.innerHTML = `<strong>${esc(c.name)}</strong><span>LV ${c.lv} / ${esc(c.player)}</span>`;
      el.characterList.append(pill);
    });

  // Marca botão "Nova ficha" e nav de Mestre como master-only.
  // O CSS com body.player-mode os oculta completamente.
  document.querySelector("#newCharacterBtn")?.setAttribute("data-master-only", "");
  document.querySelectorAll(".nav-btn[data-view='master']").forEach((b) => b.setAttribute("data-master-only", ""));
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

function renderDashboard() {
  // Mestre pode editar a campanha; Player só visualiza
  const campaignCard = isMaster()
    ? card("Campanha", [
        field("Nome",   state.campaign?.name    || "", (v) => updateCampaign({ name: v }),    { system:true }),
        field("Resumo", state.campaign?.summary || "", (v) => updateCampaign({ summary: v }), { system:true, textarea:true }),
      ])
    : card("Campanha", [
        node("p", "muted", state.campaign?.name    || "—"),
        node("p", "muted", state.campaign?.summary || ""),
      ]);

  el.dashboardView.replaceChildren(stack([
    sectionTitle("Dashboard", `${state.characters.length} ficha(s) · ${isMaster() ? "Mestre" : "Jogador"}`),
    node("div", "derived-grid", [
      metricCard("Fichas", state.characters.length),
      metricCard("Role",   isMaster() ? "Mestre" : "Jogador"),
      metricCard("Dados",  state.diceLog.length),
    ]),
    campaignCard,
  ]));
}

// ─── Sheet ─────────────────────────────────────────────────────────────────────

function renderSheet() {
  const c = selectedCharacter();
  if (!c) {
    el.sheetView.replaceChildren(card("Sem fichas", [
      p("Crie uma ficha para comecar."),
      // Botão visível apenas para Mestre
      (() => { const b = btn("Nova ficha", "primary-btn", createCharacter); b.setAttribute("data-master-only",""); return b; })(),
    ]));
    return;
  }
  applyTheme(c);
  el.sheetView.replaceChildren(
    node("div", "character-screen", [
      renderHud(c),
      node("div", "sheet-layout", [
        renderCharacterCard(c),
        node("main", "sheet-main panel", [renderTabs(), node("section", "tab-shell", [renderTab(c)])]),
      ]),
      renderActionBar(c),
    ])
  );
}

function renderHud(c) {
  const calc = excelCalc(c);
  return node("header", "game-hud panel", [
    node("div", "hud-title", [label_("Ficha"), node("strong", "", c.name)]),
    hudStat("LV",     c.lv),
    hudStat("HP",     `${c.resources.hp.current}/${calc.hpMax}`),
    hudStat("MP",     `${c.resources.mp.current}/${calc.ppMax}`),
    hudStat("STATUS", c.status),
  ]);
}

function renderCharacterCard(c) {
  return node("aside", "character-card panel", [
    node("div", "sprite-frame", [
      c.avatarUrl
        ? (() => { const i=document.createElement("img"); i.src=c.avatarUrl; i.alt=c.name; return i; })()
        : node("div", "pixel-soul", [node("span","","♥")]),
    ]),
    field("Nome",    c.name,      (v) => updateChar(c, { name: v }),      { big:true }),
    enumField(
      "Raca", resolveRaceKey(c.race), RACE_KEYS, RACE_LABELS,
      (v) => updateChar(c, { race: v }), { refresh: true, disabled: !canEdit(c) }
    ),
    enumField(
      "Sub-raca", resolveSubRaceKey(c.subRace ?? ""), SUB_RACE_KEYS, SUB_RACE_LABELS,
      (v) => updateChar(c, { subRace: v }),
      { refresh: true, disabled: !canEdit(c), noMechanicalKeys: ["fantasma", "flor", "variados", "boneco magico"] }
    ),
    field("Jogador", c.player,    (v) => updateChar(c, { player: v }),    { disabled: !isMaster() }),
    field("Frase",   c.flavor,    (v) => updateChar(c, { flavor: v }),    { textarea:true }),
  ]);
}

function renderTabs() {
  return node("nav", "tab-bar",
    SHEET_TABS.map(([key, label]) =>
      btn(label, `tab-btn${currentTab===key?" active":""}`, () => { currentTab=key; renderSheet(); })
    )
  );
}

function renderTab(c) {
  return ({
    general:   renderGeneral,
    stats:     renderStats,
    skills:    renderSkills,
    abilities: () => renderAbilities(c),
    inventory: () => renderInventory(c),
    equipment: () => renderEquipment(c),
    notes:     renderNotes,
    history:   renderHistory,
    resources: renderResources,
  })[currentTab](c);
}

// ─── Action bar ────────────────────────────────────────────────────────────────

function renderActionBar(c) {
  const saveBtn = btn("Salvar",    "primary-btn", () => saveChar(c, "Ficha salva"));
  const dupBtn  = btn("Duplicar",  "ghost-btn",   duplicateCharacter);
  const diceBtn = btn("Dados",     "ghost-btn",   () => setView("dice"));
  const newBtn  = btn("Nova ficha","ghost-btn",   createCharacter);

  // Duplicar e Nova ficha são restritos — Players não veem esses botões
  dupBtn.setAttribute("data-master-only", "");
  newBtn.setAttribute("data-master-only", "");

  return node("footer", "action-bar panel", [saveBtn, dupBtn, diceBtn, newBtn]);
}

// ─── Aba Geral ─────────────────────────────────────────────────────────────────

function renderGeneral(c) {
  const canE = canEdit(c);

  // Editor de tema visível apenas para quem pode editar a ficha
  const themeCard = canE ? card("Tema", [renderThemeEditor(c)]) : null;

  // Botão de adicionar campo e botões de remover: só Mestre/dono
  const addFieldBtn = btn("+ Campo", "ghost-btn", () => addCustomField(c));
  if (!canE) addFieldBtn.setAttribute("data-master-only", "");

  const customFields = c.customFields.map((f) => {
    const removeBtn = btn("×", "danger-btn small-btn", () => removeListItem(c, "customFields", f.id));
    if (!canE) removeBtn.setAttribute("data-master-only", "");
    return collapsibleItemCard(c, "customFields", f.id, f.label, [
      field("Campo", f.label, (v) => updateCustomField(c, f.id, { label: v })),
      field("Valor", f.value, (v) => updateCustomField(c, f.id, { value: v })),
    ], removeBtn);
  });

  const infoCard = card("Informacoes", [
    node("div", "grid two", [
      field("Campanha",  c.campaign,  (v) => updateChar(c, { campaign: v })),
      field("Grupo",     c.group,     (v) => updateChar(c, { group: v })),
      field("LV",        c.lv,        (v) => updateChar(c, { lv: Number(v||1) }), { type:"number" }),
      field("Status",    c.status,    (v) => updateChar(c, { status: v })),
      field("Avatar URL",c.avatarUrl, (v) => updateChar(c, { avatarUrl: v }), { refresh:true }),
    ]),
  ]);

  return stack([
    sectionTitle("Geral", "Identidade e informacoes do personagem."),
    themeCard ? node("div", "grid two", [infoCard, themeCard]) : infoCard,
    collapsibleCard(c, "customFields", "Campos extras", [...customFields, addFieldBtn], { count: c.customFields.length }),
    renderDocuments(c),
  ].filter(Boolean));
}

function renderDocuments(c) {
  const canE = canEdit(c);
  const documents = c.documents || [];
  const list = node("div", "list-grid", documents.map((item) => buildDocumentCard(c, item, canE)));
  const addUrlBtn = btn("+ PDF por URL", "primary-btn", () => addDocumentUrl(c));
  if (!canE || documents.length >= MAX_PDFS_PER_CHARACTER) addUrlBtn.disabled = true;

  const uploadInput = document.createElement("input");
  uploadInput.type = "file";
  uploadInput.accept = "application/pdf";
  uploadInput.hidden = true;
  uploadInput.addEventListener("change", async () => {
    const file = uploadInput.files?.[0];
    uploadInput.value = "";
    if (file) await uploadPdfDocument(c, file);
  });

  const uploadBtn = btn("Enviar PDF", "ghost-btn", () => uploadInput.click());
  if (!canE || documents.length >= MAX_PDFS_PER_CHARACTER) uploadBtn.disabled = true;

  const hint = node("p", "", `Limite: ${documents.length}/${MAX_PDFS_PER_CHARACTER} PDFs, ate 10 MB cada.`);
  return collapsibleCard(c, "documents", "Documentos (PDF)", [
    list,
    node("div", "pdf-actions", [addUrlBtn, uploadBtn, uploadInput]),
    hint,
  ], { count: documents.length });
}

function buildDocumentCard(c, item, canE) {
  const idxOf = () => (c.documents || []).findIndex((docItem) => docItem.id === item.id);
  const updateDocItem = (patch) => {
    const idx = idxOf();
    if (idx !== -1) updateArrayItem(c, "documents", idx, patch);
  };

  const meta = item.storagePath
    ? node("p", "pdf-meta", `${formatBytes(item.size)} · arquivo enviado`)
    : node("p", "pdf-meta", "URL externa");

  const uploadInput = document.createElement("input");
  uploadInput.type = "file";
  uploadInput.accept = "application/pdf";
  uploadInput.hidden = true;
  uploadInput.addEventListener("change", async () => {
    const file = uploadInput.files?.[0];
    uploadInput.value = "";
    if (file) await uploadPdfDocument(c, file, item.id);
  });

  const openBtn = btn("Abrir PDF", "ghost-btn small-btn", () => openPdfPopup(item.url, item.name || "PDF"));
  const tabBtn = btn("Nova aba", "ghost-btn small-btn", () => openPdfInNewTab(item.url));
  if (!String(item.url || "").trim()) {
    openBtn.disabled = true;
    tabBtn.disabled = true;
  }

  const replaceBtn = btn(item.storagePath ? "Substituir PDF" : "Enviar arquivo", "ghost-btn small-btn", () => uploadInput.click());
  if (!canE) replaceBtn.disabled = true;

  const removeBtn = btn("Remover", "danger-btn small-btn", async () => removeDocument(c, item.id));
  if (!canE) removeBtn.disabled = true;

  const grid = node("div", "grid two", [
    field("Nome", item.name, (v) => updateDocItem({ name: String(v || "").slice(0, 120) }), { disabled: !canE }),
    field("URL", item.url, (v) => updateDocItem({ url: String(v || "").slice(0, 2048) }), { disabled: !canE || Boolean(item.storagePath) }),
  ]);

  return collapsibleItemCard(c, "documents", item.id, item.name || "PDF", [
    grid,
    meta,
    node("div", "pdf-actions", [openBtn, tabBtn, replaceBtn, uploadInput]),
  ], removeBtn);
}

function renderThemeEditor(c) {
  const t = c.theme;
  const setColors = (i, v) => {
    const cols = [...t.colors]; cols[i] = v;
    updateTheme(c, { colors: cols });
  };
  return stack([
    node("div", "theme-preview", [node("span","","Tema")], { style:`background:${gradient(t)}` }),
    node("div", "grid three", [
      colorField("Cor 1", t.colors[0], (v) => setColors(0, v)),
      colorField("Cor 2", t.colors[1], (v) => setColors(1, v)),
      colorField("Cor 3", t.colors[2], (v) => setColors(2, v)),
    ]),
    selectField("Tipo", t.type, ["linear","radial"], (v) => updateTheme(c, { type: v }), { refresh:true }),
    rangeField("Angulo", t.angle, 0, 360, (v) => updateTheme(c, { angle: v })),
    enumField(
      "Fonte", FONT_KEYS.includes(t.font) ? t.font : "padrao",
      FONT_KEYS, FONT_LABELS,
      (v) => updateTheme(c, { font: v }),
      { refresh: true, disabled: !canEdit(c) }
    ),
  ]);
}

// ─── Aba Atributos ─────────────────────────────────────────────────────────────

function renderStats(c) {
  const calc = excelCalc(c);
  const applied = appliedPoints(c);
  return stack([
    sectionTitle("Atributos", "Modificadores calculados automaticamente."),
    node("div", "attribute-grid",
      ATTRIBUTE_KEYS.map(([key, lbl, name]) => {
        const attr = c.attributes[key];
        return node("article", "attribute-card", [
          node("div", "attribute-label", [node("strong","",lbl), node("span","",name)]),
          node("div", "attribute-score", calc.mods[key]),
          field("Valor", attr.value, (v) => updateNested(c, ["attributes",key,"value"], Number(v||0)), { type:"number", refresh:true }),
          node("span", "calc-note", `ROUNDDOWN(${attr.value||0}/4) + modificadores`),
        ]);
      })
    ),
    card("Buffs", [
      node("div", "grid three", [
        ...["for","agi","int","mag","con","hp","pp"].map((k) =>
          field(k.toUpperCase(), c.buffs[k], (v) => updateNested(c, ["buffs",k], Number(v||0)), { type:"number", refresh:true })
        ),
        field("RD FIS", c.buffs.physicalReduction, (v) => updateNested(c, ["buffs","physicalReduction"], Number(v||0)), { type:"number", refresh:true }),
        field("RD MAG", c.buffs.magicReduction, (v) => updateNested(c, ["buffs","magicReduction"], Number(v||0)), { type:"number", refresh:true }),
      ]),
    ]),
    card("Condicoes", [
      node("div", "grid two", [
        checkField("HATE", c.conditions?.hateBoost, (v) => updateNested(c, ["conditions","hateBoost"], Boolean(v)), { refresh:true }),
        checkField("Inversao", c.conditions?.inversion, (v) => updateNested(c, ["conditions","inversion"], Boolean(v)), { refresh:true }),
      ]),
    ]),
    card("Progressao", [
      node("div", "grid three", [
        field("LEVEL", c.lv, (v) => updateChar(c, { lv: Number(v||1) }), { type:"number", refresh:true }),
        field("NIVEL", c.nvl, (v) => updateChar(c, { nvl: Number(v||0) }), { type:"number", refresh:true }),
        field("EXP", c.exp, (v) => updateChar(c, { exp: Number(v||0) }), { type:"number", refresh:true }),
        field("XP", c.xp, (v) => updateChar(c, { xp: Number(v||0) }), { type:"number", refresh:true }),
      ]),
      node("div", "derived-grid", [
        metricCard("APLICADOS", applied),
      ]),
    ]),
    calculatedPanel(calc),
  ]);
}

function calculatedPanel(calc) {
  return card("Calculados", [
    node("div", "derived-grid", [
      metricCard("PV",      calc.hpMax),
      metricCard("PP",      calc.ppMax),
      metricCard("C.A",     calc.ca),
      metricCard("INI",     calc.initiative),
      metricCard("ESQ",     calc.dodge),
      metricCard("BLOQ",    calc.block),
      metricCard("P.A",     calc.pa),
      metricCard("R.FIS",   calc.physicalReduction),
      metricCard("R.MAG",   calc.magicReduction),
    ]),
  ]);
}

// ─── Aba Perícias ──────────────────────────────────────────────────────────────

function renderSkills(c) {
  return stack([
    sectionTitle("Pericias", "Treinado +5 · Mestre +10 · Extra manual."),
    node("div", "skill-list",
      c.skills.map((skill, i) =>
        node("article", "skill-row", [
          node("strong", "", skill.name),
          checkField("Trei.", skill.trained, (v) => updateArrayItem(c,"skills",i,{trained:v}), { refresh:true }),
          checkField("Mestre", skill.master,  (v) => updateArrayItem(c,"skills",i,{master:v}),  { refresh:true }),
          field("Extra", skill.extra, (v) => updateArrayItem(c,"skills",i,{extra:Number(v||0)}), { type:"number", refresh:true }),
          node("b", "bonus", `+${skillBonus(c, skill.name)}`),
        ])
      )
    ),
  ]);
}

// ─── Aba Habilidades ───────────────────────────────────────────────────────────
// Usa buildStableListEditor para não recriar inputs durante digitação.

function renderAbilities(c) {
  return stack([
    sectionTitle("Habilidades", "Poderes e acoes especiais do personagem."),
    collapsibleCard(c, "abilities", "Habilidades", [
      buildStableListEditor(c, "abilities",
        ["name","cost","effects","description","observations"],
        () => addListItem(c, "abilities", { name:"", cost:"", effects:"", description:"", observations:"", imageUrl:"" })
      ),
    ], { count: (c.abilities || []).length }),
  ]);
}

// ─── Aba Inventário ────────────────────────────────────────────────────────────

function renderInventory(c) {
  return stack([
    sectionTitle("Inventario", "Itens carregados pelo personagem."),
    collapsibleCard(c, "inventory", "Inventario", [
      buildStableListEditor(c, "inventory",
        ["name","description","qty","weight","observations"],
        () => addListItem(c, "inventory", { name:"", description:"", qty:1, weight:0, observations:"", imageUrl:"" })
      ),
    ], { count: (c.inventory || []).length }),
  ]);
}

// ─── Editor de lista estável ───────────────────────────────────────────────────
// Cada item vira um card independente. Os inputs usam eventos nativos (input/blur)
// para atualizar o estado em memória — sem chamar render() — evitando perda de foco.
// O save no Firestore é agendado com debounce de 700 ms.

function buildStableListEditor(c, key, fields, defaultItem) {
  const canE   = canEdit(c);
  const items  = c[key] || [];
  const label  = key === "abilities" ? "Habilidade" : "Item";

  const listContainer = node("div", "list-grid", items.map((item) => buildItemCard(c, key, item, fields, canE)));
  const addBtn = btn(`+ ${label}`, "primary-btn", async () => {
    await addListItem(c, key, defaultItem);
  });
  if (!canE) addBtn.disabled = true;

  const wrapper = node("div", "list-editor-wrapper");
  wrapper.append(listContainer, addBtn);
  return wrapper;
}

function buildItemCard(c, key, item, fields, canE) {
  const grid  = node("div", "grid two");

  fields.forEach((fname) => {
    const isNum  = fname === "qty" || fname === "weight";
    const isArea = ["description","observations","effects"].includes(fname);
    const input  = isArea ? document.createElement("textarea") : document.createElement("input");

    input.value = item[fname] ?? (isNum ? 0 : "");
    if (!isArea) input.type = isNum ? "number" : "text";
    if (!canE)   input.disabled = true;

    // `input` → atualiza memória sem render (mantém foco)
    input.addEventListener("input", () => {
      const val = isNum ? Number(input.value || 0) : input.value;
      const idx = c[key].findIndex((i) => i.id === item.id);
      if (idx !== -1) {
        c[key][idx] = { ...c[key][idx], [fname]: val };
        item[fname]  = val;
        scheduleCharSave(c);
      }
    });

    // `blur` → garante save ao sair do campo
    input.addEventListener("blur", () => scheduleCharSave(c));

    grid.append(node("label", "field", [node("span","",labelFor(fname)), input]));
  });

  const removeBtn = btn("Remover", "danger-btn small-btn", async () => {
    await removeListItem(c, key, item.id);
  });
  if (!canE) removeBtn.disabled = true;

  const imageUrlField = field("Imagem (URL)", item.imageUrl || "", (v) => {
    const idx = c[key].findIndex((i) => i.id === item.id);
    if (idx !== -1) updateArrayItem(c, key, idx, { imageUrl: String(v || "") });
  }, { refresh:true, disabled: !canE });

  const thumb = (item.imageUrl || "").trim()
    ? (() => {
        const img = document.createElement("img");
        img.src = item.imageUrl;
        img.alt = item.name || "Imagem do item";
        img.loading = "lazy";
        img.addEventListener("error", () => img.remove());
        const thumbBtn = btn("", "item-thumb-btn", () => openImagePopup(item.imageUrl, item.name || "Imagem"));
        thumbBtn.setAttribute("type", "button");
        thumbBtn.setAttribute("aria-label", "Abrir imagem");
        thumbBtn.append(img);
        const openBtn = btn("Abrir imagem", "ghost-btn small-btn", () => openImagePopup(item.imageUrl, item.name || "Imagem"));
        return node("div", "item-image-preview", [thumbBtn, openBtn]);
      })()
    : null;

  return collapsibleItemCard(c, key, item.id, item.name, [grid, imageUrlField, thumb], removeBtn);
}

// ─── Aba Equipamentos (Sprint 3) ───────────────────────────────────────────────
// Texto (slot/name/notes) usa inputs nativos para nao perder foco durante digitacao.
// armorType (select) e equipped (checkbox) recalculam derivados via refresh.

function renderEquipment(c) {
  const canE = canEdit(c);
  const items = c.equipment || [];

  const list = node("div", "list-grid", items.map((item) => buildEquipmentCard(c, item, canE)));

  const addBtn = btn("+ Equipamento", "primary-btn", async () => {
    await addListItem(c, "equipment", { slot:"", name:"", equipped:false, notes:"", armorType:"" });
  });
  if (!canE) addBtn.disabled = true;

  return stack([
    sectionTitle("Equipamentos", "Itens equipados e tipo de armadura."),
    collapsibleCard(c, "equipment", "Equipamentos", [
      node("div", "list-editor-wrapper", [list, addBtn]),
    ], { count: items.length }),
  ]);
}

function buildEquipmentCard(c, item, canE) {
  const idxOf = () => c.equipment.findIndex((e) => e.id === item.id);

  const textField = (fname, isArea = false) => {
    const input = isArea ? document.createElement("textarea") : document.createElement("input");
    input.value = item[fname] ?? "";
    if (!isArea) input.type = "text";
    if (!canE) input.disabled = true;
    input.addEventListener("input", () => {
      const idx = idxOf();
      if (idx !== -1) {
        c.equipment[idx] = { ...c.equipment[idx], [fname]: input.value };
        item[fname] = input.value;
        scheduleCharSave(c);
      }
    });
    input.addEventListener("blur", () => scheduleCharSave(c));
    return node("label", "field", [node("span","",labelFor(fname)), input]);
  };

  const grid = node("div", "grid two", [
    textField("slot"),
    textField("name"),
    enumField(
      "Tipo de armadura", ARMOR_TYPE_KEYS.includes(item.armorType) ? item.armorType : "",
      ARMOR_TYPE_KEYS, ARMOR_TYPE_LABELS,
      (v) => { const idx = idxOf(); if (idx !== -1) updateArrayItem(c, "equipment", idx, { armorType: v }); },
      { refresh:true, disabled: !canE }
    ),
    checkField(
      "Equipado", item.equipped,
      (v) => { const idx = idxOf(); if (idx !== -1) updateArrayItem(c, "equipment", idx, { equipped: Boolean(v) }); },
      { refresh:true }
    ),
    textField("notes", true),
  ]);

  const removeBtn = btn("Remover", "danger-btn small-btn", async () => {
    await removeListItem(c, "equipment", item.id);
  });
  if (!canE) removeBtn.disabled = true;

  const title = [item.slot, item.name]
    .map((s) => String(s ?? "").trim()).filter(Boolean).join(" — ");
  return collapsibleItemCard(c, "equipment", item.id, title, [grid], removeBtn);
}

// ─── Outras abas ───────────────────────────────────────────────────────────────

function renderNotes(c) {
  return collapsibleCard(c, "notes", "Notas", [field("Notas", c.notes, (v) => updateChar(c, { notes: v }), { textarea:true })]);
}

function renderHistory(c) {
  return card("Historia", [field("Background", c.history, (v) => updateChar(c, { history: v }), { textarea:true })]);
}

function renderResources(c) {
  const calc = excelCalc(c);
  const flow = combatFlow(c, calc);
  const editableResources = Object.entries(c.resources || {}).filter(([k]) => k !== "energy");
  return stack([
    sectionTitle("Recursos", "Barras e valores atuais."),
    card("Barras", [resourceBars(c)]),
    calculatedPanel(calc),
    renderCombatFlowCard(c, flow),
    card("Editar atuais", [
      node("div", "grid three",
        editableResources.map(([k, r]) =>
          field(r.label, r.current, (v) => updateNested(c, ["resources",k,"current"], Number(v||0)), { type:"number", refresh:true })
        )
      ),
    ]),
  ]);
}

// ─── Mestre ────────────────────────────────────────────────────────────────────

function renderMaster() {
  // Players são redirecionados em setView()/render() — guarda extra por segurança
  if (!isMaster()) { el.masterView.replaceChildren(); return; }

  el.masterView.replaceChildren(stack([
    sectionTitle("Mestre", "Controle de campanha e fichas de jogadores."),
    card("Campanha", [
      field("Nome",   state.campaign?.name    || "", (v) => updateCampaign({ name: v }),    { system:true }),
      field("Status", state.campaign?.status  || "", (v) => updateCampaign({ status: v }),  { system:true }),
      field("Resumo", state.campaign?.summary || "", (v) => updateCampaign({ summary: v }), { textarea:true, system:true }),
    ]),
    card("Fichas", [
      ...state.characters.map((c) =>
        rowCard([
          node("strong","",c.name),
          node("span","tag",[
            `${c.player} / ${RACE_LABELS[resolveRaceKey(c.race)] || c.race}`,
            resolveSubRaceKey(c.subRace ?? "") !== "nenhum"
              ? ` / ${SUB_RACE_LABELS[resolveSubRaceKey(c.subRace ?? "")]}`
              : "",
            ` / LV ${c.lv}`,
          ].join("")),
          btn("Abrir",  "ghost-btn",  () => { selectedCharacterId=c.id; setView("sheet"); }),
          btn("Excluir","danger-btn", () => deleteCharacter(c)),
        ])
      ),
    ]),
  ]));
}

// ─── Dados ─────────────────────────────────────────────────────────────────────

function renderDice() {
  el.diceView.replaceChildren(stack([
    sectionTitle("Dados", "Formatos: d20 · 2d6+3 · d100"),
    card("Rolador", [
      node("div", "dice-buttons",
        [20,12,10,8,6,4].map((s) => btn(`d${s}`, "primary-btn", () => rollDice(`1d${s}`)))
      ),
      diceInputForm(),
    ]),
    card("Resultados", [
      node("div", "dice-log",
        state.diceLog.length
          ? state.diceLog.map((r) =>
              rowCard([
                node("strong","",`${r.formula}: ${r.total}`),
                node("span","tag",r.detail),
                p(r.userName || "Jogador"),
              ])
            )
          : [p("Nenhuma rolagem ainda.")]
      ),
    ]),
  ]));
}

function diceInputForm() {
  const form  = document.createElement("form");
  form.className = "battle-actions";
  const input = document.createElement("input");
  input.value = "1d20"; input.placeholder = "ex: 2d6+3";
  form.append(input, btn("Rolar", "primary-btn", ()=>{}));
  form.addEventListener("submit", (e) => { e.preventDefault(); rollDice(input.value); });
  return form;
}

async function rollDice(raw) {
  const parsed = parseDice(raw);
  if (!parsed) { toast("Formula invalida"); return; }
  const rolls = Array.from({ length: parsed.count }, () => 1 + Math.floor(Math.random() * parsed.sides));
  const total = rolls.reduce((s, v) => s + v, 0) + parsed.mod;
  await addDoc(collection(firestore, "diceLog"), {
    campaignId: CAMPAIGN_ID, userId: state.user.uid,
    userName: state.profile.displayName, formula: parsed.label, total,
    detail: `[${rolls.join(", ")}]${parsed.mod ? ` ${parsed.mod>0?"+":""}${parsed.mod}` : ""}`,
    createdAt: serverTimestamp(),
  });
  toast(`${parsed.label} = ${total}`);
}

function parseDice(input) {
  const m = String(input).trim().toLowerCase().match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!m) return null;
  const count = Number(m[1]||1), sides = Number(m[2]), mod = Number(m[3]||0);
  if (!Number.isInteger(count)||!Number.isInteger(sides)||count<1||count>100||sides<2||sides>1000) return null;
  return { count, sides, mod, label:`${count}d${sides}${mod?(mod>0?"+":"")+mod:""}` };
}

// ─── Persistência ──────────────────────────────────────────────────────────────

async function updateCampaign(patch) {
  if (!isMaster()) { toast("Apenas Mestre edita campanha"); return; }
  state.campaign = { ...state.campaign, ...patch };
  clearTimeout(campaignSaveTimer);
  campaignSaveTimer = setTimeout(async () => {
    await updateDoc(doc(firestore, "campaigns", CAMPAIGN_ID), { ...patch, updatedAt: serverTimestamp() });
    toast("Campanha salva");
  }, 650);
}

// updateChar: atualiza em memória e agenda save. NÃO chama render()
// para não destruir inputs com foco durante digitação.
function updateChar(c, patch) {
  if (!canEdit(c)) return;
  const next = { ...patch };
  if (next.race != null) next.race = resolveRaceKey(next.race);
  if (next.subRace != null) next.subRace = resolveSubRaceKey(next.subRace);
  Object.assign(c, next);

  if (next.race != null || next.subRace != null) {
    ensureCharacterRaceSubRace(c);
    const calc = excelCalc(c);
    clampResourcesToDerivedMax(c, calc);
    if (!isTyping()) render();
  }

  scheduleCharSave(c);
}

function updateTheme(c, patch) {
  updateChar(c, { theme: { ...c.theme, ...patch } });
  render(); // Tema precisa re-render imediato para atualizar preview visual
}

function updateNested(c, path, value) {
  if (!canEdit(c)) return;
  let t = c;
  path.slice(0,-1).forEach((k) => { t[k]={...t[k]}; t=t[k]; });
  t[path.at(-1)] = value;
  scheduleCharSave(c);
}

function updateArrayItem(c, key, idx, patch) {
  if (!canEdit(c)) return;
  c[key] = c[key].map((item, i) => i===idx ? { ...item, ...patch } : item);
  scheduleCharSave(c);
}

// scheduleCharSave: debounce de 700ms antes de persistir.
// Marca o personagem como dirty para bloquear snapshots Firestore
// de sobrescrever edições locais enquanto o usuário digita.
function scheduleCharSave(c) {
  if (!c?.id || !canEdit(c)) return;
  locallyDirtyCharacters.add(c.id);
  clearTimeout(characterSaveTimers.get(c.id));
  characterSaveTimers.set(c.id, setTimeout(() => saveChar(c), 700));
}

async function saveChar(c, message) {
  if (!canEdit(c) || !c?.id) return;
  clearTimeout(characterSaveTimers.get(c.id));

  const { warnings } = sanitizeCharacterForPersist(c);
  const { id, ...data } = c;
  await updateDoc(doc(firestore, "characters", id), { ...data, updatedAt: serverTimestamp() });

  characterSaveTimers.delete(c.id);
  setTimeout(() => locallyDirtyCharacters.delete(c.id), 350);

  if (message) toast(message);
  else if (warnings.length) toast(warnings[0]);
}

// ─── CRUD personagens ──────────────────────────────────────────────────────────

async function createCharacter() {
  const normalized = normalizeCharacter("new", defaultCharacter({
    name: `Personagem ${state.characters.length + 1}`,
  }));
  const { id: _id, ...payload } = normalized;
  const ref = await addDoc(collection(firestore, "characters"), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  selectedCharacterId = ref.id;
  currentTab = "general";
  toast("Ficha criada");
}

async function duplicateCharacter() {
  const src = selectedCharacter();
  if (!canEdit(src)) { toast("Sem permissao"); return; }
  const { id, createdAt, updatedAt, ...copy } = src;
  sanitizeCharacterForPersist(copy);
  // I1: limpar storagePath dos documentos copiados para que remover/substituir
  // PDF na copia nunca apague o arquivo fisico da ficha original. A url e
  // preservada para que o PDF continue acessivel como referencia somente leitura.
  if (Array.isArray(copy.documents)) {
    copy.documents = copy.documents.map((docItem) => ({
      ...docItem,
      storagePath: "",
    }));
  }
  const ref = await addDoc(collection(firestore, "characters"), {
    ...copy,
    ownerId:   isMaster() ? copy.ownerId   : state.user.uid,
    ownerName: isMaster() ? copy.ownerName : state.profile.displayName,
    player:    isMaster() ? copy.player    : state.profile.displayName,
    name: `${copy.name} (copia)`,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  selectedCharacterId = ref.id;
  toast("Ficha duplicada");
}

async function deleteCharacter(c) {
  if (!isMaster() && c.ownerId !== state.user.uid) { toast("Sem permissao"); return; }
  await deleteDoc(doc(firestore, "characters", c.id));
  toast("Ficha excluida");
}

// ─── CRUD campos e listas ──────────────────────────────────────────────────────

async function addCustomField(c) {
  if (!canEdit(c)) { toast("Sem permissao"); return; }
  const id = uid("cf");
  c.customFields.push({ id, label:"Novo campo", value:"" });
  markItemExpanded(c, "customFields", id);
  await saveChar(c, "Campo adicionado");
  render();
}

// Atualiza um campo extra localizando-o por id (robusto a reordenacao).
function updateCustomField(c, id, patch) {
  if (!canEdit(c)) return;
  const idx = c.customFields.findIndex((f) => f.id === id);
  if (idx !== -1) updateArrayItem(c, "customFields", idx, patch);
}

async function addDocumentUrl(c) {
  if (!canEdit(c)) { toast("Sem permissao"); return; }
  if ((c.documents || []).length >= MAX_PDFS_PER_CHARACTER) {
    toast(`Limite de ${MAX_PDFS_PER_CHARACTER} PDFs`);
    return;
  }
  const id = uid("doc");
  c.documents = [...(c.documents || []), normalizeDocumentItem({ id, name:"Novo PDF", url:"" })];
  markItemExpanded(c, "documents", id);
  await saveChar(c, "PDF adicionado");
  render();
}

async function uploadPdfDocument(c, file, existingId = null) {
  if (!canEdit(c)) { toast("Sem permissao"); return; }
  if (!c?.id || c.id === "new") { toast("Salve a ficha antes do upload"); return; }
  if (!file) return;
  const looksLikePdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!looksLikePdf) { toast("Envie apenas PDF"); return; }
  if (file.size > MAX_PDF_BYTES) { toast("PDF acima de 10 MB"); return; }
  if (!existingId && (c.documents || []).length >= MAX_PDFS_PER_CHARACTER) {
    toast(`Limite de ${MAX_PDFS_PER_CHARACTER} PDFs`);
    return;
  }

  const id = existingId || uid("doc");
  const docs = c.documents || [];
  const idx = docs.findIndex((item) => item.id === id);
  const previous = idx !== -1 ? docs[idx] : null;
  const path = `characters/${c.id}/documents/${id}-${safeStorageFileName(file.name)}`;

  try {
    const ref = storageRef(storage, path);
    await uploadBytes(ref, file, { contentType: "application/pdf" });
    const url = await getDownloadURL(ref);
    const patch = normalizeDocumentItem({
      id,
      name: previous?.name || file.name.replace(/\.pdf$/i, ""),
      url,
      storagePath: path,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    });

    c.documents = idx !== -1
      ? docs.map((item, i) => i === idx ? { ...item, ...patch } : item)
      : [...docs, patch];

    if (previous?.storagePath && previous.storagePath !== path) {
      deleteObject(storageRef(storage, previous.storagePath)).catch((e) => console.warn("Old PDF cleanup failed:", e));
    }

    markItemExpanded(c, "documents", id);
    await saveChar(c, "PDF enviado");
    render();
  } catch (e) {
    console.warn("PDF upload failed:", e);
    toast("Falha ao enviar PDF");
  }
}

async function removeDocument(c, id) {
  if (!canEdit(c)) { toast("Sem permissao"); return; }
  const item = (c.documents || []).find((docItem) => docItem.id === id);
  if (!item) return;
  if (item.storagePath) {
    try {
      await deleteObject(storageRef(storage, item.storagePath));
    } catch (e) {
      console.warn("PDF storage deletion failed:", e);
    }
  }
  c.documents = (c.documents || []).filter((docItem) => docItem.id !== id);
  await saveChar(c, "PDF removido");
  render();
}

async function addListItem(c, key, defaults) {
  if (!canEdit(c)) { toast("Sem permissao"); return; }
  const id = uid(key);
  c[key] = [...(c[key]||[]), { id, ...defaults }];
  markItemExpanded(c, key, id);
  await saveChar(c, key==="abilities" ? "Habilidade adicionada" : "Item adicionado");
  render();
}

async function removeListItem(c, key, id) {
  if (!canEdit(c)) { toast("Sem permissao"); return; }
  c[key] = c[key].filter((item) => item.id !== id);
  await saveChar(c, key==="abilities" ? "Habilidade removida" : key==="inventory" ? "Item removido" : "Campo removido");
  render();
}

// ─── Cálculos ──────────────────────────────────────────────────────────────────

function resourceBars(c) {
  const calc = excelCalc(c);
  return node("div", "bars",
    ["hp","mp","cash"].map((k) => {
      const r   = c.resources[k] || { label:k.toUpperCase(), current:0, max:0, color:"#fff" };
      const max = k==="hp" ? calc.hpMax : k==="mp" ? calc.ppMax : r.max;
      const pct = max ? Math.max(0, Math.min(100, (r.current/max)*100)) : 0;
      return node("div", "bar-row", [
        node("span","",r.label),
        node("div", "bar-track", [node("i","","",{ style:`width:${pct}%;background:${r.color}` })]),
        node("b","",`${r.current}/${max}`),
      ]);
    })
  );
}

function excelCalc(c = selectedCharacter()) {
  if (!c) return emptyExcelCalc();

  ensureCharacterRaceSubRace(c);
  const race = c.race;
  const subRace = c.subRace;

  const isMonster = race === "monstro";
  const isHuman   = race === "humano";
  const raceBase  = (isHuman || isMonster) ? 1 : 0;
  const buf       = c.buffs || {};
  const base      = (k) => Math.trunc(Number(c.attributes[k]?.value || 0) / 4);
  const hate      = c.conditions?.hateBoost ?? false;
  const boost     = (hate ? 30 : 0) + (c.conditions?.inversion ? 14 : 0);
  const hateRD    = hate ? 16 : 0;

  const sr = SUB_RACE_SR[subRace] ?? {};

  // ── Modificadores de atributo (H15–H23) ──────────────────────────────────────
  const mods = {
    // H15 — Réptil recebe forMod fixo sem buf.for; demais sub-raças recebem buf.for
    for: base("for") + raceBase + boost + (sr.forMod ?? 0) + (sr.suppressForBuf ? 0 : Number(buf.for||0)),
    // H17
    con: base("con") + raceBase + boost + (sr.conMod ?? 0) + Number(buf.con||0),
    // H19 — cascata: mods.agi alimenta ca, initiative e dodge
    agi: base("agi") + raceBase + boost + (sr.agiMod ?? 0) + Number(buf.agi||0),
    // H21 — INT não recebe boost de HATE/Inversão (ausência intencional da planilha)
    int: base("int") + raceBase + Number(buf.int||0),
    // H23
    mag: base("mag") + raceBase + boost + (sr.magMod ?? 0) + Number(buf.mag||0),
  };

  // ── Derivados ────────────────────────────────────────────────────────────────
  const armor = armorState(c);

  // Submódulos nomeados — isolam a contribuição de cada fator para auditabilidade
  const armorCA      = (armor.light?2:0) - (armor.medium?3:0) - (armor.heavy?6:0);
  const armorDodgePen = (armor.medium?3:0) + (armor.heavy?6:0);
  const armorRD      = (armor.light?5:0) + (armor.medium?10:0) + (armor.heavy?20:0);

  // K24 — Elemental retorna 0 direto; buf.hp ignorado para Elemental
  const hpBase = isHuman ? 20 + mods.con : isMonster ? 10 + mods.mag / 2 : 0;
  const hpBonus = sr.hpBonus === "con" ? mods.con : 0;
  const hpMax   = sr.hpZero ? 0
    : Math.trunc(hpBase)
      - (sr.hpPen ?? 0) + hpBonus + Number(buf.hp||0);

  // K27 — buf.pp somado após ×2, não dobrado
  const ppBase = isHuman ? 7 + mods.mag / 2 : isMonster ? 15 + mods.mag : 0;
  const ppMax = Math.trunc(ppBase)
    * (sr.ppDouble ? 2 : 1) + Number(buf.pp||0);

  // F26 — caBonus1 e caBonus2 preservados separados (dois IFs distintos na planilha para Réptil)
  const ca = 10 + mods.agi + armorCA + (sr.caBonus1 ?? 0) + (sr.caBonus2 ?? 0);

  // F28 / H28
  const initiative = mods.agi + skillBonus(c, "Reflexo");
  const dodge      = initiative - armorDodgePen - (sr.dodgePen ?? 0);

  // H26
  const block = mods.con - (isMonster?3:0) - (sr.blockPen ?? 0);

  // F30
  const pa = mods.int + skillBonus(c, "Percepcao");

  // X15 / X16
  const physicalReduction = Math.round(armorRD + hateRD + (sr.rdFis ?? 0) + Number(buf.physicalReduction||0));
  const magicReduction    = Math.round(          hateRD + (sr.rdMag ?? 0) + Number(buf.magicReduction||0));

  return {
    mods, hpMax, ppMax, ca, initiative, dodge, block, pa, physicalReduction, magicReduction,
    race, subRace,
  };
}

function skillBonus(c, name) {
  const s = c.skills.find((sk) => norm(sk.name) === norm(name));
  return s ? (s.trained?5:0)+(s.master?10:0)+Number(s.extra||0) : 0;
}

// Inferencia por nome/slot (fallback de compatibilidade para fichas antigas).
function inferArmorTypeFromName(item) {
  const text = norm(`${item.slot} ${item.name}`);
  if (text.includes("leve")) return "leve";
  if (text.includes("media") || text.includes("medio")) return "media";
  if (text.includes("pesada") || text.includes("pesado")) return "pesada";
  return "";
}

// Resolve o tipo efetivo de armadura de um item equipado.
// Prioridade: armorType explicito; fallback: inferencia por nome.
// Quando armorType esta preenchido, o nome NAO e avaliado (evita dupla contagem).
function resolveArmorType(item) {
  const explicit = ARMOR_TYPE_KEYS.includes(item.armorType) ? item.armorType : "";
  return explicit || inferArmorTypeFromName(item);
}

function armorState(c) {
  const types = (c.equipment || [])
    .filter((e) => e.equipped)
    .map(resolveArmorType);
  return {
    light:  types.includes("leve"),
    medium: types.includes("media"),
    heavy:  types.includes("pesada"),
  };
}

function sumSeries(values) {
  return (values || []).reduce((sum, v) => sum + Number(v || 0), 0);
}

function appliedPoints(c) {
  return ["for","con","agi","int","mag"]
    .reduce((sum, key) => sum + Number(c.attributes?.[key]?.value || 0), 0);
}

function combatFlow(c, calc = excelCalc(c)) {
  const combat = normalizeCombatState(c.combat);
  const hpDamage = sumSeries(combat.hpDamage);
  const hpHeal = sumSeries(combat.hpHeal);
  const ppSpend = sumSeries(combat.ppSpend);
  const ppRecover = sumSeries(combat.ppRecover);
  return {
    combat,
    hpDamage,
    hpHeal,
    ppSpend,
    ppRecover,
    hpRemaining: Number(calc.hpMax || 0) - hpDamage + hpHeal,
    ppRemaining: Number(calc.ppMax || 0) - ppSpend + ppRecover,
  };
}

function updateCombatSeries(c, key, idx, value) {
  if (!canEdit(c)) return;
  const combat = normalizeCombatState(c.combat);
  const series = [...combat[key]];
  series[idx] = Math.max(0, Number(value || 0));
  c.combat = { ...combat, [key]: series };
  scheduleCharSave(c);
}

function renderCombatSeriesInputs(c, title, key, labelPrefix, values) {
  return node("section", "panel content-card", [
    node("h3", "", title),
    node("div", "grid three",
      values.map((v, idx) =>
        field(
          `${labelPrefix} ${idx + 1}`,
          v,
          (next) => updateCombatSeries(c, key, idx, next),
          { type:"number", refresh:true },
        )
      )
    ),
  ]);
}

function renderCombatFlowCard(c, flow) {
  return card("Fluxo de combate", [
    node("div", "grid two", [
      checkField("HATE", c.conditions?.hateBoost, (v) => updateNested(c, ["conditions","hateBoost"], Boolean(v)), { refresh:true }),
      checkField("Inversao", c.conditions?.inversion, (v) => updateNested(c, ["conditions","inversion"], Boolean(v)), { refresh:true }),
    ]),
    node("div", "grid two", [
      renderCombatSeriesInputs(c, "Calcula Dano", "hpDamage", "Dano", flow.combat.hpDamage),
      renderCombatSeriesInputs(c, "Calcula Cura", "hpHeal", "Cura", flow.combat.hpHeal),
      renderCombatSeriesInputs(c, "Calcula PP", "ppSpend", "Gasto", flow.combat.ppSpend),
      renderCombatSeriesInputs(c, "PP Recuperado", "ppRecover", "Rec", flow.combat.ppRecover),
    ]),
    node("div", "derived-grid", [
      metricCard("DANO", flow.hpDamage),
      metricCard("CURA", flow.hpHeal),
      metricCard("HP REST.", flow.hpRemaining),
      metricCard("PP GASTO", flow.ppSpend),
      metricCard("PP REC.", flow.ppRecover),
      metricCard("PP REST.", flow.ppRemaining),
    ]),
  ]);
}

// ─── Tema ──────────────────────────────────────────────────────────────────────

function applyTheme(c = selectedCharacter()) {
  const t = c?.theme || defaultTheme();
  el.body.style.setProperty("--char-c1", t.colors?.[0] || "#ff4fd8");
  el.body.style.setProperty("--char-c2", t.colors?.[1] || "#6ee7ff");
  el.body.style.setProperty("--char-c3", t.colors?.[2] || "#ffe66d");
  el.body.style.setProperty("--char-gradient", gradient(t));
  el.body.style.setProperty("--char-secondary", t.colors?.[1] || "#6ee7ff");
  el.body.style.setProperty("--char-accent",    t.colors?.[0] || "#ff4fd8");
  const fontKey = FONT_KEYS.includes(t.font) ? t.font : "padrao";
  el.body.style.setProperty("--char-font", fontStackFor(fontKey));
}

function gradient(t = defaultTheme()) {
  const c = t.colors || defaultTheme().colors;
  return t.type === "radial"
    ? `radial-gradient(circle at 20% 20%, ${c[0]}, ${c[1]} 48%, ${c[2]})`
    : `linear-gradient(${Number(t.angle||0)}deg, ${c[0]}, ${c[1]}, ${c[2]})`;
}

// ─── Componentes UI ────────────────────────────────────────────────────────────

// field: cria um label+input estável.
// Usa `input` para atualização em tempo real sem render,
// e `change` para persistir ao sair do campo.
function field(lbl, value, onInput, opts = {}) {
  const input = opts.textarea ? document.createElement("textarea") : document.createElement("input");
  input.value = value ?? "";
  if (opts.type)    input.type = opts.type;
  if (opts.disabled || (!opts.system && currentView==="sheet" && !canEdit())) input.disabled = true;

  input.addEventListener("input", () => {
    onInput(input.type==="number" ? Number(input.value||0) : input.value);
    if (opts.refresh && !isTyping()) render();
  });
  input.addEventListener("change", () => {
    if (currentView==="sheet") saveChar(selectedCharacter());
  });
  return node("label", `field${opts.big?" big-field":""}`, [node("span","",lbl), input]);
}

function colorField(lbl, value, onInput) {
  const input = document.createElement("input");
  input.type  = "color";
  input.value = value || "#ffffff";
  if (currentView==="sheet" && !canEdit()) input.disabled = true;
  input.addEventListener("input",  () => { onInput(input.value); render(); });
  input.addEventListener("change", () => saveChar(selectedCharacter()));
  return node("label", "field color-field", [node("span","",lbl), input]);
}

function selectField(lbl, value, options, onInput, cfg = {}) {
  const sel = document.createElement("select");
  options.forEach((o) => {
    const opt = document.createElement("option");
    opt.value = o; opt.textContent = o; opt.selected = o===value;
    sel.append(opt);
  });
  sel.addEventListener("change", () => { onInput(sel.value); if (cfg.refresh) render(); });
  return node("label", "field", [node("span","",lbl), sel]);
}

// enumField: select com chave persistida e label exibido (raca, sub-raca).
function enumField(lbl, valueKey, keys, labels, onInput, cfg = {}) {
  const sel = document.createElement("select");
  const resolved = keys.includes(valueKey) ? valueKey : keys[0];
  const noMech = new Set(cfg.noMechanicalKeys || []);

  keys.forEach((key) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = labels[key] ?? key;
    opt.selected = key === resolved;
    if (noMech.has(key)) opt.title = "Sem bonus mecanico na planilha atual";
    sel.append(opt);
  });

  if (cfg.disabled || (!cfg.system && currentView === "sheet" && !canEdit())) sel.disabled = true;

  sel.addEventListener("change", () => {
    onInput(sel.value);
    if (cfg.refresh && !isTyping()) render();
    if (currentView === "sheet") saveChar(selectedCharacter());
  });

  return node("label", `field${cfg.big ? " big-field" : ""}`, [node("span", "", lbl), sel]);
}

function rangeField(lbl, value, min, max, onInput) {
  const input  = document.createElement("input");
  input.type   = "range"; input.min=min; input.max=max; input.value=value;
  const output = node("b","range-output",`${value}°`);
  input.addEventListener("input", () => { onInput(Number(input.value)); output.textContent=`${input.value}°`; render(); });
  input.addEventListener("change", () => saveChar(selectedCharacter()));
  return node("label", "field", [node("span","",lbl), input, output]);
}

function checkField(lbl, checked, onInput, opts = {}) {
  const input = document.createElement("input");
  input.type  = "checkbox"; input.checked = Boolean(checked);
  if (!opts.system && currentView==="sheet" && !canEdit()) input.disabled = true;
  input.addEventListener("change", () => { onInput(input.checked); saveChar(selectedCharacter()); if (opts.refresh) render(); });
  return node("label", "check-field", [input, node("span","",lbl)]);
}

function btn(lbl, cls, onClick) {
  const b = document.createElement("button");
  b.className   = cls;
  b.textContent = lbl;
  b.addEventListener("click", onClick);
  return b;
}

// Sprint Imagens: popup/lightbox simples para visualizar imagem ampliada.
function openImagePopup(url, alt = "Imagem") {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) return;

  const overlay = node("div", "image-popup-overlay", [], { role:"dialog", "aria-modal":"true", "aria-label":"Visualizacao de imagem" });
  const box = node("div", "image-popup-box");
  const closeBtn = btn("Fechar", "ghost-btn small-btn", () => close());
  closeBtn.setAttribute("type", "button");

  const img = document.createElement("img");
  img.src = safeUrl;
  img.alt = String(alt || "Imagem");
  img.loading = "eager";
  img.addEventListener("error", () => {
    box.replaceChildren(
      node("p", "", "Nao foi possivel carregar a imagem."),
      closeBtn
    );
    closeBtn.focus();
  });

  function close() {
    document.removeEventListener("keydown", onKeyDown);
    overlay.remove();
  }
  function onKeyDown(ev) {
    if (ev.key === "Escape") close();
  }

  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) close(); });
  document.addEventListener("keydown", onKeyDown);

  box.append(img, closeBtn);
  overlay.append(box);
  document.body.append(overlay);
  closeBtn.focus();
}

function openPdfPopup(url, name = "PDF") {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) return;

  const overlay = node("div", "pdf-popup-overlay", [], { role:"dialog", "aria-modal":"true", "aria-label":"Visualizacao de PDF" });
  const box = node("div", "pdf-popup-box");
  const title = node("strong", "pdf-popup-title", String(name || "PDF"));
  const closeBtn = btn("Fechar", "ghost-btn small-btn", () => close());
  closeBtn.setAttribute("type", "button");
  const newTabBtn = btn("Abrir em nova aba", "ghost-btn small-btn", () => openPdfInNewTab(safeUrl));
  newTabBtn.setAttribute("type", "button");

  const frame = document.createElement("iframe");
  frame.src = safeUrl;
  frame.title = String(name || "PDF");
  frame.loading = "eager";
  frame.addEventListener("error", () => {
    box.replaceChildren(
      title,
      node("p", "", "Nao foi possivel carregar o PDF no popup."),
      node("div", "pdf-actions", [newTabBtn, closeBtn])
    );
    closeBtn.focus();
  });

  function close() {
    document.removeEventListener("keydown", onKeyDown);
    overlay.remove();
  }
  function onKeyDown(ev) {
    if (ev.key === "Escape") close();
  }

  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) close(); });
  document.addEventListener("keydown", onKeyDown);

  box.append(title, frame, node("div", "pdf-actions", [newTabBtn, closeBtn]));
  overlay.append(box);
  document.body.append(overlay);
  closeBtn.focus();
}

function openPdfInNewTab(url) {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) return;
  const win = window.open(safeUrl, "_blank", "noopener");
  if (win) win.opener = null;
}

function safeStorageFileName(name) {
  const cleaned = String(name || "documento.pdf")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned || "documento"}.pdf`;
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function sectionTitle(title, subtitle) {
  return node("header", "section-title", [label_(title.toUpperCase()), node("p","",subtitle)]);
}

function card(title, children) {
  return node("section", "panel content-card",
    [title ? node("h3","",title) : null, ...children].filter(Boolean)
  );
}

// ─── Secoes colapsaveis (Sprint UX-1) ──────────────────────────────────────────
function sectionStateKey(c, key) { return `${c?.id || "?"}:${key}`; }
function isSectionCollapsed(c, key) { return Boolean(collapsedSections[sectionStateKey(c, key)]); }
function toggleSection(c, key) {
  const k = sectionStateKey(c, key);
  collapsedSections[k] = !collapsedSections[k];
  render();
}

// Card com cabecalho clicavel que minimiza/expande o corpo. Reusa o estilo de
// content-card; o estado vive em collapsedSections (sessao), reaplicado a cada render.
function collapsibleCard(c, key, title, children, opts = {}) {
  const collapsed = isSectionCollapsed(c, key);
  const countTxt  = (opts.count != null) ? ` (${opts.count})` : "";
  const header = node("button", "card-collapse-header", [
    node("h3", "", `${title}${countTxt}`),
    node("span", "collapse-chevron", collapsed ? "▸" : "▾"),
  ], { type: "button", "aria-expanded": String(!collapsed) });
  header.addEventListener("click", () => toggleSection(c, key));

  const body = collapsed ? null : node("div", "card-collapse-body", children);
  return node("section", "panel content-card collapsible-card", [header, body].filter(Boolean));
}

// ─── Cards colapsaveis por item (Sprint UX-1) ──────────────────────────────────
// Estado por item em expandedItems (sessao). Default recolhido; item novo expandido.
function itemStateKey(c, category, id) { return `${c?.id || "?"}:${category}:${id}`; }
function isItemExpanded(c, category, id) { return expandedItems.has(itemStateKey(c, category, id)); }
function markItemExpanded(c, category, id) { expandedItems.add(itemStateKey(c, category, id)); }
function toggleItem(c, category, id) {
  const k = itemStateKey(c, category, id);
  if (expandedItems.has(k)) expandedItems.delete(k); else expandedItems.add(k);
  render();
}

// Card de item com cabecalho compacto (nome + chevron + remover). O cabecalho usa
// uma div (nao um button) para nao aninhar o botao "remover". Reusa o estilo de
// content-card; recolhido mostra so o cabecalho. Estado vive em expandedItems.
function collapsibleItemCard(c, category, id, titleText, body, removeBtn) {
  const expanded = isItemExpanded(c, category, id);
  const title = String(titleText ?? "").trim() || "(sem nome)";
  const toggle = node("button", "item-collapse-toggle", [
    node("span", "collapse-chevron", expanded ? "▾" : "▸"),
    node("span", "item-card-title", title),
  ], { type: "button", "aria-expanded": String(expanded) });
  toggle.addEventListener("click", () => toggleItem(c, category, id));

  const header = node("div", "card-collapse-header item-collapse-header",
    [toggle, removeBtn].filter(Boolean));
  const bodyNode = expanded
    ? node("div", "card-collapse-body", Array.isArray(body) ? body : [body])
    : null;
  return node("section", "panel content-card collapsible-card list-item-card",
    [header, bodyNode].filter(Boolean));
}

function rowCard(children) {
  return node("article", "row-card", children);
}

function metricCard(lbl, value) {
  return node("article", "metric panel", [label_(lbl), node("strong","",value)]);
}

function hudStat(lbl, value) {
  return node("div", "hud-stat", [label_(lbl), node("b","",value)]);
}

function label_(text) { return node("span","pixel-label",text); }
function p(text)      { return node("p","",text); }
function stack(items) { return node("div","stack",items); }

function node(tag, cls="", children=[], attrs={}) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (typeof children==="string"||typeof children==="number") el.textContent=children;
  else children.filter(Boolean).forEach((ch) => el.append(ch));
  Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v));
  return el;
}

function labelFor(key) {
  return ({
    name:"Nome", cost:"Custo", description:"Descricao", effects:"Efeitos",
    observations:"Observacoes", qty:"Qtd", weight:"Peso (kg)", notes:"Notas",
    slot:"Slot",
  })[key] || key;
}

function esc(v) {
  return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function firebaseErr(e) {
  return ({ "auth/email-already-in-use":"Email ja cadastrado.", "auth/invalid-credential":"Email ou senha invalidos.", "auth/weak-password":"Senha muito fraca." })[e.code] || "Erro no Firebase.";
}

function toast(msg) {
  clearTimeout(toastTimer);
  el.toast.textContent = msg;
  el.toast.classList.add("show");
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 1800);
}

// ─── Canvas de fundo ───────────────────────────────────────────────────────────

function setupCanvas() {
  const canvas = document.querySelector("#sigilCanvas");
  const ctx    = canvas.getContext("2d");
  let stars = [];
  function resize() {
    const r = devicePixelRatio || 1;
    canvas.width  = Math.floor(innerWidth  * r);
    canvas.height = Math.floor(innerHeight * r);
    ctx.setTransform(r, 0, 0, r, 0, 0);
    stars = Array.from({ length: Math.min(70, Math.floor(innerWidth/14)) }, () => ({
      x: Math.random()*innerWidth, y: Math.random()*innerHeight,
      s: Math.random()*1.5+0.5,
      c: ["#ff4fd8","#6ee7ff","#ffe66d","#80ff72"][Math.floor(Math.random()*4)],
    }));
  }
  function draw() {
    ctx.clearRect(0,0,innerWidth,innerHeight);
    stars.forEach((s) => {
      s.y += 0.08;
      if (s.y > innerHeight) s.y = -4;
      ctx.fillStyle = s.c;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s);
    });
    requestAnimationFrame(draw);
  }
  resize(); draw();
  addEventListener("resize", resize);
}

// ─── Event listeners globais ───────────────────────────────────────────────────

document.querySelectorAll(".nav-btn").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
document.querySelector("#newCharacterBtn").addEventListener("click", createCharacter);
document.querySelector("#themeToggle").addEventListener("click",   () => { currentTab="general"; setView("sheet"); });
document.querySelector("#exportJsonBtn").addEventListener("click",  () => {
  const blob = new Blob([JSON.stringify({ campaign:state.campaign, characters:state.characters, diceLog:state.diceLog }, null, 2)], { type:"application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "niartale-export.json";
  a.click();
});
document.querySelector("#logoutBtn").addEventListener("click", () => signOut(auth));
el.searchInput.addEventListener("input", renderSidebar);
el.campaignName.addEventListener("change", () => { if (isMaster()) updateCampaign({ name: el.campaignName.value }); });

setupCanvas();
render();
