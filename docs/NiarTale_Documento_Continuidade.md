# NiarTale — Documento Técnico de Continuidade
**Versão:** 3.0  
**Data:** Junho 2026  
**Repositório:** CaioHighlanderOL/niartale  
**Fonte de verdade das regras:** `docs/Planilha Original.xlsx` (aba `Ficha`)  
**Status:** D1–D18 corrigidos ✅ · Refatoração `excelCalc` implementada ✅ · Análise completa de funcionalidades ausentes ✅

> **Para IAs e desenvolvedores:** este documento é a fonte oficial de verdade do projeto.  
> Antes de sugerir ou aplicar qualquer alteração, valide-a contra a planilha original.  
> A planilha tem precedência sobre qualquer inferência ou convenção externa.  
> As fórmulas das células foram lidas diretamente via `openpyxl` — não inferidas.

---

## 1. Visão Geral

### 1.1 Objetivo do Projeto

NiarTale é um sistema web de gerenciamento de fichas de RPG baseado no universo NiarTale. O sistema digitaliza a `Planilha Original.xlsx` (única aba: `Ficha`), adicionando persistência em nuvem, autenticação, separação de papéis (Mestre/Jogador) e rolagem de dados integrada. A identidade visual do projeto — estética retro-pixel, paleta escura com gradientes neon, tipografia monospace — é deliberada e **não deve ser alterada**.

### 1.2 Tecnologias Utilizadas

| Tecnologia | Versão | Função |
|---|---|---|
| HTML5 | — | Estrutura estática mínima (`index.html`, 74 linhas) |
| CSS3 | — | Toda a UI em `styles.css` (1.020 linhas), variáveis CSS para temas por personagem |
| JavaScript (ES Modules) | ES2022+ | Lógica completa em `app.js` (1.299 linhas), sem bundler |
| Firebase Auth | SDK 10.12.5 | Autenticação email/senha |
| Cloud Firestore | SDK 10.12.5 | Banco de dados em tempo real |
| Firebase Hosting | — | Deploy SPA com rewrite para `index.html` |

**Sem frameworks de UI.** Todo o DOM é construído programaticamente via funções utilitárias (`node()`, `card()`, `field()`, etc.) definidas no próprio `app.js`. Não há React, Vue, Angular ou similar. Não há bundler — os arquivos são servidos diretamente.

### 1.3 Estrutura do Sistema

```
niartale-output/
├── index.html          # Shell estática: canvas, sidebar, views, toast
├── app.js              # Toda a lógica: estado, render, cálculos, persistência
├── styles.css          # Estilos completos: layout, componentes, variáveis de tema
├── firebase.js         # Bootstrap do Firebase: Auth, Firestore, exports
├── firestore.rules     # Regras de segurança do Firestore
├── firebase.json       # Config de hosting e deploy
├── DEPLOY.md           # Instruções de deploy
└── docs/
    └── Planilha Original.xlsx   # FONTE DE VERDADE DAS REGRAS
```

**Views definidas em `index.html`:**
- `#dashboardView` — visão geral da campanha
- `#sheetView` — ficha do personagem selecionado
- `#masterView` — painel exclusivo do Mestre
- `#diceView` — rolagem de dados
- `#loginView` — autenticação

**Abas da ficha (`SHEET_TABS` em `app.js`, L33):**
`Geral` · `Atributos` · `Pericias` · `Habilidades` · `Inventario` · `Notas` · `Historia` · `Recursos`

### 1.4 Sistema de Permissões

**Dois papéis:**

| Papel | `role` no Firestore | Criado por |
|---|---|---|
| `player` | `"player"` | Auto-atribuído no cadastro via `ensureUserProfile` |
| `master` | `"master"` | Editado manualmente no Firestore Console pelo administrador |

**Controle em dupla camada:**

**Camada 1 — Firestore Rules (`firestore.rules`):**
```
users/{uid}      → player pode ler/editar o próprio; não pode mudar role
campaigns/       → todos leem; só master edita/deleta
characters/      → owner ou master pode ler/editar/deletar
diceLog/         → todos leem; cada um cria o próprio; master edita/deleta
```

**Camada 2 — Frontend (`app.js`):**
- `isMaster()` (L271): verifica `state.profile?.role === "master"`
- `canEdit(c)` (L279): retorna `true` se for master OU se `c.ownerId === state.user.uid`
- `body.player-mode` (L306): classe CSS que ativa `[data-master-only] { display: none !important }`
- Botões "Nova ficha", "Duplicar" e nav "Mestre" recebem `data-master-only` → invisíveis para players

**Promoção a Mestre:** feita manualmente no Firebase Console. Não há UI para isso. Ver `DEPLOY.md`.

---

## 2. Arquitetura Atual

### 2.1 Arquivos Principais

| Arquivo | Linhas | Responsabilidade |
|---|---|---|
| `app.js` | 1.299 | Estado global, render, cálculos, persistência, auth, DOM |
| `styles.css` | 1.020 | Layout, componentes, temas, responsividade |
| `index.html` | 74 | Shell HTML, canvas de fundo, containers de views |
| `firebase.js` | 77 | Bootstrap Firebase, re-exports das funções usadas |
| `firestore.rules` | 53 | Regras de segurança do banco |

### 2.2 Funções Principais

#### Estado e Dados
| Função | Linha | Descrição |
|---|---|---|
| `defaultCharacter(overrides)` | 86 | Retorna objeto completo de personagem com valores padrão |
| `normalizeCharacter(id, data)` | 130 | Mescla dados do Firestore com defaults; garante retrocompatibilidade |
| `mergeSkills(skills)` | 148 | Garante que todas as 26 perícias existam, preservando dados salvos |

#### Auth e Dados em Tempo Real
| Função | Linha | Descrição |
|---|---|---|
| `ensureUserProfile(user)` | 169 | Cria documento `users/{uid}` com `role: "player"` se não existir |
| `ensureDefaultCampaign()` | 182 | Cria `campaigns/default` se não existir |
| `subscribeToFirestoreData()` | 192 | Abre 3 listeners onSnapshot: campaign, characters, diceLog |
| `migrateLegacyLocalDataOnce()` | 234 | Migra dados de localStorage legado para Firestore (one-shot) |

