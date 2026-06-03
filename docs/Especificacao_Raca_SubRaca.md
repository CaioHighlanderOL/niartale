# Especificação técnica — Raça (select), Sub-raça (campo próprio) e migração

**Versão:** 1.2  
**Data:** 2026-06-02  
**Status:** **Implementada** — ver `docs/NiarTale_Relatorio_Raca_SubRaca.md`  
**Escopo:** especificação de referência; implementação em `app.js` concluída.

**Documentos relacionados:**

- `docs/NiarTale_Documento_Continuidade.md`
- `docs/Roadmap.md` (Próximo §3 — Raca e Sub-raca estruturadas)
- `docs/NiarTale_Relatorio_Remocao_Classe.md`
- `docs/Planilha Original.xlsx` (aba `Ficha`, E8, G8)
- Revisão de riscos: incorporada na §13 e nas decisões em §14

---

## 0. Contexto — estado atual pós-remoção de Classe

| Aspecto | Estado atual (`app.js`) |
|--------|-------------------------|
| `className` | Removido de `defaultCharacter`, migração localStorage e UI; legado no Firestore é ignorado e some no próximo `saveChar`. |
| `race` | Campo de topo `c.race`, string livre (padrão `"Humano"`), `field("Raca", ...)` em `renderCharacterCard`. |
| Sub-raça | Não é campo de topo; default em `customFields` com `label: "Sub-raca"`, `value: "Nenhum"`. |
| Cálculos | `excelCalc()` usa `norm(c.race)` e `norm(customFieldVal(c, "Sub-raca"))` → `SR[subRace]`. |
| Fragilidades (O3/O4) | Renomear/apagar custom field quebra bônus; `"Humana"` ≠ `isHuman` (`norm` → `"humana"`). |

**Impacto da remoção de Classe:** nenhum nesta feature. `excelCalc` já não usa `className`.

---

## 1. Objetivos e não-objetivos

### 1.1 Objetivos

1. **Raça como `<select>`** com chaves canônicas alinhadas à planilha (E8).
2. **Sub-raça como campo próprio** `c.subRace`, com UI `<select>` alinhada à planilha (G8).
3. **Migração idempotente** de fichas Firestore (e resquícios de custom field).
4. Manter **`excelCalc` como única fonte de derivados**; tabela `SR` permanece canônica.
5. Preservar: `normalizeCharacter`, debounce 700 ms, `locallyDirtyCharacters`, `renderIfSafe`, `canEdit`, `firestore.rules`.

### 1.2 Não-objetivos

- Regras mecânicas para **Fantasma**, **Flor**, **Variados** (validação G8 sem `IF` nas fórmulas).
- UI de HATE/Inversão, armadura explícita, EXP/XP.
- Alterar `firestore.rules` (schema flexível).
- Renomear MP ↔ PP na UI.

---

## 2. Fonte canônica — planilha vs app

### 2.1 Célula E8 — Raça

| Item | Planilha | App atual |
|------|----------|-----------|
| Validação | `HUMANO`, `MONSTRO`, `Nenhum` | Texto livre |
| Fórmulas | `IF(E8="Humano",1,0)`, `IF(E8="Monstro",1,0)`; HP/PP `HUMANO`/`MONSTRO` | `norm(c.race) === "humano"` / `"monstro"` |
| Base +1 | Humano e Monstro nos mods | `raceBase`, `isHuman`, `isMonster` |

### 2.2 Célula G8 — Sub-raça

| Item | Planilha | App (`SR`) |
|------|----------|------------|
| Validação | Anfíbio, Esqueleto, Elemental, Fantasma, Réptil, Alcadethes, Aranha, Flor, parasita, Variados, Nenhum | Chaves: `anfibio`, `alcadethes`, `reptil`, `esqueleto`, `parasita`, `aranha`, `elemental` |
| Com fórmulas | Anfíbio, Esqueleto, Elemental, Réptil, Alcadethes, Parasita, Aranha | Mesmo conjunto em `SR` |
| Sem fórmulas | Fantasma, Flor, Variados, Nenhum | `{}` — selecionáveis, bônus zero |

