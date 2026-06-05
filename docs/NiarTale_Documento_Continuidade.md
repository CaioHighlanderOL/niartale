# NiarTale - Documento de Continuidade

**Data de leitura:** 2026-06-02  
**Ultima atualizacao:** 2026-06-04 (Sprint UX-1: secoes colapsaveis e revisao de campos extras)  
**Fonte analisada:** `NiarTale.zip` / `NiarTale/niartale-output`  
**Planilha analisada:** `docs/Planilha Original.xlsx`  
**Escopo desta atualizacao:** documentacao alinhada a `app.js` apos Sprint 4 (exposicao de `buffs.physicalReduction` / `buffs.magicReduction` como `RD FIS` / `RD MAG`), mantendo o escopo das Sprints 1, 2 e 3.

> Este documento deve ser usado como ponto de partida por qualquer pessoa ou IA que continue o projeto. A planilha original e a implementacao atual devem ser tratadas como fontes primarias: se houver divergencia, conferir a celula exata da planilha antes de mudar regra de jogo.

---

## 1. Visao Geral

NiarTale e uma aplicacao web para gerenciamento de fichas de RPG. O projeto transforma a planilha `Planilha Original.xlsx`, especialmente a aba `Ficha`, em uma interface web com autenticacao, persistencia em nuvem, separacao entre Mestre e Jogador, edicao de fichas, rolagem de dados, inventario, habilidades e calculos derivados.

A aplicacao atual e propositalmente simples em infraestrutura: HTML, CSS e JavaScript puro, sem framework, sem bundler e sem etapa de build. O deploy e feito como site estatico no Firebase Hosting, usando Firebase Auth e Cloud Firestore diretamente no frontend por ES Modules carregados via CDN.

Identidade visual:

- estetica retro/pixel;
- paleta escura com cores neon por personagem;
- canvas de fundo animado;
- componentes compactos e densos;
- tipografia monospace em elementos de HUD, botoes e titulos.

Arquivos textuais lidos no repositorio:

- `index.html`
- `app.js`
- `styles.css`
- `firebase.js`
- `firestore.rules`
- `firebase.json`
- `.firebaserc`
- `DEPLOY.md`
- `docs/NiarTale_Documento_Continuidade.md`
- `docs/NiarTale_Relatorio_Implementacao_D1-D18.md`
- `docs/NiarTale_Relatorio_Remocao_Classe.md`
- `docs/NiarTale_Relatorio_Raca_SubRaca.md`
- `docs/Especificacao_Raca_SubRaca.md`
- `docs/Planilha Original.xlsx`

---

## 2. Arquitetura

### 2.1 Estrutura do Repositorio

```text
niartale-output/
├── index.html
├── app.js
├── styles.css
├── firebase.js
├── firestore.rules
├── firebase.json
├── .firebaserc
├── DEPLOY.md
└── docs/
    ├── Planilha Original.xlsx
    ├── NiarTale_Documento_Continuidade.md
    ├── NiarTale_Relatorio_Implementacao_D1-D18.md
    ├── NiarTale_Relatorio_Remocao_Classe.md
    ├── NiarTale_Relatorio_Raca_SubRaca.md
    └── Especificacao_Raca_SubRaca.md
```

### 2.2 Responsabilidades por Arquivo

| Arquivo | Responsabilidade |
|---|---|
| `index.html` | Shell estatica da aplicacao: sidebar, topbar, containers das views, canvas e toast. |
| `app.js` | Toda a logica de estado, autenticacao, renderizacao, CRUD, permissoes de UI, calculos da ficha e eventos. |
| `styles.css` | Layout, tema visual, responsividade, componentes, HUD, tabs, listas e regras visuais de permissao. |
| `firebase.js` | Bootstrap Firebase, Auth, Firestore, Storage, persistencia local e reexport das funcoes usadas em `app.js`. |
| `firestore.rules` | Regras de seguranca para `users`, `campaigns`, `characters` e `diceLog`. |
| `storage.rules` | Regras de seguranca para PDFs anexados em Firebase Storage. |
| `firebase.json` | Configuracao de Firestore/Storage rules e Hosting estatico com rewrite SPA. |
| `.firebaserc` | Projeto Firebase padrao: `niartale-rpg-core`. |
| `DEPLOY.md` | Passos operacionais de deploy e promocao manual de Mestre. |
| `docs/Planilha Original.xlsx` | Fonte canonica das regras mecanicas da ficha. |

### 2.3 Modelo de Execucao

Fluxo de inicializacao:

```text
Browser carrega index.html
  └─ app.js como ES module
      └─ firebase.js inicializa Firebase Auth + Firestore
          └─ onAuthStateChanged()
              ├─ sem usuario: renderLogin()
              └─ com usuario:
                  ├─ ensureUserProfile()
                  ├─ ensureDefaultCampaign()
                  ├─ migrateLegacyLocalDataOnce()
                  ├─ subscribeToFirestoreData()
                  └─ render()
```

O app usa estado global em `state`, com campos principais:

- `authReady`
- `user`
- `profile`
- `campaign`
- `characters`
- `diceLog`
- `authMode`

Tambem existem estados globais de UI:

