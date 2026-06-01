import {
  addDoc, auth, collection, createUserWithEmailAndPassword, deleteDoc,
  doc, firestore, getDoc, limit, onAuthStateChanged, onSnapshot, orderBy,
  query, serverTimestamp, setDoc, signInWithEmailAndPassword, signOut,
  updateDoc, updateProfile, where, writeBatch,
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
  ["abilities","Habilidades"],["inventory","Inventario"],
  ["notes","Notas"],["history","Historia"],["resources","Recursos"],
];

// ─── Estado global ─────────────────────────────────────────────────────────────

let state = {
  authReady: false, user: null, profile: null,
  campaign: null, characters: [], diceLog: [], authMode: "login",
};

let currentView = "sheet";
let currentTab  = "general";
let selectedCharacterId = null;
let toastTimer;
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
  return { type: "linear", angle: 135, colors: ["#ff4fd8", "#6ee7ff", "#ffe66d"] };
}

function defaultCharacter(overrides = {}) {
  return {
    ownerId:    state.user?.uid || "",
    ownerName:  state.profile?.displayName || "Jogador",
    player:     state.profile?.displayName || "Jogador",
    campaignId: CAMPAIGN_ID,
    name: "Nova ficha", className: "Viajante", race: "Humano",
    campaign: state.campaign?.name || "Campanha Principal",
    group: "Grupo principal",
    flavor: "* A alma pulsa como uma pagina viva.",
    avatarUrl: "", lv: 1, status: "DETERMINADO",
    theme: defaultTheme(),
    attributes: { for:{value:4}, con:{value:6}, agi:{value:7}, int:{value:5}, mag:{value:3} },
    buffs: { for:0, agi:0, int:0, mag:0, con:0, hp:0, pp:0, physicalReduction:0, magicReduction:0 },
    conditions: { inversion: false, hateBoost: false },
    resources: {
      hp:     { label:"HP",   current:20, max:20,  color:"#ff3b5f" },
      mp:     { label:"MP",   current:7,  max:7,   color:"#6ee7ff" },
      energy: { label:"EN",   current:5,  max:5,   color:"#80ff72" },
      cash:   { label:"CASH", current:0,  max:999, color:"#d6ff6e" },
    },
    skills: SKILL_NAMES.map((name) => ({ id:uid("sk"), name, trained:false, master:false, extra:0 })),
    abilities: [{
      id: uid("ab"), name: "Ato de Determinacao", cost: "1 MP",
      effects: "Recupera foco narrativo.", description: "Acao especial da ficha.", observations: "",
    }],
    inventory: [{
      id: uid("it"), name: "Caderno", description: "Anotacoes da sessao.",
      qty: 1, weight: 0, observations: "",
    }],
    equipment: [
      { id:uid("eq"), slot:"Arma",    name:"Faca cega",       equipped:true, notes:"" },
      { id:uid("eq"), slot:"Armadura",name:"Casaco listrado",  equipped:true, notes:"" },
    ],
    customFields: [
      { id:uid("cf"), label:"Sub-raca", value:"Nenhum" },
      { id:uid("cf"), label:"Almas",    value:"Nenhum" },
    ],
    notes: "Notas rapidas.", history: "Background do personagem.",
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function normalizeCharacter(id, data) {
  const base = defaultCharacter();
  return {
    id, ...base, ...data,
    theme:        { ...base.theme,       ...(data.theme       || {}) },
    attributes:   { ...base.attributes,  ...(data.attributes  || {}) },
    buffs:        { ...base.buffs,       ...(data.buffs        || {}) },
    conditions:   { ...base.conditions,  ...(data.conditions  || {}) },
    resources:    { ...base.resources,   ...(data.resources   || {}) },
    skills:       data.skills?.length ? mergeSkills(data.skills) : base.skills,
    // ?? garante que arrays vazios válidos não sejam substituídos pelo default
    abilities:    data.abilities    ?? base.abilities,
    inventory:    data.inventory    ?? base.inventory,
    equipment:    data.equipment    ?? base.equipment,
    customFields: data.customFields ?? base.customFields,
  };
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
          if (locallyDirtyCharacters.has(d.id) && byId.has(d.id)) return byId.get(d.id);
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
      batch.set(doc(collection(firestore, "characters")), {
        ...defaultCharacter({
          ownerId: isMaster() ? c.ownerId || state.user.uid : state.user.uid,
          ownerName: c.ownerName || state.profile.displayName,
          player:    c.player    || state.profile.displayName,
          name:      c.name      || "Ficha importada",
          className: c.className || c.class    || "Viajante",
          race:      c.race      || c.ancestry || "Humano",
          lv: Number(c.lv || 1),
          notes: c.notes || "", history: c.history || "",
        }),
        importedFromLocalStorage: true,
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
    field("Classe",  c.className, (v) => updateChar(c, { className: v })),
    field("Raca",    c.race,      (v) => updateChar(c, { race: v }),      { refresh:true }),
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

  const customFields = c.customFields.map((f, i) => {
    const removeBtn = btn("×", "danger-btn small-btn", () => removeListItem(c, "customFields", f.id));
    if (!canE) removeBtn.setAttribute("data-master-only", "");
    return rowCard([
      field("Campo", f.label, (v) => updateArrayItem(c, "customFields", i, { label: v })),
      field("Valor", f.value, (v) => updateArrayItem(c, "customFields", i, { value: v })),
      removeBtn,
    ]);
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
    card("Campos extras", [...customFields, addFieldBtn]),
  ].filter(Boolean));
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
  ]);
}

// ─── Aba Atributos ─────────────────────────────────────────────────────────────

function renderStats(c) {
  const calc = excelCalc(c);
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
      node("div", "grid three",
        ["for","agi","int","mag","con","hp","pp"].map((k) =>
          field(k.toUpperCase(), c.buffs[k], (v) => updateNested(c, ["buffs",k], Number(v||0)), { type:"number", refresh:true })
        )
      ),
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
    buildStableListEditor(c, "abilities",
      ["name","cost","effects","description","observations"],
      () => addListItem(c, "abilities", { name:"", cost:"", effects:"", description:"", observations:"" })
    ),
  ]);
}