---

## 3. Modelo de dados

### 3.1 Constantes (`app.js`)

```js
const RACE_KEYS = ["humano", "monstro", "nenhum"];

const SUB_RACE_KEYS = [
  "nenhum", "anfibio", "esqueleto", "elemental", "fantasma",
  "reptil", "alcadethes", "aranha", "flor", "parasita", "variados",
];

const RACE_LABELS = {
  humano: "Humano", monstro: "Monstro", nenhum: "Nenhum",
};

const SUB_RACE_LABELS = {
  nenhum: "Nenhum", anfibio: "Anfíbio", esqueleto: "Esqueleto",
  elemental: "Elemental", fantasma: "Fantasma", reptil: "Réptil",
  alcadethes: "Alcadethes", aranha: "Aranha", flor: "Flor",
  parasita: "Parasita", variados: "Variados",
};
```

**Regra:** Firestore persiste **chaves**; UI exibe **labels**.

### 3.2 Campo `race` (sem renomear)

| Propriedade | Valor |
|-------------|--------|
| Tipo | `string`, uma de `RACE_KEYS` |
| Default (`defaultCharacter`) | `"humano"` — ver §14.1 (decisão vs planilha `Nenhum`) |
| Obrigatório após `normalizeCharacter` | Sim |

### 3.3 Campo `subRace` (novo)

| Propriedade | Valor |
|-------------|--------|
| Tipo | `string`, uma de `SUB_RACE_KEYS` |
| Default | `"nenhum"` |
| Obrigatório após `normalizeCharacter` | Sim |

### 3.4 `customFields`

- Remover **Sub-raca** do default em fichas novas.
- Manter **Almas** e demais extras.
- Após migração: remover entrada com `norm(label) === "sub-raca"` (ver §14.5 sobre flavor).

### 3.5 Metadados `_migration` (recomendado)

```js
_migration: {
  raceSubRaceAt: Timestamp,
  raceFrom: string | null,
  subRaceFrom: string | null,
}
```

Preencher uma vez quando valor bruto divergir da chave resolvida. Não usado em `excelCalc`.

### 3.6 `firestore.rules`

Sem alteração obrigatória. Validação no cliente + `normalizeCharacter`.

---

## 4. Resolvers

### 4.1 `resolveRaceKey(raw) → string`

1. `k = norm(raw)`.
2. Se `k ∈ RACE_KEYS` → retornar `k`.
3. Aliases:

| Entrada normalizada | Chave |
|---------------------|-------|
| `humano`, `humana`, `human` | `humano` |
| `monstro`, `monster` | `monstro` |
| `nenhum`, `none`, `""` | `nenhum` |

4. Desconhecido → `"nenhum"` e registrar em `_migration.raceFrom` (ver §13 C2).

### 4.2 `resolveSubRaceKey(raw) → string`

1. `k = norm(raw)`.
2. Se `k ∈ SUB_RACE_KEYS` → retornar `k`.
3. Aliases por label da planilha (ex.: `réptil` → `reptil`, `parasita` → `parasita`).
4. Desconhecido → `"nenhum"`; preservar bruto em `_migration.subRaceFrom` se diferente.

### 4.3 `normalizeCharacter(id, data)` — ordem obrigatória

**Decisão fechada (§14.2)** — uma única prioridade para sub-raça:

```text
1. base = defaultCharacter(); merged = { id, ...base, ...data, merges profundos existentes }
2. subRaw =
     customFieldVal(merged, "Sub-raca")   // primeiro: legado G8
     ?? merged.subRace
     ?? "nenhum"
3. merged.subRace = resolveSubRaceKey(subRaw)
4. merged.race = resolveRaceKey(merged.race ?? merged.ancestry)
5. customFields = filter OUT qualquer item com norm(label) === "sub-raca"
6. Se customFields vazio de defaults úteis, garantir Almas (defaultCharacter)
7. return merged
```