- `currentView`
- `currentTab`
- `selectedCharacterId`
- timers de debounce para campanha e personagens;
- `unsubscribers` dos listeners Firestore;
- `locallyDirtyCharacters`, usado para impedir que snapshots remotos sobrescrevam digitacao local ainda nao confirmada.

### 2.4 Views e Navegacao

Views declaradas em `index.html`:

| View | Uso |
|---|---|
| `dashboardView` | Resumo da campanha, quantidade de fichas, papel do usuario e dados. |
| `sheetView` | Ficha do personagem selecionado. |
| `masterView` | Painel de Mestre; bloqueado visualmente para jogadores. |
| `diceView` | Rolagem de dados e historico compartilhado. |
| `loginView` | Login e cadastro por Firebase Auth. |

Abas de ficha em `SHEET_TABS`:

- `Geral`
- `Atributos`
- `Pericias`
- `Habilidades`
- `Inventario`
- `Equipamentos`
- `Notas`
- `Historia`
- `Recursos`

### 2.5 Renderizacao

O DOM e renderizado por funcoes utilitarias em `app.js`, como:

- `node(tag, cls, children, attrs)`
- `card(title, children)`
- `field(...)`
- `checkField(...)`
- `selectField(...)`
- `btn(...)`
- `sectionTitle(...)`

Nao ha framework reativo. A estrategia e recriar trechos da UI conforme a view/aba ativa. Para evitar perda de foco durante digitacao, `renderIfSafe()` adia renders quando o elemento ativo e `INPUT`, `TEXTAREA` ou `SELECT`.

**Secoes colapsaveis (Sprint UX-1):** `collapsibleCard()` cria cards com cabecalho clicavel para minimizar/expandir. O estado vive em `collapsedSections` (objeto de modulo, chave `${characterId}:${secao}`), **efemero por sessao**: nao persiste no Firestore e nao altera o modelo da ficha. E reaplicado a cada render. Aplicado em Habilidades, Inventario, Equipamentos, Campos extras e Notas. Padrao inicial: expandido.

**Cards colapsaveis por item (Sprint UX-1 — cards individuais):** `collapsibleItemCard()` torna cada item (habilidade, item de inventario, equipamento e campo extra) um card colapsavel com cabecalho compacto (nome + chevron + botao remover). O nome vem de `name` (habilidades/inventario), `slot — name` (equipamentos) ou `label` (campos extras); a renomeacao ocorre no corpo expandido e reflete no cabecalho no proximo render. O estado por item vive em `expandedItems` (Set de modulo, chave `${characterId}:${categoria}:${itemId}`), **efemero por sessao**. Padrao inicial: **recolhido**; item recem-criado inicia **expandido** (via `markItemExpanded`). Colapsar e apenas visual: nao altera dados nem calculos (equipamento recolhido continua contando em `armorState`/`excelCalc`).

### 2.6 Persistencia e Edicao

Campos da ficha sao editados em memoria e salvos com debounce:

```text
input/change
  └─ updateChar() / updateNested() / updateArrayItem()
      ├─ altera objeto em memoria
      ├─ marca characterId em locallyDirtyCharacters
      └─ scheduleCharSave()
          └─ apos 700ms: saveChar()
              └─ updateDoc(characters/{id})
```

Depois do `updateDoc`, o personagem continua marcado como dirty por mais 350ms para absorver snapshots imediatos do Firestore sem destruir a digitacao local.

---

## 3. Permissoes

### 3.1 Papeis

O projeto usa dois papeis:

| Papel | Valor em `users/{uid}.role` | Como surge |
|---|---|---|
| Jogador | `player` | Criado automaticamente em cadastro pelo app. |
| Mestre | `master` | Promovido manualmente no Firestore Console. |

Nao existe UI para promover usuarios a Mestre.

### 3.2 Permissoes no Frontend

Funcoes centrais:

```js
function isMaster() {
  return state.profile?.role === "master";
}

function canEdit(character = selectedCharacter()) {
  return Boolean(character && (isMaster() || character.ownerId === state.user?.uid));
}
```

Estrategias usadas:

- jogadores nao acessam a view `master`; `setView("master")` redireciona para `sheet`;
- `body.player-mode` e aplicado quando o usuario nao e Mestre;
- elementos com `data-master-only` ficam invisiveis via CSS;
- campos de ficha sao desabilitados quando `canEdit()` retorna falso;
- a UI oculta botoes restritos como "Nova ficha", "Duplicar", exportacao JSON e nav de Mestre.

### 3.3 Permissoes no Firestore

As regras de seguranca reforcam o controle no servidor:

| Colecao | Leitura | Criacao | Atualizacao / delete |
|---|---|---|---|
| `users/{uid}` | proprio usuario ou Mestre | proprio usuario, obrigatoriamente `role: "player"` | proprio usuario sem mudar `role`, ou Mestre |
| `campaigns/{campaignId}` | usuario logado | usuario logado somente para `campaignId == "default"` | Mestre |
| `characters/{characterId}` | owner ou Mestre | owner igual ao usuario logado, ou Mestre | owner ou Mestre |
| `diceLog/{rollId}` | usuario logado | usuario logado criando log com `userId == request.auth.uid` | Mestre |