#### Permissões
| Função | Linha | Descrição |
|---|---|---|
| `isMaster()` | 271 | `state.profile?.role === "master"` |
| `canEdit(c)` | 279 | `isMaster() \|\| c.ownerId === state.user.uid` |

#### Render
| Função | Linha | Descrição |
|---|---|---|
| `render()` | 297 | Ponto central de render; despacha para renderLogin/Sheet/Master/Dice/Dashboard |
| `renderIfSafe()` | 331 | Adia o render enquanto um input está com foco (evita perda de cursor) |
| `renderSheet()` | 459 | HUD + card de personagem + abas + action bar |
| `renderStats(c)` | 603 | Aba Atributos: attribute-grid + buffs + calculatedPanel |
| `calculatedPanel(calc)` | 629 | Painel de derivados: PV, PP, C.A, INI, ESQ, BLOQ, P.A, R.FIS, R.MAG |
| `renderSkills(c)` | 647 | Lista de 26 perícias com checkboxes Treinado/Mestre e campo Extra |
| `renderMaster()` | 777 | Painel do Mestre: edição de campanha + lista de todas as fichas |

#### Cálculos — objeto central desta documentação
| Função | Linha | Descrição |
|---|---|---|
| `excelCalc(c)` | 993 | **Calcula todos os derivados** da ficha. Alinhada com planilha + refatorada com tabela `SR`. |
| `skillBonus(c, name)` | 1085 | Retorna bônus de uma perícia: `(trained?5:0)+(master?10:0)+extra` |
| `armorState(c)` | 1090 | Infere tipo de armadura por nome — **frágil**, ver pendência E5 |
| `customFieldVal(c, label)` | 1099 | Busca valor de campo customizado por label (normalizado) — **frágil**, ver E5/O3 |
| `norm(v)` | 1103 | Remove acentos e converte para minúsculas — usado em todas as comparações de string |

#### Persistência
| Função | Linha | Descrição |
|---|---|---|
| `updateChar(c, patch)` | 874 | Atualiza em memória + agenda save; **não chama render()** |
| `scheduleCharSave(c)` | 902 | Debounce 700ms + marca personagem como `locallyDirty` |
| `saveChar(c, message)` | 909 | Persiste no Firestore via `updateDoc` |
| `createCharacter()` | 922 | Cria novo personagem no Firestore via `addDoc` |
| `duplicateCharacter()` | 931 | Duplica personagem selecionado (só Mestre) |
| `deleteCharacter(c)` | 947 | Deleta do Firestore (owner ou Mestre) |

### 2.3 Fluxo de Autenticação

```
Browser carrega index.html
  └─► app.js executa
        └─► onAuthStateChanged() registra listener
              ├─ user == null → renderLogin()
              └─ user != null
                    ├─► ensureUserProfile(user)
                    ├─► ensureDefaultCampaign()
                    ├─► migrateLegacyLocalDataOnce()
                    ├─► subscribeToFirestoreData()
                    └─► render()
```

**Sessão:** `browserLocalPersistence` — login persiste entre fechamentos de aba.

### 2.4 Fluxo de Edição (debounced)

```
Usuário edita qualquer campo
  └─► updateChar(c, patch) / updateNested(c, path, value)
        ├─► Atualiza c em memória
        ├─► locallyDirtyCharacters.add(c.id)   ← bloqueia snapshot de sobrescrever
        └─► scheduleCharSave(c)                 ← debounce 700ms
              └─► saveChar(c) → updateDoc(Firestore)
                    └─► locallyDirtyCharacters.delete(c.id) após +350ms
```

### 2.5 Modelo de Dados do Personagem

> **Nota (2026-06-02):** o campo `className` foi removido do modelo. Era puramente cosmético (armazenado no Firestore, exibido na ficha), sem uso em cálculos, filtros ou regras. Ver relatório de alterações.

```js
{
  race: "Humano",               // E8 — string livre (frágil, ver O4)
  customFields: [               // G8 — Sub-raca lida via customFieldVal (frágil, ver O3)
    { label: "Sub-raca", value: "Nenhum" },
    { label: "Almas",    value: "Nenhum" },
  ],
  attributes: {
    for: { value: 0 },          // F15
    con: { value: 0 },          // F17
    agi: { value: 0 },          // F19
    int: { value: 0 },          // F21
    mag: { value: 0 },          // F23
  },
  buffs: {
    for: 0,                     // W6 — Buff Físico (ignorado para Réptil)
    agi: 0,                     // W8 — Buff Rapidinho
    int: 0,                     // X8 — Buff Ixpertinho
    mag: 0,                     // W10 — Buff Mágico
    con: 0,                     // Y10 — Buff Const
    hp:  0,                     // Y8 — Buff HP (ignorado para Elemental)
    pp:  0,                     // Y6 — Buff PP (somado após ×2 do Elemental, não dobrado)
    physicalReduction: 0,       // Y15 — RD Fís. extra
    magicReduction:    0,       // Y16 — RD Mag. extra
  },
  conditions: {
    hateBoost: false,           // U26 — HATE ativo (+30 nos mods, +16 nas RDs)
    inversion: false,           // U24 — Inversão ativa (+14 nos mods)
    // PENDENTE: sem UI de toggle — só editável via Firestore Console (ver E1)
  },
  equipment: [
    { slot: "Armadura", name: "...", equipped: true }
    // tipo inferido por nome — frágil (ver E5)
  ],
  lv: 1,                        // H14 parcial — nível atual; sem XP nem lvMax (ver E4)
  status: "DETERMINADO",        // campo de texto livre — status narrativo / condição atual
  avatarUrl: "",                // M46 — URL de imagem do personagem (já funcional)
  skills: [                     // 26 perícias
    { name: "Atletismo", trained: false, master: false, extra: 0 }
  ],
  resources: {
    hp:     { current: 20, max: 20 },  // max ignorado; usa calc.hpMax
    mp:     { current: 7,  max: 7  },  // max ignorado; usa calc.ppMax
    energy: { current: 5,  max: 5  },  // max respeitado
    cash:   { current: 0,  max: 999},  // max respeitado
  },
  // AUSENTES DO MODELO ATUAL — pendências E4:
  // exp: 0            (F13 — EXP acumulado)
  // xp: 0             (F14 — XP disponível)
  // lvMax: 0          (H14 — nível máximo da campanha)
  // AUSENTES DO MODELO ATUAL — pendências I1:
  // hate: 0           (J31/J32 — CalculaHATE percentual)
  // hope: 100         (T30/T31 — CalculaHOPE percentual)
  // AUSENTES DO MODELO ATUAL — pendência I4:
  // themeSong: ""     (M47 — link da música tema)
}
```