**Não** usar regra “se `subRace` já é `nenhum`, reler custom” em passo separado — evita perda quando `data.subRace: "nenhum"` e custom tem `"Réptil"`.

### 4.4 `excelCalc(c)` — alteração mínima

```js
const race = resolveRaceKey(c.race);
const subRace = resolveSubRaceKey(c.subRace ?? "");
const sr = SR[subRace] ?? {};
```

Tabela `SR` inalterada nas chaves com regras auditadas (D1–D18).

---

## 5. UI

### 5.1 Posicionamento

| Campo | Local | Substitui |
|-------|--------|-----------|
| Raça | `renderCharacterCard` | `field("Raca", ...)` |
| Sub-raça | `renderCharacterCard`, abaixo de Raça | entrada em Campos extras |

### 5.2 `enumField` (obrigatório)

**Não** reutilizar `selectField` sem adaptação.

| Requisito | Detalhe |
|-----------|---------|
| Valor | Chave em `<option value>`; label visível |
| `disabled` | `!canEdit(c)` na ficha |
| `onChange` | `updateChar(c, { race \| subRace: key }, { refresh: true })` |
| Persistência | `scheduleCharSave` via `updateChar`; opcional `saveChar` no `change` (paridade `checkField`) |
| Sub-raça sem bônus | Tooltip ou nota para `fantasma`, `flor`, `variados`: “sem bônus mecânico na planilha atual” |

### 5.3 `renderMaster`

Exibir labels: `RACE_LABELS[race]`, opcional `SUB_RACE_LABELS[subRace]`.

---

## 6. Migração

### 6.1 Camadas

| Camada | Obrigatória | Comportamento |
|--------|-------------|---------------|
| **Lazy** | Sim | `normalizeCharacter` em todo `onSnapshot`; corrige memória e cálculos; não grava Firestore sozinha |
| **Eager** | Sim em produção | `migrateRaceSubRaceOnce()` após login; grava Firestore |

### 6.2 `migrateRaceSubRaceOnce()`

**Gatilho:** usuário autenticado; `!profile.raceSubRaceMigratedAt`.

**Alcance:**

| Papel | Documentos |
|-------|------------|
| Mestre | Todos `characters` com `campaignId == "default"` |
| Jogador | `ownerId == uid` |

**Algoritmo por documento:**

```text
1. data = doc.data()
2. normalized = normalizeCharacter(id, data)  // mesma função do snapshot
3. Se race, subRace e customFields já equivalentes ao normalizado → skip
4. patch = { race, subRace, customFields, updatedAt }
5. Se race/subRace mudou vs data → patch._migration = { raceSubRaceAt, raceFrom, subRaceFrom }
6. batch.update (paginar > 500)
7. Só após commit bem-sucedido: users/{uid}.raceSubRaceMigratedAt = serverTimestamp()
```

**Idempotência:** passo 2–3 evita reescrita desnecessária.

### 6.3 Conflito com `locallyDirtyCharacters` (obrigatório)

Se `locallyDirtyCharacters.has(id)`:

- **Não** aplicar `batch.update` remoto que sobrescreva o documento inteiro sem merge, **ou**
- Ao receber snapshot pós-migração, fazer **merge em memória** apenas de `race`, `subRace`, `customFields` (e `_migration`) no objeto dirty, preservando demais edições locais.

Ver §13 C3.

### 6.4 `migrateLegacyLocalDataOnce`

**Deve** passar `customFields` do JSON legado (se existir) para `defaultCharacter({ ... })` antes do primeiro snapshot, ou disparar normalize equivalente. Ver §13 I4.

### 6.5 Critério de migração completa no Firestore

Além da flag no usuário:

- Mestre executa eager uma vez após deploy.
- Opcional: relatório/contagem de docs onde `subRace` ausente ou `customFields` ainda contém `sub-raca`.

---

## 7. Persistência e concorrência

- `saveChar` continua gravando documento completo.
- Export JSON (`#exportJsonBtn`) reflete `state.characters` (memória normalizada) — pode divergir do Firestore até o primeiro save (documentar em UI ou §14).
- Considerar `schemaVersion: 2` no export (opcional, §13 I11).