Observacao importante: `campaigns/default` pode ser criado por qualquer usuario logado se nao existir. Depois de criado, apenas Mestre atualiza ou deleta.

### 3.4 Decisao de Seguranca Identificada

O projeto usa defesa em duas camadas:

1. camada visual/ergonomica no frontend, para esconder e desabilitar o que nao deve ser usado por Jogador;
2. camada real em `firestore.rules`, para impedir operacoes indevidas mesmo que alguem manipule a UI.

Essa duplicacao e correta e deve ser mantida. Nao confiar somente no frontend.

---

## 4. Principais Funcionalidades

### 4.1 Autenticacao

- login por email/senha;
- cadastro por email/senha;
- persistencia de sessao via `browserLocalPersistence`;
- perfil criado em `users/{uid}` com `displayName`, `email`, `role`, `createdAt` e `updatedAt`;
- cadastro sempre nasce como `player`.

### 4.2 Campanha

- campanha fixa por `CAMPAIGN_ID = "default"`;
- documento `campaigns/default`;
- criacao automatica caso nao exista;
- Mestre pode editar nome e resumo;
- Jogador visualiza os dados da campanha.

### 4.3 Fichas

- CRUD de personagens no Firestore;
- lista lateral pesquisavel por nome, jogador, grupo e campanha;
- Mestre ve todas as fichas da campanha;
- Jogador ve apenas suas fichas (`ownerId == uid`);
- duplicacao e exclusao com controle por owner/Mestre;
- migracao one-shot de chaves antigas do `localStorage`.

### 4.4 Abas da Ficha

- Geral: dados basicos, tema, avatar, campos customizados e documentos PDF anexados.
- Atributos: atributos brutos, buffs e derivados calculados.
- Pericias: 26 pericias com Treinado, Mestre e Extra.
- Habilidades: lista editavel de habilidades com custo, efeitos, descricao e observacoes.
- Inventario: lista editavel de itens com quantidade, peso, descricao e observacoes.
- Equipamentos: lista editavel de equipamentos com slot, nome, tipo de armadura explicito (Leve/Media/Pesada), toggle equipado e notas.
- Notas: texto livre.
- Historia: texto livre.
- Recursos: HP, MP/PP e CASH. (EN deprecado na UI; legado preservado em dados antigos)

### 4.5 Calculos

Os calculos mecanicos estao centralizados em `excelCalc(c)`. Ela retorna:

- `mods.for`
- `mods.con`
- `mods.agi`
- `mods.int`
- `mods.mag`
- `hpMax`
- `ppMax`
- `ca`
- `initiative`
- `dodge`
- `block`
- `pa`
- `physicalReduction`
- `magicReduction`

Funcoes auxiliares:

- `skillBonus(c, name)`
- `armorState(c)`
- `customFieldVal(c, label)`
- `norm(v)`

### 4.6 Dados

- rolagem de dados por botoes;
- historico em `diceLog`;
- leitura compartilhada por usuarios logados;
- jogadores criam apenas logs proprios;
- Mestre pode atualizar/deletar logs.

### 4.7 Exportacao

Existe botao de exportacao JSON para Mestre. Ele baixa `campaign`, `characters` e `diceLog` do estado atual do frontend.

---

## 5. Decisoes Arquiteturais Identificadas

### 5.1 Sem Framework e Sem Build

O projeto deliberadamente evita React/Vue/Angular/bundlers. Isso reduz complexidade operacional: deploy e apenas publicar arquivos estaticos.

Consequencia: qualquer evolucao deve respeitar o estilo atual de componentes DOM manuais, ou propor uma migracao grande de arquitetura com justificativa explicita.

### 5.2 Firebase Direto no Frontend

`firebase.js` importa SDKs diretamente de:

```text
https://www.gstatic.com/firebasejs/10.12.5/...
```

Isso elimina build step, mas deixa a configuracao do Firebase no cliente. Isso e normal para apps Firebase web: a seguranca depende das rules, nao do segredo da config.

### 5.3 Fonte de Verdade da Regra Mecanica

A planilha original e a fonte canonica. `excelCalc()` e uma transliteracao dos principais calculos da aba `Ficha`. O documento historico registra que divergencias D1-D18 ja foram corrigidas e que a funcao foi refatorada com uma tabela de sub-racas.

### 5.4 Calculos Centralizados

A constante `SUB_RACE_SR` em `app.js` concentra deltas de sub-raca; `excelCalc()` consulta `c.race` e `c.subRace` (chaves canonicas). Essa decisao facilita auditoria:

- adicionar sub-raca com regra mecanica = nova linha em `SUB_RACE_SR` e em `SUB_RACE_KEYS` / `SUB_RACE_LABELS`;
- ajustes de bonus raciais devem ocorrer em `SUB_RACE_SR`;
- regras especiais como Elemental, Reptil e Alcadethes ficam nomeadas por campos explicitos.

### 5.5 Raca e Sub-raca Estruturadas

Implementado em 2026-06-02 (relatorio dedicado). Resumo:

| Campo | Firestore | UI | Calculo |
|---|---|---|---|
| `race` | `humano` \| `monstro` \| `nenhum` | `enumField` no card da ficha | `resolveRaceKey` + `raceBase` / ramos HP-PP |
| `subRace` | chave em `SUB_RACE_KEYS` | `enumField` no card da ficha | `SUB_RACE_SR[subRace]` |