// ─── Aba Inventário ────────────────────────────────────────────────────────────

function renderInventory(c) {
  return stack([
    sectionTitle("Inventario", "Itens carregados pelo personagem."),
    buildStableListEditor(c, "inventory",
      ["name","description","qty","weight","observations"],
      () => addListItem(c, "inventory", { name:"", description:"", qty:1, weight:0, observations:"" })
    ),
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
  const card_ = node("section", "panel content-card list-item-card");
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

  card_.append(grid, removeBtn);
  return card_;
}

// ─── Outras abas ───────────────────────────────────────────────────────────────

function renderNotes(c) {
  return card("Notas", [field("Notas", c.notes, (v) => updateChar(c, { notes: v }), { textarea:true })]);
}

function renderHistory(c) {
  return card("Historia", [field("Background", c.history, (v) => updateChar(c, { history: v }), { textarea:true })]);
}

function renderResources(c) {
  const calc = excelCalc(c);
  return stack([
    sectionTitle("Recursos", "Barras e valores atuais."),
    card("Barras", [resourceBars(c)]),
    calculatedPanel(calc),
    card("Editar atuais", [
      node("div", "grid three",
        Object.entries(c.resources).map(([k, r]) =>
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
          node("span","tag",`${c.player} / ${c.race} / LV ${c.lv}`),
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
  Object.assign(c, patch);
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
  const { id, ...data } = c;
  await updateDoc(doc(firestore, "characters", id), { ...data, updatedAt: serverTimestamp() });
  characterSaveTimers.delete(c.id);
  // Mantém dirty por mais 350ms para absorver o snapshot que vem logo após o save
  setTimeout(() => locallyDirtyCharacters.delete(c.id), 350);
  if (message) toast(message);
}

// ─── CRUD personagens ──────────────────────────────────────────────────────────

async function createCharacter() {
  const ref = await addDoc(collection(firestore, "characters"),
    defaultCharacter({ name: `Personagem ${state.characters.length + 1}` })
  );
  selectedCharacterId = ref.id;
  currentTab = "general";
  toast("Ficha criada");
}

async function duplicateCharacter() {
  const src = selectedCharacter();
  if (!canEdit(src)) { toast("Sem permissao"); return; }
  const { id, createdAt, updatedAt, ...copy } = src;
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
  c.customFields.push({ id:uid("cf"), label:"Novo campo", value:"" });
  await saveChar(c, "Campo adicionado");
  render();
}

async function addListItem(c, key, defaults) {
  if (!canEdit(c)) { toast("Sem permissao"); return; }
  c[key] = [...(c[key]||[]), { id:uid(key), ...defaults }];
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
    ["hp","mp","energy","cash"].map((k) => {
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
  const race    = norm(c.race);
  const subRace = norm(customFieldVal(c, "Sub-raca") || "");
  const isMonster = race === "monstro";
  const isHuman   = race === "humano";
  const raceBase  = (isHuman || isMonster) ? 1 : 0;
  const buf = c.buffs || {};
  const base = (k) => Math.trunc(Number(c.attributes[k]?.value || 0) / 4);
  const boost = (c.conditions?.hateBoost ? 30 : 0) + (c.conditions?.inversion ? 14 : 0);

  const mods = {
    for: base("for") + raceBase + boost + (subRace==="anfibio"?2:0) + (subRace==="reptil"?4:0) + Number(buf.for||0),
    con: base("con") + raceBase + boost - (subRace==="parasita"?10:0) + Number(buf.con||0),
    agi: base("agi") + raceBase + boost + (subRace==="esqueleto"?4:0) + (subRace==="anfibio"?2:0) - (subRace==="alcadethes"?3:0) + (subRace==="parasita"?4:0) + (subRace==="aranha"?6:0) + Number(buf.agi||0),
    int: base("int") + raceBase + Number(buf.int||0),
    mag: base("mag") + raceBase + boost + (subRace==="alcadethes"?6:0) + Number(buf.mag||0),
  };

  const armor = armorState(c);
  const hpMax = Math.trunc(isMonster ? 10+mods.mag/2 : 20+mods.con) - (subRace==="esqueleto"?7:0) - (subRace==="parasita"?8:0) + (subRace==="alcadethes"?mods.con:0) + Number(buf.hp||0);
  const ppMax = Math.trunc(isMonster ? 15+mods.mag   : 7+mods.mag/2) + Number(buf.pp||0);
  const ca    = 10 + mods.agi + (armor.light?2:0) - (armor.heavy?6:0) - (armor.medium?3:0) + (subRace==="reptil"?2:0) + (subRace==="parasita"?6:0);
  const initiative       = mods.agi + skillBonus(c, "Reflexo");
  const dodge            = initiative - (armor.heavy?6:0) - (armor.medium?3:0);
  const block            = mods.con - (isMonster?3:0) - (subRace==="parasita"?5:0);
  const pa               = mods.int + skillBonus(c, "Percepcao");
  const physicalReduction = Math.round((armor.light?5:0)+(armor.medium?10:0)+(armor.heavy?20:0)+Number(buf.physicalReduction||0));
  const magicReduction    = Math.round(Number(buf.magicReduction||0)+(subRace==="reptil"?5:0));

  return { mods, hpMax, ppMax, ca, initiative, dodge, block, pa, physicalReduction, magicReduction };
}

function skillBonus(c, name) {
  const s = c.skills.find((sk) => norm(sk.name) === norm(name));
  return s ? (s.trained?5:0)+(s.master?10:0)+Number(s.extra||0) : 0;
}

function armorState(c) {
  const eq = c.equipment.filter((e) => e.equipped).map((e) => norm(`${e.slot} ${e.name}`));
  return {
    light:  eq.some((e) => e.includes("leve")),
    medium: eq.some((e) => e.includes("media") || e.includes("medio")),
    heavy:  eq.some((e) => e.includes("pesada") || e.includes("pesado")),
  };
}

function customFieldVal(c, label) {
  return c.customFields?.find((f) => norm(f.label) === norm(label))?.value;
}

function norm(v) {
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
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

function sectionTitle(title, subtitle) {
  return node("header", "section-title", [label_(title.toUpperCase()), node("p","",subtitle)]);
}

function card(title, children) {
  return node("section", "panel content-card",
    [title ? node("h3","",title) : null, ...children].filter(Boolean)
  );
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