---

## 8. Impacto em arquivos (implementação futura)

| Arquivo | Mudança |
|---------|---------|
| `app.js` | Constantes, resolvers, `normalizeCharacter`, `defaultCharacter`, `excelCalc`, `enumField`, UI, `migrateRaceSubRaceOnce`, `migrateLegacyLocalDataOnce` |
| `docs/NiarTale_Documento_Continuidade.md` | §7 modelo, E8/G8, O3/O4 concluídos |
| `docs/Roadmap.md` | Item Próximo §3 |
| `firestore.rules` | Nenhuma (opcional comentário) |

---

## 9. Critérios de aceite

### Raça

- [ ] Opções Humano, Monstro, Nenhum; persistência em chaves.
- [ ] Humano/Monstro: mesmos derivados da bateria D1–D18.
- [ ] `"Humano"` / `"Humana"` legados → `humano`.

### Sub-raça

- [ ] `c.subRace` no Firestore; UI no card.
- [ ] `excelCalc` não usa `customFieldVal(..., "Sub-raca")`.
- [ ] Sub-raças com `SR`: bônus idênticos aos casos de teste do Roadmap §2.
- [ ] Fantasma/Flor/Variados: selecionáveis, bônus zero, UI informa.

### Migração

- [ ] Lazy: cálculos corretos sem editar.
- [ ] Eager idempotente; flag só após commit.
- [ ] Mestre migra todas as fichas da campanha.
- [ ] Custom Sub-raca removido após persistência.
- [ ] Prioridade: custom Sub-raca > `data.subRace` (§4.3).

### Regressão

- [ ] Sem `className` reintroduzido.
- [ ] `duplicateCharacter` / `createCharacter` incluem `subRace`.

---

## 10. Plano de testes manuais

1. Humano + nenhum — `raceBase`, HP, PP humano.  
2. Monstro + nenhum — HP monstro, bloqueio −3.  
3. nenhum + réptil — bônus Réptil sem `raceBase`.  
4. Humano + elemental — `hpMax === 0`, PP ×2.  
5. Custom só `"Parasita"` → `subRace: "parasita"`, custom removido após save/eager.  
6. `race: "Humana"` → `humano`, +1 racial.  
7. `race: "Elfo"` → `nenhum`, `_migration.raceFrom` preenchido.  
8. Edição local + eager Mestre — sem revert (C3).  
9. Jogador: selects desabilitados em ficha alheia.

---

## 11. Ordem de implementação sugerida

1. Constantes + `resolveRaceKey` / `resolveSubRaceKey` + testes unitários manuais dos aliases.  
2. `normalizeCharacter` (ordem §4.3) + `excelCalc`.  
3. `enumField` + UI card.  
4. Lazy validado.  
5. `migrateRaceSubRaceOnce` + merge dirty + flag após commit.  
6. `migrateLegacyLocalDataOnce`.  
7. Docs + relatório Mestre (opcional).

---

## 12. Histórico de versões

| Versão | Data | Notas |
|--------|------|-------|
| 1.0 | 2026-06-02 | Especificação inicial |
| 1.1 | 2026-06-02 | Revisão de riscos; decisões §14; prioridade sub-raça; eager obrigatório |
| 1.2 | 2026-06-02 | Implementação concluída; relatório final em `NiarTale_Relatorio_Raca_SubRaca.md` |

---

## 13. Riscos identificados (revisão)

Classificação: **Crítico** | **Importante** | **Menor**

### Crítico

| ID | Risco | Mitigação na spec |
|----|--------|-------------------|
| C1 | Eager só no cliente de quem loga deixa Firestore heterogêneo | Eager do Mestre obrigatório em produção; critério §6.5 |
| C2 | Homebrew (`Elfo`, etc.) → `nenhum` muda mecânica sem aviso | `_migration.raceFrom`; relatório Mestre; §14.3 |
| C3 | `locallyDirtyCharacters` reverte migração eager | Merge em memória §6.3 |
| C4 | Memória normalizada ≠ Firestore até save | Documentar export; incentivar eager |