Fluxos principais:

- **Leitura:** `normalizeCharacter()` → `applyRaceSubRaceNormalization()` (custom `Sub-raca` legado tem prioridade na carga).
- **Edicao/save:** `sanitizeCharacterForPersist()` antes de `saveChar`; `updateChar` valida chaves e reclampa HP/MP.
- **Migracao:** `migrateRaceSubRaceOnce()` apos login; flag `users/{uid}.raceSubRaceMigratedAt`.

Sub-racas **Fantasma**, **Flor** e **Variados** existem no select (planilha G8) mas sem entrada em `SUB_RACE_SR` (bonus zero). **Boneco Magico** (chave `"boneco magico"`) segue o mesmo padrao: e uma adicao do sistema (nao existe na planilha) e tem impacto mecanico nulo — `SUB_RACE_KEYS`/`SUB_RACE_LABELS` apenas, sem entrada em `SUB_RACE_SR`.

### 5.6 UI Otimizada Para Digitacao

O projeto evita re-render imediato em campos de input. Isso e importante porque a UI e recriada manualmente. `locallyDirtyCharacters` e `renderIfSafe()` existem para proteger foco, cursor e edicoes locais contra snapshots Firestore.

### 5.7 Permissao Visual Nao Substitui Rules

Elementos de Mestre sao ocultos com `data-master-only` e `body.player-mode`, mas isso e apenas UX. O bloqueio real esta em `firestore.rules`.

### 5.8 Remocao de `className`

O relatorio `NiarTale_Relatorio_Remocao_Classe.md` documenta que `className` era cosmetico, nao afetava calculos, filtros, lista de fichas ou rules. Foi removido da ficha e do modelo. Campos antigos no Firestore podem existir, mas sao ignorados.

### 5.9 Deploy Estatico com Rewrite SPA

`firebase.json` define:

- `hosting.public = "."`;
- headers `Cache-Control: no-cache` para HTML/JS/CSS;
- rewrite de `**` para `/index.html`;
- ignorados: configs, arquivos ocultos, `node_modules`, scripts de inspecao, screenshots e lockfiles.

---

## 6. Integracao com Firebase

### 6.1 Projeto

`.firebaserc` aponta para:

```json
{
  "projects": {
    "default": "niartale-rpg-core"
  }
}
```

`firebase.js` usa:

- `projectId: "niartale-rpg-core"`
- `authDomain: "niartale-rpg-core.firebaseapp.com"`
- `storageBucket: "niartale-rpg-core.firebasestorage.app"`

### 6.2 Auth

Usado para:

- criar usuario;
- logar usuario;
- sair;
- atualizar displayName no cadastro;
- detectar sessao com `onAuthStateChanged`.

Persistencia:

```js
await setPersistence(auth, browserLocalPersistence);
```

### 6.3 Firestore

Colecoes principais:

```text
users/{uid}
campaigns/default
characters/{characterId}
diceLog/{rollId}
```

Listeners em tempo real:

- `campaigns/default`;
- query em `characters`;
- query em `diceLog` ordenada por `createdAt desc`, limitada a 40.

Para personagens:

- Mestre consulta todos da campanha `default`;
- Jogador consulta somente seus proprios personagens.

### 6.4 Persistencia Offline

`firebase.js` chama `enableIndexedDbPersistence(firestore)`. A falha e tratada como best-effort:

- pode falhar em janela privada;
- pode falhar se outra aba ja possui persistencia;
- app continua funcionando online.

### 6.4.1 Storage (PDFs)

`firebase.js` tambem inicializa `getStorage(app)` e reexporta `storageRef`, `uploadBytes`, `getDownloadURL` e `deleteObject` para anexos PDF. Arquivos enviados ficam em:

```text
characters/{characterId}/documents/{docId}-{filename}.pdf
```

Metadados ficam em `characters/{characterId}.documents[]` no Firestore. `storage.rules` limita acesso ao dono da ficha ou Mestre e aceita apenas PDF ate 10 MB.

### 6.5 Deploy

`DEPLOY.md` indica:

1. conferir config em `firebase.js`;
2. habilitar Authentication por Email/Senha;
3. criar Cloud Firestore;
4. habilitar Firebase Storage (necessario para upload de PDFs);
5. rodar `firebase deploy`;
6. promover Mestre manualmente no Firestore Console alterando `users/{uid}.role` para `master`.

---

## 7. Estrutura das Fichas

### 7.1 Personagem Padrao

`defaultCharacter(overrides)` cria o objeto base. Estrutura principal:

```js
{
  ownerId,
  ownerName,
  player,
  campaignId,
  name,
  race,
  subRace,
  campaign,
  group,
  flavor,
  avatarUrl,
  lv,
  status,
  theme,
  attributes,
  buffs,
  conditions,
  resources,
  skills,
  abilities,
  inventory,
  equipment,
  customFields,
  notes,
  history,
  createdAt,
  updatedAt
}
```

### 7.2 Identidade e Dono