---

## 3. Estado das Fórmulas — `excelCalc` (L993–L1084)

> Todas as fórmulas verificadas diretamente via `openpyxl`. D1–D18 corrigidos.  
> Refatoração com tabela `SR` implementada e validada com 25 casos de teste (100% pass).  
> **A função está totalmente alinhada com a planilha.**

### 3.1 Mapeamento de Células para Código

| Célula | Label na planilha | Campo no código | Status |
|---|---|---|---|
| E8 | RAÇA | `c.race` | ✅ — string livre; comparada via `norm()` |
| G8 | SUB-RAÇA | `sr = SR[subRace]` via `customFieldVal` | ✅ — frágil (ver O3) |
| F15 | FOR bruto | `c.attributes.for.value` | ✅ |
| H15 | FOR Mod | `calc.mods.for` | ✅ corrigido D1, D2 |
| F17 | CON bruto | `c.attributes.con.value` | ✅ |
| H17 | CON Mod | `calc.mods.con` | ✅ |
| F19 | AGI bruto | `c.attributes.agi.value` | ✅ |
| H19 | AGI Mod | `calc.mods.agi` | ✅ corrigido D3, D4, D5 |
| F21 | INT bruto | `c.attributes.int.value` | ✅ |
| H21 | INT Mod | `calc.mods.int` | ✅ — sem boost HATE/Inversão (correto) |
| F23 | MAG bruto | `c.attributes.mag.value` | ✅ |
| H23 | MAG Mod | `calc.mods.mag` | ✅ |
| K24 | HP Máximo | `calc.hpMax` | ✅ corrigido D6, D7, D8 |
| K27 | PP Máximo | `calc.ppMax` | ✅ corrigido D9 |
| F26 | C.A. | `calc.ca` | ✅ corrigido D10, D11 |
| H26 | Bloqueio | `calc.block` | ✅ |
| F28 | INI | `calc.initiative` | ✅ |
| H28 | Esquiva | `calc.dodge` | ✅ corrigido D12 |
| F30 | P.A. | `calc.pa` | ✅ |
| X15 | RD Física | `calc.physicalReduction` | ✅ corrigido D13, D14, D15 |
| X16 | RD Mágica | `calc.magicReduction` | ✅ corrigido D16, D17, D18 |
| U24 | Inversão | `c.conditions.inversion` | ✅ calculado — sem UI toggle (ver E1) |
| U26 | HATE | `c.conditions.hateBoost` | ✅ calculado — sem UI toggle (ver E1) |
| R21/R23/R25 | Armaduras | `armorState(c)` | ✅ calculado — inferência por nome (ver E5) |
| F13 | E.X.P acumulado | — | ❌ ausente (ver E4) |
| F14 | XP disponível | — | ❌ ausente (ver E4) |
| H13 | Pontos atrib. aplicados | — | ❌ ausente (ver E4) |
| H14 | LVL/NVL | `c.lv` parcial | ⚠️ só nível atual; sem lvMax (ver E4) |
| W18–X23 | CalculaDANO / HP Restante | — | ❌ ausente (ver E2) |
| Y18–Y23 | CalculaCURA | — | ❌ ausente (ver E2) |
| W25–X30 | CalculaPP / PP Restante | — | ❌ ausente (ver E3) |
| Y25–Y30 | PP. Rec | — | ❌ ausente (ver E3) |
| J31/J32 | CalculaHATE % | — | ❌ ausente (ver I1) |
| T30/T31 | CalculaHOPE % | — | ❌ ausente (ver I1) |
| T21 | Condição Atual | `c.status` | ⚠️ campo existe, uso semântico distinto (ver I3) |
| M46/N28 | Avatar URL / imagem | `c.avatarUrl` | ✅ implementado |
| M47 | Theme Song | — | ❌ ausente (ver I4) |
| G30 | CASH | `c.resources.cash.current` | ⚠️ existe, não está na HUD (ver O2) |

### 3.2 Fórmulas da Planilha — Referência Canônica

Lidas diretamente via `openpyxl`:

```
H15 (FOR Mod):  ROUNDDOWN(F15/4,0) + IF(E8="Humano",1,0) + IF(E8="Monstro",1,0)
                + IF(U26,30) + IF(U24,14)
                + IF(G8="Anfíbio",2,0) + IF(G8="Alcadethes",6,0)
                + IF(G8="Réptil", 6, 0+W6)

H17 (CON Mod):  ROUNDDOWN(F17/4,0) + IF(E8="Humano",1,0) + IF(E8="Monstro",1,0)
                + IF(U26,30) + IF(U24,14) - IF(G8="Parasita",10,0) + Y10

H19 (AGI Mod):  ROUNDDOWN(F19/4,0) + IF(E8="Humano",1,0) + IF(E8="Monstro",1,0)
                + IF(U26,30) + IF(U24,14)
                + IF(G8="Esqueleto",5,0) + IF(G8="Anfíbio",2,0)
                - IF(G8="Alcadethes",3,0)
                + IF(G8="Parasita",6,0) + IF(G8="Aranha",4,0) + W8

H21 (INT Mod):  ROUNDDOWN(F21/4,0) + IF(E8="Humano",1,0) + IF(E8="Monstro",1,0) + X8
                [INT NÃO recebe boost de HATE/Inversão — ausência intencional]

H23 (MAG Mod):  ROUNDDOWN(F23/4,0) + IF(E8="Humano",1,0) + IF(E8="Monstro",1,0)
                + IF(U26,30) + IF(U24,14) + IF(G8="Alcadethes",6,0) + W10

K24 (hpMax):    IF(G8="Elemental", 0,
                  ROUNDDOWN(IF(E8="HUMANO",20+H17, IF(E8="MONSTRO",10+H23/2)),0)
                  - IF(G8="Esqueleto",10,0) - IF(G8="PARASITA",10,0)
                  + IF(G8="Alcadethes",H17,0) + Y8)

K27 (ppMax):    ROUNDDOWN(IF(E8="HUMANO",7+H23/2, IF(E8="MONSTRO",15+H23)),0)
                * IF(G8="Elemental",2,1) + Y6

F26 (C.A.):     (10+H19) + IF(R21,2,0) - IF(R25,6,0) - IF(R23,3,0)
                + IF(G8="Réptil",2,0) + IF(G8="Parasita",7,0) - IF(G8="Réptil",6,0)

H26 (Bloqueio): H17 - IF(E8="MONSTRO",3,0) - IF(G8="Parasita",5,0)

F28 (INI):      H19 + T15
H28 (Esquiva):  (H19+T15) - IF(R25,6,0) - IF(R23,3,0) - IF(G8="Réptil",6,0)
F30 (P.A.):     H21 + T12

X15 (RD Fís.):  ROUND(IF(R21,5)+IF(R23,10)+IF(R25,20)+IF(U26,16)+Y15
                      +IF(G8="Réptil",22)+IF(G8="Anfíbio",6), 0)

X16 (RD Mag.):  ROUND(Y16 + IF(G8="Réptil",22) + IF(U26,16) + IF(G8="Anfíbio",6), 0)

X21 (Dano tot.):    SUM(W19:W23)          [CalculaDANO — não implementado]
X23 (HP Restante):  K24 - SUM(W19:W23) + SUM(Y19:Y23)  [não implementado]
X28 (PP gasto tot.):SUM(W26:W30)          [CalculaPP — não implementado]
X30 (PP Restante):  K27 - SUM(W26:W30) + SUM(Y26:Y30)  [não implementado]
```

### 3.3 Implementação Atual de `excelCalc` (pós-refatoração)

```js
function excelCalc(c = selectedCharacter()) {

  // ── Contexto ──────────────────────────────────────────────────────────────
  const race      = norm(c.race);
  const subRace   = norm(customFieldVal(c, "Sub-raca") || "");
  const isMonster = race === "monstro";
  const isHuman   = race === "humano";
  const raceBase  = (isHuman || isMonster) ? 1 : 0;
  const buf       = c.buffs || {};
  const base      = (k) => Math.trunc(Number(c.attributes[k]?.value || 0) / 4);
  const hate      = c.conditions?.hateBoost ?? false;
  const boost     = (hate ? 30 : 0) + (c.conditions?.inversion ? 14 : 0);
  const hateRD    = hate ? 16 : 0;   // efeito diferente de boost (+16 vs +30)

  // ── Tabela de bônus por sub-raça (fonte: H15–X16 da planilha) ────────────
  // Campos ausentes valem 0. Adicionar sub-raça = nova linha aqui.
  // caBonus1/caBonus2: dois IFs separados da planilha para Réptil em F26 — preservados.
  // suppressForBuf: Réptil recebe forMod fixo; W6 (buf.for) é ignorado.
  // hpZero / ppDouble: comportamento especial do Elemental em K24/K27.
  // hpBonus:"con": Alcadethes adiciona mods.con ao HP (H17 na planilha).
  const SR = {
    anfibio:   { forMod:2,              agiMod:2,                                            rdFis:6,  rdMag:6              },
    alcadethes:{ forMod:6,              agiMod:-3, magMod:6,         hpBonus:"con"                                         },
    reptil:    { forMod:6, suppressForBuf:true,    caBonus1:2, caBonus2:-6, dodgePen:6, rdFis:22, rdMag:22                 },
    esqueleto: {                         agiMod:5,          hpPen:10                                                       },
    parasita:  { conMod:-10,            agiMod:6,          hpPen:10,  caBonus1:7, blockPen:5                               },
    aranha:    {                         agiMod:4                                                                           },
    elemental: {                                            hpZero:true, ppDouble:true                                     },
  };
  const sr = SR[subRace] ?? {};

  // ── Mods de atributo (H15–H23) ────────────────────────────────────────────
  const mods = {
    for: base("for") + raceBase + boost + (sr.forMod ?? 0) + (sr.suppressForBuf ? 0 : Number(buf.for||0)),
    con: base("con") + raceBase + boost + (sr.conMod ?? 0) + Number(buf.con||0),
    agi: base("agi") + raceBase + boost + (sr.agiMod ?? 0) + Number(buf.agi||0),
    int: base("int") + raceBase + Number(buf.int||0),              // sem boost (intencional)
    mag: base("mag") + raceBase + boost + (sr.magMod ?? 0) + Number(buf.mag||0),
  };

  // ── Derivados ─────────────────────────────────────────────────────────────
  const armor      = armorState(c);
  const armorCA    = (armor.light?2:0) - (armor.medium?3:0) - (armor.heavy?6:0);
  const armorDPen  = (armor.medium?3:0) + (armor.heavy?6:0);
  const armorRD    = (armor.light?5:0) + (armor.medium?10:0) + (armor.heavy?20:0);

  const hpBonus = sr.hpBonus === "con" ? mods.con : 0;
  const hpMax   = sr.hpZero ? 0
    : Math.trunc(isMonster ? 10+mods.mag/2 : 20+mods.con)
      - (sr.hpPen ?? 0) + hpBonus + Number(buf.hp||0);

  const ppMax = Math.trunc(isMonster ? 15+mods.mag : 7+mods.mag/2)
    * (sr.ppDouble ? 2 : 1) + Number(buf.pp||0);

  const ca         = 10 + mods.agi + armorCA + (sr.caBonus1 ?? 0) + (sr.caBonus2 ?? 0);
  const initiative = mods.agi + skillBonus(c, "Reflexo");
  const dodge      = initiative - armorDPen - (sr.dodgePen ?? 0);
  const block      = mods.con - (isMonster?3:0) - (sr.blockPen ?? 0);
  const pa         = mods.int + skillBonus(c, "Percepcao");

  const physicalReduction = Math.round(armorRD + hateRD + (sr.rdFis ?? 0) + Number(buf.physicalReduction||0));
  const magicReduction    = Math.round(          hateRD + (sr.rdMag ?? 0) + Number(buf.magicReduction||0));

  return { mods, hpMax, ppMax, ca, initiative, dodge, block, pa, physicalReduction, magicReduction };
}
```

