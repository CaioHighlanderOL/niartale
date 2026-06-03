# Relatório final — Raça e Sub-raça estruturadas

**Data:** 2026-06-02  
**Projeto:** NiarTale (`niartale-output`)  
**Referências:** `docs/Especificacao_Raca_SubRaca.md`, `docs/Planilha Original.xlsx` (E8, G8), `docs/NiarTale_Relatorio_Remocao_Classe.md`

---

## 1. Resumo executivo

A feature **Raça e Sub-raça como campos estruturados** (Roadmap O3/O4) foi implementada de ponta a ponta no `app.js`, sem alterar as fórmulas auditadas D1–D18: os bônus mecânicos continuam na tabela `SUB_RACE_SR` (antes `SR` inline em `excelCalc`).

| Entrega | Status |
|---------|--------|
| Modelo de dados (`race`, `subRace`, chaves canônicas) | ✅ |
| Migração lazy (`normalizeCharacter`) | ✅ |
| Migração eager (`migrateRaceSubRaceOnce`) | ✅ |
| UI (`enumField` no card da ficha) | ✅ |
| Validação e persistência (`sanitizeCharacterForPersist`) | ✅ |
| `excelCalc` alinhado a `c.subRace` | ✅ (fórmulas preservadas) |
| Documentação atualizada | ✅ |

**Arquivos de código alterados:** `app.js`, `firebase.js` (`getDocs`).

---

## 2. Contexto e motivação

### Antes

- `c.race`: string livre (`"Humano"`, homebrew, etc.) → `norm()` quebrava regras (`"Humana"` ≠ humano).
- Sub-raça: `customFields` com label `"Sub-raca"` → bônus silenciados se o campo fosse renomeado ou apagado.
- `className` já removido (sem impacto em cálculos).

### Depois

- `c.race` e `c.subRace`: enums persistidos como **chaves** (`humano`, `reptil`, …).
- UI com `<select>` e labels da planilha.
- Migração automática de fichas legadas + saneamento em todo `saveChar`.

---

## 3. Modelo de dados

### 3.1 Campos no personagem (`characters/{id}`)

| Campo | Tipo | Valores | Default (ficha nova) |
|-------|------|---------|------------------------|
| `race` | `string` | `humano`, `monstro`, `nenhum` | `humano` |
| `subRace` | `string` | ver `SUB_RACE_KEYS` | `nenhum` |

Labels de exibição: `RACE_LABELS`, `SUB_RACE_LABELS`.

### 3.2 Sub-raças com regra mecânica (`SUB_RACE_SR`)

| Chave | Bônus (resumo) |
|-------|----------------|
| `anfibio` | FOR/AGI +2, RD +6 |
| `alcadethes` | FOR/MAG +6, AGI -3, HP +CON mod |
| `reptil` | FOR +6 (ignora `buffs.for`), CA ±2/-6, esquiva -6, RD +22 |
| `esqueleto` | AGI +5, HP -10 |
| `parasita` | CON -10, AGI +6, HP -10, CA +7, bloqueio -5 |
| `aranha` | AGI +4 |
| `elemental` | HP máx 0, PP base ×2 |

### 3.3 Sub-raças só na UI (sem `SUB_RACE_SR`)

Presentes no select (validação G8 da planilha): `fantasma`, `flor`, `variados`. Bônus mecânico **zero** até regra futura; tooltip na UI.

### 3.4 `customFields`

- Fichas novas: apenas **Almas** (Sub-raca removida do default).
- Legado: entrada `Sub-raca` migrada para `subRace` e removida do array.

### 3.5 `_migration` (opcional no documento)

- `raceFrom`, `subRaceFrom`: texto bruto quando mapeado para `nenhum`.
- `raceSubRaceAt`: timestamp na migração eager com alteração relevante.

### 3.6 Flag de usuário

- `users/{uid}.raceSubRaceMigratedAt`: após `migrateRaceSubRaceOnce` bem-sucedida.

---

## 4. Funções principais (`app.js`)

| Função | Papel |
|--------|--------|
| `resolveRaceKey` / `resolveSubRaceKey` | Normalização + aliases (`humana` → `humano`) |
| `applyRaceSubRaceNormalization` | Merge na carga; prioridade custom Sub-raca **na migração** |
| `ensureCharacterRaceSubRace` | Sincronia em memória; `c.subRace` válido vence custom na **edição** |
| `normalizeCharacter` | Aplica normalização em todo snapshot |
| `sanitizeCharacterForPersist` | Validação + clamp HP/MP antes do Firestore |
| `migrateRaceSubRaceOnce` | Batch eager pós-login |
| `excelCalc` | Usa `c.race` / `c.subRace`; tabela `SUB_RACE_SR` |
| `enumField` | Select raça/sub-raça no card |

---

## 5. Fluxos

### 5.1 Carregamento

```text
onSnapshot(characters)
  → normalizeCharacter(id, data)
       → applyRaceSubRaceNormalization (custom Sub-raca → subRace)
  → render (enumField mostra labels)
```

### 5.2 Edição

```text
enumField change
  → updateChar({ race | subRace: key })
       → resolveRaceKey / resolveSubRaceKey
       → ensureCharacterRaceSubRace + excelCalc + clamp HP/MP
       → scheduleCharSave (700 ms)
```