| Campo | Uso |
|---|---|
| `ownerId` | UID do jogador dono. |
| `ownerName` | Nome exibido do dono. |
| `player` | Nome do jogador/persona associado. |
| `campaignId` | Atualmente sempre `default`. |
| `name` | Nome da ficha. |
| `race` | Raca: chave `humano`, `monstro` ou `nenhum` (labels em `RACE_LABELS`). |
| `subRace` | Sub-raca: chave em `SUB_RACE_KEYS` (labels em `SUB_RACE_LABELS`). |
| `group` | Agrupamento de campanha. |
| `flavor` | Texto de ambientacao. |
| `avatarUrl` | URL de imagem da ficha. |
| `lv` | Nivel atual simples (parte atual do par LV/NVL). |
| `nvl` | Nivel maximo/alvo (parte final do par LV/NVL). |
| `exp` | Experiencia total/acumulada (manual). |
| `xp` | XP corrente/disponivel (manual). |
| `status` | Status textual exibido na HUD. |

### 7.3 Tema

`theme`:

```js
{
  type: "linear" | "radial",
  angle: number,
  colors: [string, string, string]
}
```

E aplicado em variaveis CSS:

- `--char-c1`
- `--char-c2`
- `--char-c3`
- `--char-gradient`
- `--char-secondary`
- `--char-accent`

### 7.4 Atributos

`attributes`:

```js
{
  for: { value },
  con: { value },
  agi: { value },
  int: { value },
  mag: { value }
}
```

Equivalencias com a planilha:

| Codigo | Planilha | Nome |
|---|---|---|
| `for` | F15/H15 | Forca |
| `con` | F17/H17 | Constituicao |
| `agi` | F19/H19 | Agilidade |
| `int` | F21/H21 | Inteligencia |
| `mag` | F23/H23 | Magia |

### 7.5 Buffs

`buffs`:

```js
{
  for,
  agi,
  int,
  mag,
  con,
  hp,
  pp,
  physicalReduction,
  magicReduction
}
```

Mapeamento principal:

| Campo | Celula / bloco |
|---|---|
| `for` | W6, Buff Fisico |
| `agi` | W8, Buff Rapidinho |
| `int` | X8, Buff Ixpertinho |
| `mag` | W10, Buff Magico |
| `con` | Y10, Buff Const |
| `hp` | Y8, Buff HP |
| `pp` | Y6, Buff PP |
| `physicalReduction` | Y15 |
| `magicReduction` | Y16 |

**Atualizado (Sprint 4):** todos os buffs sao editaveis na aba Atributos (card "Buffs"), incluindo `physicalReduction` e `magicReduction`, expostos com rotulos legiveis `RD FIS` e `RD MAG`. Sao somados em `excelCalc` a `R.FIS`/`R.MAG` (sem alteracao de formula). R.D. Magica permanece independente de armadura.

### 7.6 Condicoes

`conditions`:

```js
{
  inversion: false,
  hateBoost: false
}
```

Esses campos sao considerados em `excelCalc()` **e agora possuem controles diretos na UI** (aba Atributos e card de Fluxo de combate em Recursos) para ligar/desligar HATE e Inversao.

### 7.7 Recursos

`resources`:

```js
{
  hp: { label: "HP", current, max, color },
  mp: { label: "MP", current, max, color },
  cash: { label: "CASH", current, max, color }
}
```

Observacao: para HP e MP/PP, o maximo exibido nas barras vem de `excelCalc()` (`hpMax` e `ppMax`), nao necessariamente de `resources.hp.max` ou `resources.mp.max`.

Atualizacao (2026-06-05): **EN/Energia deprecado na UI** por nao ter equivalente na planilha e nao participar de calculos. A UI de Recursos exibe/edita HP, MP e CASH. Fichas legadas com `resources.energy` continuam compativeis (sem migracao eager); o campo apenas nao e mais exibido/editado.

### 7.7.1 Fluxo de combate (Sprint 1)

Foi adicionado o bloco `combat` no modelo da ficha para aproximar a estrutura da planilha (`W18:X30`) sem quebrar fichas antigas.

```js
combat: {
  hpDamage: [n1, n2, n3, n4, n5], // Calcula Dano
  hpHeal:   [n1, n2, n3, n4, n5], // Calcula Cura
  ppSpend:  [n1, n2, n3, n4, n5], // Calcula PP (gasto)
  ppRecover:[n1, n2, n3, n4, n5]  // PP Recuperado
}
```

Regras de compatibilidade:

- `normalizeCharacter()` injeta o bloco com default quando ausente;
- `sanitizeCharacterForPersist()` normaliza/completa o bloco antes de persistir;
- valores sao normalizados para numero e clampados para `>= 0`.

Derivados calculados no frontend:

- `HP Restante = hpMax - SUM(hpDamage) + SUM(hpHeal)`
- `PP Restante = ppMax - SUM(ppSpend) + SUM(ppRecover)`

Importante: nesta Sprint 1, `HP Restante` e `PP Restante` sao exibidos como metricas derivadas e **nao substituem automaticamente** `resources.hp.current`/`resources.mp.current`.

### 7.8 Pericias

Lista fixa de 26 pericias:

```text
Atletismo, Acrobacia, Luta, Arcanismo, Adestramento, Crime,
Diplomacia, Enganacao, Fe, Furtividade, Intimidacao, Tecnologia,
Vontade, Estrategia, Intuicao, Medicina, Ocultismo, Investigacao,
Oficio, Percepcao, Artesanato, Pontaria, Reflexo, Sobrevivencia,
Vitalidade, Magia
```