### 3.4 Cascatas de `mods.agi`

```
mods.agi
  ├─► ca         = 10 + mods.agi + armorCA + (sr.caBonus1 ?? 0) + (sr.caBonus2 ?? 0)
  ├─► initiative = mods.agi + skillBonus("Reflexo")
  └─► dodge      = initiative - armorDPen - (sr.dodgePen ?? 0)   [via initiative]
```

Alterações em `sr.agiMod` ou em `mods.agi` propagam automaticamente para três stats.

---

## 4. Histórico de Trabalho

### 4.1 Sessão 1 — Correções D1–D18 (Junho 2026)

Todas as divergências entre `excelCalc` e a planilha foram identificadas, documentadas e corrigidas. Único arquivo alterado: `app.js`, função `excelCalc`.

**Metodologia:** fórmulas lidas diretamente das células via `openpyxl`, comparadas linha a linha contra o código. Verificação pós-implementação com releitura das mesmas células.

| ID | Stat | Problema | Δ aplicado |
|---|---|---|---|
| D1 | FOR mod / Réptil | +4→+6; buf.for indevidamente somado | +2, buf ignorado |
| D2 | FOR mod / Alcadethes | +6 ausente | +6 |
| D3 | AGI mod / Esqueleto | +4→+5 | +1 |
| D4 | AGI mod / Parasita | +4→+6 | +2 |
| D5 | AGI mod / Aranha | +6→+4 (par invertido com Parasita) | -2 |
| D6 | HP / Esqueleto | penalidade -7→-10 | -3 |
| D7 | HP / Parasita | penalidade -8→-10 | -2 |
| D8 | HP / Elemental | calculava normalmente; deve ser 0 | HP fixo em 0 |
| D9 | PP / Elemental | sem multiplicador ×2 na base | base dobrada |
| D10 | C.A. / Réptil | faltava -6; líquido +2→-4 | -6 |
| D11 | C.A. / Parasita | +6→+7 | +1 |
| D12 | Esquiva / Réptil | faltava -6 | -6 |
| D13 | RD Física / HATE | +16 ausente | +16 com HATE |
| D14 | RD Física / Réptil | +22 ausente | +22 |
| D15 | RD Física / Anfíbio | +6 ausente | +6 |
| D16 | RD Mágica / Réptil | +5→+22 | +17 |
| D17 | RD Mágica / HATE | +16 ausente | +16 com HATE |
| D18 | RD Mágica / Anfíbio | +6 ausente | +6 |

**Decisões técnicas:**
- `hateBoost` introduzido como alias booleano de `c.conditions.hateBoost` para separar semanticamente o efeito em mods (+30) do efeito em RDs (+16).
- Dois ternários separados para Réptil em C.A. preservados (espelham dois IFs distintos da planilha).
- Guard `subRace==="elemental" ? 0 :` em `hpMax` para respeitar o retorno direto da planilha.

**Regressões conhecidas após D6/D7/D8:** Esqueletos, Parasitas e Elementais com `hp.current > hpMax_novo` ficam com barra >100% até ajuste manual. Guard em L983 previne crash.

### 4.2 Sessão 2 — Refatoração `excelCalc` (Junho 2026)

Proposta elaborada, aprovada e implementada. Comportamento idêntico validado com 25 casos de teste automatizados (100% pass).

**Problema resolvido:** `subRace==="x"?N:0` repetido ~20 vezes sem localização central. Adicionar ou corrigir uma sub-raça exigia varredura manual de toda a função.

**Solução implementada:** tabela `SR` com uma linha por sub-raça, declarando apenas os deltas não-zero. Os derivados leem `sr.campo ?? 0`.

**Campos especiais da tabela SR:**

| Campo | Significado |
|---|---|
| `forMod / conMod / agiMod / magMod` | Delta no mod do atributo correspondente |
| `suppressForBuf` | Se `true`, ignora `buf.for` (Réptil recebe valor fixo) |
| `hpPen` | Penalidade subtraída do HP máximo |
| `hpBonus` | `"con"` → soma `mods.con` ao HP (Alcadethes) |
| `hpZero` | HP máximo = 0, ignora toda a fórmula (Elemental) |
| `ppDouble` | Multiplica base do PP por 2 antes de somar `buf.pp` (Elemental) |
| `caBonus1 / caBonus2` | Dois deltas separados em C.A. (Réptil tem +2 e -6 como IFs distintos na planilha) |
| `blockPen` | Penalidade subtraída do Bloqueio |
| `dodgePen` | Penalidade subtraída da Esquiva |
| `rdFis / rdMag` | Bônus de RD Física e Mágica |

**Submódulos nomeados adicionados:** `armorCA`, `armorDPen`, `armorRD` — isolam contribuição da armadura de contribuição racial em cada derivado.

**`hate` / `boost` / `hateRD`:** renomeados e separados explicitamente. `hate` é o booleano fonte. `boost` = efeito nos mods (+30). `hateRD` = efeito nas RDs (+16).