### 5.3 Persistência

```text
saveChar
  → sanitizeCharacterForPersist
       → applyRaceSubRaceNormalization
       → clampResourcesToDerivedMax
       → toast se aviso (raca desconhecida, HP ajustado)
  → updateDoc(characters/{id})
```

### 5.4 Migração eager

```text
login → migrateRaceSubRaceOnce (se !raceSubRaceMigratedAt)
  → getDocs(characters)
  → normalizeCharacter por doc
  → batch.update (pula locallyDirtyCharacters; merge em memória se dirty)
  → users.raceSubRaceMigratedAt
```

**Recomendação operacional:** primeiro login do **Mestre** após deploy para migrar todas as fichas da campanha.

---

## 6. UI

| Local | Componente |
|-------|------------|
| Card da ficha (`renderCharacterCard`) | `enumField` Raça, `enumField` Sub-raça |
| Visão Mestre (lista) | Labels (`Humano / Réptil / LV 3`) |
| Aba Geral | Sem Sub-raca em campos extras (após normalizar) |

---

## 7. Impacto em fichas existentes

| Cenário | Comportamento |
|---------|----------------|
| `race: "Humano"` | → `humano` |
| `race: "Humana"` | → `humano` (+1 racial onde antes podia faltar) |
| `race: "Elfo"` (homebrew) | → `nenhum` + `_migration.raceFrom`; toast no save |
| Custom `Sub-raca: "Réptil"` | → `subRace: "reptil"`; custom removido |
| `subRace` ausente no Firestore | Preenchido na migração ou no primeiro save |
| HP/MP atual > novo máximo | Clamp no save; toast opcional |

---

## 8. O que não mudou

- Fórmulas D1–D18 (valores numéricos de `SUB_RACE_SR` idênticos ao `SR` anterior).
- `firestore.rules` (schema flexível).
- Remoção de `className` (inalterada).
- Pendências E1–E5, I1–I4 do documento de continuidade (exceto O3/O4).

---

## 9. Testes manuais sugeridos

1. Humano + nenhum — HP/PP humano, `raceBase` +1.  
2. Monstro + nenhum — ramo monstro, bloqueio -3.  
3. Humano + réptil — RD +22, FOR sem `buffs.for`.  
4. Humano + elemental — HP máx 0, PP dobrado.  
5. Ficha legada só com custom Sub-raca — bônus preservados após login.  
6. Mestre: migrar campanha; jogador: só próprias fichas.  
7. Editar raça com HP acima do novo máximo — clamp no save.  
8. Export JSON — inclui `subRace` (chave).

---

## 10. Riscos residuais

| Risco | Mitigação atual |
|-------|------------------|
| Firestore heterogêneo se Mestre não logar | Lazy normalize em todo cliente; eager no Mestre |
| Homebrew → `nenhum` silencioso na mesa | `_migration` + toast no save |
| `locallyDirtyCharacters` vs eager | Merge race/subRace em memória; skip batch no id dirty |
| Fantasma/Flor/Variados sem bônus | Tooltip no select |

---

## 11. Documentação atualizada

| Arquivo | Alteração |
|---------|-----------|
| `docs/NiarTale_Documento_Continuidade.md` | §5.5, §7, §8.2, O3/O4 concluídos |
| `docs/Roadmap.md` | Item 3 concluído; próximo = HATE/Inversão |
| `docs/Especificacao_Raca_SubRaca.md` | Status implementada v1.2 |
| `docs/NiarTale_Relatorio_Raca_SubRaca.md` | Este relatório |

---

## 12. Próximos passos sugeridos

1. **HATE e Inversão na UI** (Roadmap Próximo §1).  
2. **Armadura explícita** (R21/R23/R25).  
3. Regras mecânicas para Fantasma/Flor/Variados se a mesa exigir.  
4. Bateria de casos de teste documentada (Roadmap Em andamento §2).

---

## 13. Correções críticas pós-auditoria (2026-06-03)

Aplicadas somente correções classificadas como **Críticas** na auditoria independente.

### 13.1 Cálculo de HP/PP para raça `nenhum`

- **Problema:** `excelCalc` tratava qualquer raça não-monstro como humano no cálculo base de HP/PP.
- **Correção:** introduzidos `hpBase` e `ppBase` com três ramos explícitos:
  - `humano` → fórmulas humanas;
  - `monstro` → fórmulas de monstro;
  - demais (`nenhum`) → base `0`.
- **Impacto esperado:** alinhamento com a lógica da planilha para E8 diferente de `HUMANO`/`MONSTRO`.

### 13.2 Fallback legado de raça (`ancestry`) na normalização

- **Problema:** o fallback para `ancestry` era neutralizado pelo default `race` já preenchido em `merged`.
- **Correção:** `applyRaceSubRaceNormalization` agora resolve raça a partir de
  `rawData.race ?? rawData.ancestry ?? merged.race`.
- **Impacto esperado:** fichas legadas sem `race` e com `ancestry` passam a mapear corretamente durante carga/migração.

### 13.3 Escopo preservado

- Nenhum item classificado como **Importante** ou **Menor** foi alterado nesta rodada.

---

*Fim do relatório.*