Cada pericia:

```js
{
  id,
  name,
  trained,
  master,
  extra
}
```

Formula da planilha para bonus de pericia:

```text
IF(Treinado, 5, 0) + IF(Mestre, 10, 0) + Extra
```

No codigo:

```js
(trained ? 5 : 0) + (master ? 10 : 0) + Number(extra || 0)
```

### 7.8.1 Progressao (Sprint 2)

Campos implementados na ficha:

```js
{
  exp: number, // E13/F13
  xp: number,  // E14/F14
  nvl: number  // G14/H14 (parte final do par LV/NVL)
}
```

Regras aplicadas:

- `exp` e `xp` sao campos manuais (sem formula automatica da planilha).
- `nvl` e manual; `lv` atual existente foi mantido sem alteracao semantica.
- `lv` (**Level**) e `nvl` (**Nivel**) sao informacoes distintas e editaveis de forma independente.
- `Aplicados` e derivado **read-only** com base na planilha:
  - `Aplicados = attributes.for + attributes.con + attributes.agi + attributes.int + attributes.mag`
  - equivalente a `H13 = SUM(F15:F24)` na planilha.

Persistencia e compatibilidade:

- `defaultCharacter()` adiciona `exp:0`, `xp:0`, `nvl:0`.
- `normalizeCharacter()` injeta defaults em fichas antigas (migracao lazy).
- `sanitizeCharacterForPersist()` normaliza/clampa `exp`, `xp` e `nvl` para `>= 0`.
- `Aplicados` nao e persistido; e sempre recalculado no render.

Impacto em calculos:

- `excelCalc()` nao foi alterado.
- Nenhum derivado mecanico (HP/PP/C.A/INI/ESQ/BLOQ/P.A/R.D.) depende de EXP/XP/NVL nesta sprint.
- O visor somente leitura `LV/NVL` foi removido para evitar ambiguidade de UX sobre editabilidade de Nivel.

### 7.9 Habilidades, Inventario e Equipamentos

`abilities`:

```js
{
  id,
  name,
  cost,
  effects,
  description,
  observations
}
```

`inventory`:

```js
{
  id,
  name,
  description,
  qty,
  weight,
  observations
}
```

`equipment`:

```js
{
  id,
  slot,
  name,
  equipped,
  notes,
  armorType // "" | "leve" | "media" | "pesada" (Sprint 3)
}
```

**Atualizado (Sprint 3):** o equipamento agora tem aba propria (`renderEquipment`) e campo explicito `armorType`. `armorState()` resolve o tipo por item com prioridade para `armorType`; quando vazio, faz **fallback** para a inferencia por nome/slot (compatibilidade com fichas antigas). A agregacao continua somavel entre itens equipados, preservando `R21/R23/R25` da planilha. `excelCalc()` **nao foi alterado**: os coeficientes de C.A. (+2/-3/-6), Esquiva (-3/-6) e R.D. Fisica (+5/+10/+20) seguem em `excelCalc` via `armorState`. Normalizacao por `normalizeEquipment()` em `normalizeCharacter()` e `sanitizeCharacterForPersist()`.

### 7.9.1 Documentos PDF anexados

`documents`:

```js
{
  id,
  name,
  url,
  storagePath,
  size,
  uploadedAt
}
```

Atualizado (Sprint PDF): a aba Geral possui um card "Documentos (PDF)" com ate 10 anexos por ficha. O usuario pode adicionar PDF por URL externa ou enviar arquivo local para Firebase Storage. PDFs enviados sao armazenados em `characters/{characterId}/documents/...`; a ficha salva somente metadados e URL de download em `documents[]`. Abertura ocorre em popup com `iframe` e fallback "Abrir em nova aba". Fichas antigas sem `documents` normalizam para `[]` (lazy, sem migracao eager). O recurso nao altera `excelCalc` nem qualquer formula.

### 7.10 Campos Customizados

Default em fichas novas:

```js
[
  { label: "Almas", value: "Nenhum" }
]
```

Sub-raca **nao** e mais campo customizado: usa `c.subRace`. Fichas antigas com `customFields` label `Sub-raca` sao migradas por `normalizeCharacter` / `migrateRaceSubRaceOnce` (valor copiado para `subRace`, entrada removida do array).

Metadados opcionais `_migration.raceFrom` / `_migration.subRaceFrom` registram valores legados nao mapeados.

---

## 8. Regras Importantes da Planilha

### 8.1 Estrutura Geral da Workbook

A workbook possui uma aba:

| Aba | Dimensao lida |
|---|---|
| `Ficha` | 100 linhas x 33 colunas |

Foram identificadas 48 formulas na aba `Ficha`.

Blocos importantes:

- identidade: nome, almas, raca, sub-raca;
- atributos e modificadores;
- pericias em duas colunas;
- buffs;
- reducoes de dano;
- armaduras;
- status e condicao atual;
- HATE e HOPE;
- CalculaDANO, CalculaCURA, CalculaPP e PP recuperado;
- imagem por URL;
- Theme Song.