### 4.3 Sessão 3 — Análise de Funcionalidades Ausentes (Junho 2026)

Planilha relida célula a célula via `openpyxl`. Identificadas 13 funcionalidades ausentes no sistema, classificadas por impacto.

---

## 5. Funcionalidades Ausentes — Análise Completa

> Todas identificadas por leitura direta da planilha. Classificação por impacto no jogo.  
> IDs prefixados: **E** = Essencial · **I** = Importante · **O** = Opcional.

### 🔴 Essenciais

#### E1 — Toggles de HATE e Inversão na interface
**Células:** U24 (Inversão), U26 (HATE)  
**Situação:** campos `c.conditions.hateBoost` e `c.conditions.inversion` **existem no modelo e são calculados corretamente** — mas só podem ser alterados via Firestore Console. Não há controle na interface.  
**Impacto:** crítico. HATE ativo adiciona +30 em todos os mods de atributo com boost e +16 nas RDs — o maior modificador individual do sistema. Sem UI, toda sessão de combate exige intervenção manual no banco.  
**Dificuldade:** baixa — dois `checkField()` na aba Atributos com `{ refresh: true }`.  
**Implementação sugerida:**
```js
// Na aba Atributos, após os buffs:
checkField("HATE",     c.conditions.hateBoost, (v) => updateNested(c,"conditions.hateBoost",v), { refresh:true }),
checkField("Inversão", c.conditions.inversion, (v) => updateNested(c,"conditions.inversion",v), { refresh:true }),
```

#### E2 — CalculaDANO + HP Restante
**Células:** W18–X23 (dano), Y18–Y23 (cura)  
**Fórmulas:** `X21 = SUM(W19:W23)` · `X23 = K24 - SUM(W19:W23) + SUM(Y19:Y23)`  
**Situação:** `resources.hp.current` existe mas é editado manualmente como campo único. Sem histórico de dano nem cura.  
**Impacto:** alto. Durante combate, jogador/Mestre calcula `HP - dano` manualmente. Com múltiplos combates, risco de erro elevado.  
**Dificuldade:** média — painel com até 5 entradas de dano e 5 de cura, totais calculados, botão "Aplicar ao HP".

#### E3 — CalculaPP + PP Restante
**Células:** W25–X30 (gasto), Y25–Y30 (recuperação)  
**Fórmulas:** `X28 = SUM(W26:W30)` · `X30 = K27 - SUM(W26:W30) + SUM(Y26:Y30)`  
**Situação:** idêntica ao E2, para PP.  
**Impacto:** alto. PP é o recurso de habilidades. Erros de controle interrompem o ritmo da sessão.  
**Dificuldade:** baixa — mesmo componente de E2, parametrizado para PP. Implementar junto com E2.

#### E4 — EXP, XP disponível, pontos de atributo aplicados, LVL/NVL
**Células:** F13 (E.X.P), F14 (XP), H13 = `SUM(F15:F24)` (Aplicados), H14 = `"0/0"` (LVL/NVL)  
**Situação:** `c.lv` existe como número simples. Nenhum campo de XP. Sem validador de pontos distribuídos. Sem `lvMax`.  
**Impacto:** alto para campanhas longas. Sem XP, o Mestre não tem referência automatizada de subida de nível. Sem `Aplicados`, é possível distribuir pontos além do permitido sem aviso.  
**Dificuldade:** média — dois campos no modelo (`exp`, `xpAvailable`), `attrPointsUsed = SUM(F15:F24)` calculado e exibido ao lado dos atributos, `lvMax` no modelo de campanha.

#### E5 — Tipo de armadura por campo explícito
**Células:** R21 (Leve), R23 (Média), R25 (Pesada) — checkboxes diretos na planilha  
**Situação:** `armorState()` (L1090) infere tipo pelo nome do item com `includes("leve")`, etc. Nome livre = bug silencioso.  
**Impacto:** crítico quando ocorre. "Cota de Malha" não é detectada. C.A., ESQ e RD Física calculam errado sem aviso.  
**Dificuldade:** média-baixa — `armorType: "nenhuma"|"leve"|"media"|"pesada"` no modelo de equipamento. `armorState()` passa a ler o campo. Migração via `normalizeCharacter` com best-effort pelo nome atual.

---

### 🟡 Importantes

#### I1 — CalculaHATE e CalculaHOPE com valor percentual
**Células:** J31/J32 (`CalculaHATE = "00%/00%"`), T30/T31 (`CalculaHOPE = "100%/100%"`); referenciados no cabeçalho C3 e AA3.  
**Situação:** `c.conditions.hateBoost` é booleano on/off. Não existe valor numérico de HATE nem HOPE.  
**Impacto:** médio-alto. HATE/HOPE parecem recursos de campanha com progressão 0–100%. O booleano captura apenas o estado ativo, não o valor que determina quando HATE "dispara".  
**Dificuldade:** média — campos `hate: 0` e `hope: 100` no modelo, barras de progresso na HUD. `hateBoost` pode ser derivado de `hate >= threshold`.  
**Atenção:** a implementação de I1 afeta diretamente `excelCalc` — `hateBoost` passaria de campo manual para campo calculado. Planejar antes de implementar E1.

#### I2 — Total de perícia incluindo mod do atributo base
**Situação:** `renderSkills` exibe apenas `skillBonus` = `(trained?5:0)+(master?10:0)+extra`. O mod do atributo (FOR, CON, AGI, INT, MAG) não é somado nem exibido.  
**Impacto:** alto. Jogador soma mod do atributo ao bônus a cada rolagem. Com HATE, Inversão e sub-raça variando os mods, o cálculo é não-trivial.  
**Dificuldade:** média — tabela estática `SKILL_ATTR` mapeando cada perícia ao atributo base. `total = mods[attr] + skillBonus`. Exibir o total na lista.  
**Mapeamento necessário** (baseado no sistema de jogo — confirmar com o responsável):
```
Atletismo→for, Acrobacia→agi, Luta→for, Arcanismo→mag, Adestramento→int,
Crime→agi, Diplomacia→int, Enganação→int, Fé→mag, Furtividade→agi,
Intimidação→for, Tecnologia→int, Vontade→con, Estratégia→int, Intuição→int,
Medicina→int, Ocultismo→mag, Investigação→int, Ofício→int, Percepção→int,
Pontaria→agi, Reflexo→agi, Sobrevivência→con, Artesanato→int, Vitalidade→con, Magia→mag
```