### Importante

| ID | Risco | Mitigação |
|----|--------|-----------|
| I1 | Prioridade ambígua subRace vs custom | Fechado §4.3 |
| I2 | Default `humano` vs planilha `Nenhum` | Decisão §14.1 |
| I3 | `selectField` inadequado | `enumField` obrigatório §5.2 |
| I4 | Legacy localStorage sem customFields | §6.4 |
| I5 | Remoção custom apaga flavor | §14.5 |
| I6 | Fantasma/Flor/Variados sem bônus | Tooltip §5.2 |
| I7 | `Humana` passa a ganhar +1 | Aceito; alias §4.1 |
| I8 | Flag por user vs reexecução | Idempotência §6.2 |
| I9 | Batch > 500 | Paginação |
| I10 | `excelCalc()` sem argumento | Manter `c` explícito nas views |
| I11 | Export JSON schema | `schemaVersion` opcional §7 |
| I12 | `_migration` aumenta documento | Aceito |

### Menor

| ID | Risco |
|----|--------|
| M1 | Master/sidebar com chave crua se não usar labels |
| M2 | `Nenhum` vs `nenhum` — coberto por resolver |
| M3 | Toast raça desconhecida — opcional |
| M4 | Continuidade desatualizado — atualizar na implementação |
| M5 | `className` legado irrelevante |
| M6 | HP/MP current > novo máximo após mudança de raça — sem clamp (pré-existente) |

---

## 14. Decisões em aberto (resolvidas para implementação)

### 14.1 Default de raça em ficha nova

**Decisão:** manter `"humano"` (comportamento atual do app, ficha jogável out-of-the-box).

**Alternativa rejeitada:** `"nenhum"` (planilha em branco E8) — exigiria UX explicando falta de base racial.

### 14.2 Prioridade de leitura da sub-raça

**Decisão:** `customFieldVal("Sub-raca")` → `data.subRace` → `"nenhum"`.

Garante que legado em custom field nunca perde bônus por `subRace` ausente ou `"nenhum"` explícito errado.

### 14.3 Raça homebrew desconhecida

**Decisão:** mapear para `nenhum` (enum fechado).

**Obrigatório na implementação:** preencher `_migration.raceFrom` e, para Mestre após eager, listar fichas afetadas (console ou toast resumido).

### 14.4 Migração eager

**Decisão:** obrigatória no primeiro login do Mestre pós-deploy; jogador executa eager apenas nas próprias fichas.

**Flag:** `users/{uid}.raceSubRaceMigratedAt` somente após `batch.commit` bem-sucedido.

### 14.5 Remoção do custom field Sub-raca

**Decisão:** remover entrada duplicada após copiar valor para `subRace`.

Se `value` do custom não mapear para nenhuma chave (`"Meio-elfo"`), manter `_migration.subRaceFrom` com texto original; opcionalmente **não** remover o custom até revisão manual — implementação pode escolher:

- **Opção A (padrão):** remover sempre; flavor só em `_migration`.
- **Opção B:** se `resolveSubRaceKey` retornar `nenhum` e raw não vazio, renomear label para `"Sub-raca (legado)"` e manter readonly.

**Recomendação:** Opção B se houver reclamação de mesa; Opção A para simplicidade.

### 14.6 Labels duplicados em customFields

**Decisão:** usar o **primeiro** campo com `norm(label) === "sub-raca"` na migração; ignorar duplicatas.

---

## 15. Checklist pré-implementação

- [ ] Confirmar `docs/Planilha Original.xlsx` no repositório antes de alterar `SR`.
- [ ] Revisar aliases com fichas reais exportadas do Firestore (se disponível).
- [ ] Validar fluxo Mestre + 2 jogadores (eager + dirty).
- [ ] Atualizar `NiarTale_Documento_Continuidade.md` §7 e §8.2 após merge do código.

---

*Fim da especificação.*