### 8.2 Campos de Identidade e Progressao

| Celula | Significado | Estado no app |
|---|---|---|
| E8 | Raca | `c.race` (select; chaves canonicas). |
| G8 | Sub-raca | `c.subRace` (select; tabela `SUB_RACE_SR`). |
| F13 | E.X.P | Ausente no modelo atual. |
| F14 | XP | Ausente no modelo atual. |
| H13 | Aplicados: `SUM(F15:F24)` | Ausente como validacao de pontos. |
| H14 | LVL/NVL | Parcial: app tem apenas `c.lv`. |

### 8.3 Modificadores de Atributo

Regras principais:

- Humano e Monstro recebem base racial +1 nos modificadores.
- HATE (`U26`) soma +30 em FOR, CON, AGI e MAG, mas nao em INT.
- Inversao (`U24`) soma +14 em FOR, CON, AGI e MAG, mas nao em INT.
- INT (`H21`) usa apenas bruto/4, base racial e buff de INT.
- Sub-racas adicionam excecoes especificas.

Resumo por celula:

| Celula | Regra |
|---|---|
| H15 | FOR mod = `ROUNDDOWN(F15/4,0)` + base racial + HATE + Inversao + bonus de Anfibio/Alcadethes/Reptil ou buff fisico. |
| H17 | CON mod = `ROUNDDOWN(F17/4,0)` + base racial + HATE + Inversao - Parasita + buff CON. |
| H19 | AGI mod = `ROUNDDOWN(F19/4,0)` + base racial + HATE + Inversao + bonus/penalidades de sub-raca + buff AGI. |
| H21 | INT mod = `ROUNDDOWN(F21/4,0)` + base racial + buff INT. Sem HATE/Inversao. |
| H23 | MAG mod = `ROUNDDOWN(F23/4,0)` + base racial + HATE + Inversao + Alcadethes + buff MAG. |

### 8.4 Sub-racas com Regras Especiais

Tabela consolidada da implementacao atual:

| Sub-raca | Efeitos relevantes |
|---|---|
| Anfibio | FOR +2, AGI +2, RD Fisica +6, RD Magica +6. |
| Alcadethes | FOR +6, AGI -3, MAG +6, HP soma CON mod adicional. |
| Reptil | FOR +6 fixo e ignora `buffs.for`; C.A. tem +2 e -6 separados; Esquiva -6; RD Fisica +22; RD Magica +22. |
| Esqueleto | AGI +5; HP -10. |
| Parasita | CON -10; AGI +6; HP -10; C.A. +7; Bloqueio -5. |
| Aranha | AGI +4. |
| Elemental | HP maximo = 0; PP base multiplicado por 2 antes de somar buff de PP. |

### 8.5 Derivados Principais

| Celula | Derivado | Regra essencial |
|---|---|---|
| K24 | HP maximo | Humano usa `20 + CON mod`; Monstro usa `10 + MAG mod/2`; Elemental retorna 0; Esqueleto/Parasita penalizam; Alcadethes soma CON; soma buff HP. |
| K27 | PP maximo | Humano usa `7 + MAG mod/2`; Monstro usa `15 + MAG mod`; Elemental dobra a base; soma buff PP depois. |
| F26 | C.A. | `10 + AGI mod` + armadura + bonus/penalidades de Reptil/Parasita. |
| H26 | Bloqueio | `CON mod` -3 se Monstro -5 se Parasita. |
| F28 | Iniciativa | `AGI mod + bonus de Reflexo`. |
| H28 | Esquiva | Iniciativa - penalidades de armadura media/pesada - penalidade de Reptil. |
| F30 | P.A. | `INT mod + bonus de Percepcao`. |
| X15 | RD Fisica | armadura + HATE + buff extra + Reptil + Anfibio. |
| X16 | RD Magica | buff extra + Reptil + HATE + Anfibio. |

### 8.6 Armaduras

Na planilha:

| Celula | Significado |
|---|---|
| R21 | Armadura Leve |
| R23 | Armadura Media |
| R25 | Armadura Pesada |

Efeitos:

- Leve: C.A. +2, RD Fisica +5.
- Media: C.A. -3, Esquiva -3, RD Fisica +10.
- Pesada: C.A. -6, Esquiva -6, RD Fisica +20.

**Atualizado (Sprint 3):** o tipo de armadura agora e **explicito** (`armorType` por equipamento, controlado na aba Equipamentos). A inferencia por nome permanece apenas como fallback para fichas antigas sem `armorType`. Coeficientes inalterados.

### 8.7 HATE, Inversao e HOPE

| Celula | Uso |
|---|---|
| U24 | Inversao booleano. |
| U26 | HATE booleano usado nos calculos. |
| J31/J32 | CalculaHATE textual/percentual. |
| T30/T31 | CalculaHOPE textual/percentual. |
| C3 | Referencia `J32`. |
| AA3 | Referencia `T31`. |

No app:

- `conditions.hateBoost` existe e afeta calculos;
- `conditions.inversion` existe e afeta calculos;
- UI direta para alternar esses booleanos foi adicionada na Sprint 1;
- valores percentuais completos de HATE/HOPE nao existem no modelo.

### 8.8 Dano, Cura e PP

Status apos Sprint 1:

| Bloco | Celulas | Formula importante |
|---|---|---|
| CalculaDANO | W18:X23 | **Implementado na UI** como 5 entradas (`combat.hpDamage`) e total exibido. |
| HP Restante | X23 | **Implementado na UI** por derivacao `hpMax - dano + cura`. |
| CalculaCURA | Y18:Y23 | **Implementado na UI** como 5 entradas (`combat.hpHeal`) e total exibido. |
| CalculaPP | W25:X30 | **Implementado na UI** como 5 entradas (`combat.ppSpend`) e total exibido. |
| PP Restante | X30 | **Implementado na UI** por derivacao `ppMax - gasto + recuperacao`. |
| PP Recuperado | Y25:Y30 | **Implementado na UI** como 5 entradas (`combat.ppRecover`) e total exibido. |

Observacao: os blocos foram adicionados na aba Recursos em um card unico "Fluxo de combate", reutilizando os calculos existentes de `excelCalc` (`hpMax` e `ppMax`).

### 8.9 Imagem e Musica

| Celula | Uso | Estado no app |
|---|---|---|
| M46 | URL da imagem | Implementado via `avatarUrl`. |
| N28 | `IMAGE(M46,2)` | Equivalente visual pelo `img`/sprite frame no app. |
| M47 | Theme Song | Ausente como campo padrao. |

---

## 9. Pendencias e Riscos Funcionais

### Essenciais

| ID | Pendencia | Motivo |
|---|---|---|
| E1 | ~~UI para HATE e Inversao~~ | **Concluido (Sprint 1)**. |
| E2 | ~~CalculaDANO + HP restante~~ | **Concluido (Sprint 1)**. |
| E3 | ~~CalculaPP + PP restante~~ | **Concluido (Sprint 1)**. |
| E4 | ~~EXP, XP, pontos aplicados e LVL/NVL~~ | **Concluido (Sprint 2)**. |
| E5 | ~~Tipo de armadura explicito~~ | **Concluido (Sprint 3)**: campo `armorType` + aba Equipamentos; inferencia por nome vira fallback. |

### Importantes

| ID | Pendencia | Motivo |
|---|---|---|
| I1 | HATE/HOPE percentuais | Planilha sugere recursos percentuais, app tem apenas booleano de HATE. |
| I2 | Total de pericia com atributo base | App mostra bonus de treino/extra, mas nao soma mod de atributo na lista. |
| I3 | Condicao Atual separada ou documentada | `status` existe, mas a semantica pode nao cobrir condicoes de combate. |
| I4 | Theme Song | Campo existe na planilha e nao no modelo padrao. |

### Opcionais

| ID | Pendencia | Motivo |
|---|---|---|
| O1 | ~~LVL/NVL como par atual/maximo~~ | **Concluido (Sprint 2)** com `lv/nvl`. |
| O2 | CASH na HUD | Recurso existe, mas aparece principalmente em Recursos. |
| O3 | ~~Sub-raca como campo proprio/select~~ | **Concluido** (2026-06-02). |
| O4 | ~~Raca como select~~ | **Concluido** (2026-06-02). |

---

## 10. Instrucoes Para Continuidade

1. Antes de alterar calculos, leia a celula correspondente em `docs/Planilha Original.xlsx`.
2. Nao reintroduza condicionais de sub-raca espalhadas fora de `SUB_RACE_SR` sem motivo forte.
3. Preserve a distincao entre `boost` de HATE nos atributos (+30) e `hateRD` nas reducoes de dano (+16).
4. Nao trate INT como afetado por HATE/Inversao sem confirmar nova regra; a planilha atual nao aplica esses boosts em H21.
5. Mantenha `caBonus1` e `caBonus2` de Reptil separados, porque refletem dois `IF`s distintos da planilha em F26.
6. Ao mexer em AGI, audite C.A., Iniciativa e Esquiva, pois todas dependem de `mods.agi`.
7. Ao mexer em Firestore, atualize tambem `firestore.rules` e valide o fluxo Jogador/Mestre.
8. Ao criar campos novos na ficha, atualize `defaultCharacter()`, `normalizeCharacter()`, `sanitizeCharacterForPersist()` e a documentacao.
9. Ao alterar raca/sub-raca, teste migracao lazy, eager do Mestre e save com `sanitizeCharacterForPersist`.
10. Ao criar controles que afetam calculo, chame renderizacao de forma cuidadosa para nao quebrar digitacao.
11. Nao fazer redesign visual amplo sem decisao explicita: a estetica retro-pixel e parte da identidade do projeto.

---

## 11. Checklist de Leitura Realizada

- [x] Repositorio listado a partir de `NiarTale.zip`.
- [x] Arquivos HTML/CSS/JS/Firebase lidos.
- [x] Regras Firestore lidas.
- [x] Configuracao de deploy lida.
- [x] Documentos historicos em `docs/` lidos.
- [x] `docs/Planilha Original.xlsx` aberta e inspecionada.
- [x] Aba `Ficha`, dimensoes, formulas e celulas-chave conferidas.
- [x] Documento de continuidade atualizado (raca/sub-raca 2026-06-02).
- [x] Relatorio final `NiarTale_Relatorio_Raca_SubRaca.md`.