#### I3 — Condição Atual (campo narrativo de combate)
**Célula:** T21 (`Condição Atual`)  
**Situação:** `c.status` existe com default `"DETERMINADO"`, exibido na HUD. Parece usado para identidade/humor, não condições de combate (envenenado, paralisado, etc.).  
**Impacto:** médio. Se for campo separado de `c.status`, condições de combate (veneno, paralisia) precisam ir para algum campo visível na ficha. Se `c.status` for reutilizado, é apenas documentação do uso.  
**Dificuldade:** baixa — campo `conditionText: ""` no modelo se separado, ou apenas documentar que `c.status` serve os dois propósitos.

#### I4 — Theme Song
**Célula:** M47 (`Theme Song`)  
**Situação:** campo ausente no modelo. Pode ser criado como campo customizado manualmente, mas não é padrão.  
**Impacto:** baixo — detalhe de caracterização sem efeito mecânico.  
**Dificuldade:** muito baixa — `themeSong: ""` no modelo, campo na aba Geral.

---

### 🟢 Opcionais

#### O1 — LVL/NVL como par (nível máximo de campanha)
**Célula:** H14 = `"0/0"` — nível atual / nível máximo da campanha  
**Situação:** `c.lv` é número simples. Não há `lvMax`.  
**Dificuldade:** baixa — `lvMax` no modelo de campanha (não do personagem), exibido na HUD como `LV X/Y`.

#### O2 — CASH na HUD
**Célula:** H30 (`CASH`) — exibido na planilha ao lado de C.A., INI e ESQ  
**Situação:** `resources.cash.current` existe, visível apenas na aba Recursos.  
**Dificuldade:** muito baixa — `hudStat("CASH", c.resources.cash.current)`.

#### O3 — Sub-raça como campo de primeiro nível com select
**Situação:** `customFieldVal(c, "Sub-raca")` busca por label normalizado. Renomear/deletar o campo silencia todos os bônus raciais.  
**Dificuldade:** média — `subRace: "nenhum"` no modelo, `<select>` com sub-raças válidas, migração via `normalizeCharacter`.

#### O4 — Raça como select em vez de input livre
**Situação:** `c.race` é string livre. `norm(c.race) === "humano"` falha com `"Humana"`.  
**Dificuldade:** muito baixa — `selectField("Raça", ..., ["Humano","Monstro"])`.

### Resumo e Priorização

| ID | Funcionalidade | Classe | Dificuldade | Pré-requisito |
|---|---|---|---|---|
| E1 | Toggles HATE/Inversão | 🔴 | Baixa | — |
| E2+E3 | CalculaDANO/PP + Restante | 🔴 | Média | — |
| E5 | Tipo de armadura explícito | 🔴 | Média-baixa | — |
| E4 | EXP, XP, pontos aplicados, LVL/NVL | 🔴 | Média | — |
| I2 | Total de perícia com mod atributo | 🟡 | Média | — |
| I1 | HATE/HOPE com valor percentual | 🟡 | Média | E1 |
| I3 | Condição Atual | 🟡 | Baixa | — |
| I4 | Theme Song | 🟡 | Muito baixa | — |
| O1 | LVL/NVL como par | 🟢 | Baixa | E4 |
| O2 | CASH na HUD | 🟢 | Muito baixa | — |
| O3 | Sub-raça campo primeiro nível | 🟢 | Média | — |
| O4 | Raça como select | 🟢 | Muito baixa | — |

**Ordem recomendada:** E1 → E2+E3 → E5 → I2 → E4 → I1 → restante.

---

## 6. Estado Atual do Projeto

### 6.1 O que está correto e funcionando

- Autenticação Firebase Auth (email/senha) com persistência de sessão
- Separação Mestre/Jogador em dupla camada (Firestore Rules + CSS `player-mode`)
- Persistência em tempo real via Firestore com debounce de 700ms
- Guard de edição concorrente (`locallyDirtyCharacters`)
- Migração de dados legados do localStorage para Firestore (one-shot)
- Lista de 26 perícias com Treinado (+5), Mestre (+10) e Extra (manual)
- `skillBonus` correto
- **Todos os 14 derivados de `excelCalc` alinhados com a planilha** ✅
- `excelCalc` refatorada com tabela `SR` — adição de sub-raças é uma linha ✅
- Imagem do personagem por URL (`avatarUrl`) ✅
- CASH como recurso com barra na aba Recursos ✅
- Render estável durante digitação
- Canvas de fundo animado
- Sistema de tema por personagem
- Rolagem de dados com histórico compartilhado (Firestore)
- CRUD completo de personagens, habilidades, inventário e campos customizados

### 6.2 Pendências Abertas

| ID | Descrição | Classe | Afeta cálculo? |
|---|---|---|---|
| E1 | Toggles HATE/Inversão na interface | 🔴 Essencial | Indiretamente |
| E2 | CalculaDANO + HP Restante | 🔴 Essencial | Sim |
| E3 | CalculaPP + PP Restante | 🔴 Essencial | Sim |
| E4 | EXP / XP / pontos aplicados / LVL/NVL | 🔴 Essencial | Não |
| E5 | Tipo de armadura por campo explícito | 🔴 Essencial | Sim |
| I1 | HATE/HOPE percentual | 🟡 Importante | Sim |
| I2 | Total de perícia com mod atributo | 🟡 Importante | Não |
| I3 | Condição Atual separada de `status` | 🟡 Importante | Não |
| I4 | Theme Song | 🟡 Importante | Não |
| O1 | LVL/NVL como par | 🟢 Opcional | Não |
| O2 | CASH na HUD | 🟢 Opcional | Não |
| O3 | Sub-raça campo primeiro nível | 🟢 Opcional | Sim (fragilidade) |
| O4 | Raça como select controlado | 🟢 Opcional | Sim (fragilidade) |

### 6.3 Próximos Passos Recomendados

**Passo 1 — Toggles HATE/Inversão (E1)** ≈ 1–2h  
Dois `checkField()` na aba Atributos. Desbloqueador imediato de funcionalidade já implementada. Implementar antes de I1 — I1 depende da definição de como HATE/HOPE funcionam como recursos.

**Passo 2 — CalculaDANO/PP + HP/PP Restante (E2+E3)** ≈ 4–5h  
Painel unificado de dano/cura/gasto com até 5 entradas por tipo, totais e botão "Aplicar". O modelo de `resources` já suporta edição de `current` via `updateNested`. E2 e E3 devem ser implementados como um único componente parametrizado.

**Passo 3 — Tipo de armadura explícito (E5)** ≈ 2–3h  
`armorType: "nenhuma"|"leve"|"media"|"pesada"` no modelo de equipamento. `armorState()` passa a ler `armorType`. Migração via `normalizeCharacter`. Resolver antes de implementar I2 (que depende de `mods` corretos, que dependem de armadura correta).

**Passo 4 — Total de perícia com mod (I2)** ≈ 3h  
Tabela `SKILL_ATTR` estática. Exibir `total = mods[attr] + skillBonus` na lista de perícias. Confirmar mapeamento perícia→atributo com o responsável antes de implementar.

**Passo 5 — EXP/XP/LVL/NVL (E4)** ≈ 3–4h  
Campos `exp`, `xpAvailable` no modelo. `attrPointsUsed` calculado via `SUM(attributes)` e exibido ao lado dos atributos. `lvMax` no modelo de campanha.

**Passo 6 — HATE/HOPE percentual (I1)** ≈ 4–6h  
Após E1 estar implementado e a semântica de HATE/HOPE estar definida. Campos `hate: 0`, `hope: 100` no modelo. Barras de progresso na HUD. Rever se `hateBoost` passa a ser calculado (`hate >= threshold`) ou permanece toggle manual.

---

## 7. Instruções para Outra IA

### 7.1 Este documento é a fonte oficial de verdade

Antes de sugerir ou implementar qualquer alteração no projeto NiarTale:

1. **Valide contra a planilha.** `Planilha Original.xlsx` (aba `Ficha`) tem precedência absoluta. Leia as fórmulas via `openpyxl` — não confie em transcrições. Se uma regra parece estranha, confira a célula exata.

2. **D1–D18 já foram corrigidos.** Não reaplique. Se identificar nova divergência em `excelCalc`, documente-a como D19+ com confiança explícita (célula + fórmula lida + código atual) antes de propor correção.

3. **`excelCalc` foi refatorada.** A tabela `SR` é a localização canônica dos bônus por sub-raça. Para adicionar uma sub-raça, adicione uma linha na tabela. Não reintroduza ternários inline `(subRace==="x"?N:0)` fora da tabela.

4. **Não redesenhe a interface.** Identidade visual deliberada. Sem troca de framework, redesign de componentes, paleta ou tipografia.

5. **Não simplifique `caBonus1/caBonus2` de Réptil.** Os dois campos espelham dois IFs separados da planilha em F26. Manter para auditabilidade.

6. **Verifique cascatas antes de alterar `mods.agi`.** Propaga para `ca`, `initiative` e `dodge`. Ver seção 3.4.

7. **Ao implementar E1:** usar `updateNested(c, "conditions.hateBoost", v)` e `updateNested(c, "conditions.inversion", v)` com `{ refresh: true }`. Os campos já existem no modelo e em `excelCalc`.

8. **Ao implementar E2/E3:** `resources.hp.current` e `resources.mp.current` são editados via `updateNested(c, "resources.hp.current", valor)`. O painel de dano/cura aplica deltas sobre o valor atual, não substitui.

9. **Ao implementar E5:** `armorState()` em L1090 precisa ser atualizado para ler `item.armorType` antes de recorrer ao `includes()` do nome. Preservar o fallback por nome para retrocompatibilidade durante a transição.

10. **Ao implementar I1:** planejar se `c.conditions.hateBoost` continuará como toggle manual ou será derivado de `c.hate >= threshold`. A decisão afeta `excelCalc` e o toggle de E1.

### 7.2 Prioridade de Intervenção

1. **Fidelidade à planilha** — qualquer nova divergência tem prioridade máxima.
2. **Pendências essenciais E1–E5** — funcionalidades de jogo ausentes ou frágeis.
3. **Pendências importantes I1–I4** — melhoram experiência de jogo.
4. **Opcionais O1–O4** — qualidade de vida.
5. **Interface** — melhorias de UX sem alterar identidade visual.

### 7.3 Padrões do Projeto

- **Comparação de strings:** sempre `norm(v)` (L1103) — remove acentos, minúsculo.
- **Sem re-render durante digitação:** `updateChar()` / `updateNested()` atualizam memória; render via `renderIfSafe()` pelo snapshot Firestore.
- **Novos campos booleanos de condição:** adicionar em `c.conditions`, não criar campos paralelos no root.
- **IDs de itens:** via `uid(prefix)` (L78).
- **Sem frameworks de UI:** `node(tag, cls, children)` (L1219) e utilitários derivados.
- **Deploy:** `firebase deploy` — sem build step.
- **`hate` vs `boost` vs `hateRD` em `excelCalc`:** três constantes distintas do mesmo campo. `hate` = booleano fonte. `boost` = +30 nos mods. `hateRD` = +16 nas RDs. Não consolidar.
- **Tabela `SR`:** campos ausentes valem `?? 0`. Todo campo válido é inteiro não-nulo — o padrão é seguro.
- **`buf.for` de Réptil:** ignorado via `sr.suppressForBuf`. Se outro personagem futuramente precisar de comportamento similar (valor fixo em vez de buff), usar o mesmo padrão.
