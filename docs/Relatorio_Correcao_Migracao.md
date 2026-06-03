# Relatório de Correção — Migração Raça/Sub-raça

**Data:** 2026-06-03  
**Escopo:** correções dos itens classificados como **Crítico** e **Importante** na auditoria externa mais recente, sem alterações de UI/identidade visual e sem criação de novas funcionalidades.

---

## Arquivos alterados

- `app.js`
- `docs/Relatorio_Correcao_Migracao.md` (este arquivo)

---

## Correções realizadas

### 1) Migração por escopo de papel (Crítico)

**Problema:** flag única por usuário podia bloquear migração de escopo Mestre.

**Correção aplicada:**

- introduzido controle de escopo para Mestre em `migrateRaceSubRaceOnce()` com `raceSubRaceMasterVersion`;
- early-return agora respeita:
  - jogador: continua usando `raceSubRaceMigratedAt`;
  - Mestre: só pula se já tiver a versão de escopo de Mestre.

**Resultado:** evita lacuna quando usuário é promovido a Mestre e preserva idempotência.

### 2) Commit intermediário de batch sem tratamento (Crítico)

**Problema:** falha em `batch.commit()` de paginação podia escapar sem tratamento específico da migração.

**Correção aplicada:**

- loop de migração e commits intermediários/final permanecem dentro do mesmo `try/catch`.

**Resultado:** erro de commit não interrompe o fluxo de tratamento da migração.

### 3) Sobrescrita de edição local em snapshot dirty (Importante)

**Problema:** durante `locallyDirtyCharacters`, merge remoto sobrescrevia `customFields` locais.

**Correção aplicada:**

- `mergeRaceSubRaceIntoCharacter` passou a aceitar opção `overwriteCustomFields`;
- no caminho dirty de `onSnapshot`, merge de race/subRace mantém `customFields` locais (`overwriteCustomFields: false`).

**Resultado:** reduz risco de perda de edição local durante digitação.

### 4) Normalização sem `trim()` (Importante)

**Problema:** entradas com espaços (`"Humano "`, `" Réptil"`) podiam cair em `nenhum`.

**Correção aplicada:**

- `norm()` agora aplica `trim()` antes da normalização.

**Resultado:** melhora robustez com dados legados/sujos sem alterar contrato de chaves.

### 5) Fallback `race` vazio vs `ancestry` (Importante)

**Problema:** `rawData.race ?? rawData.ancestry` tratava `""` como valor presente e ignorava `ancestry`.

**Correção aplicada:**

- `applyRaceSubRaceNormalization` agora escolhe a primeira entrada não-vazia entre `rawData.race`, `rawData.ancestry` e `merged.race`.

**Resultado:** `ancestry` passa a ser usado corretamente quando `race` está vazio.

### 6) Conflito `subRace` válido vs custom legado (Importante)

**Problema:** custom legado `Sub-raca` podia sobrescrever `subRace` já válido.

**Correção aplicada:**

- na normalização, `subRace` válido e diferente de `nenhum` passa a ter precedência;
- custom legado continua sendo fallback quando `subRace` está ausente/inválido.

**Resultado:** evita regressão de bônus em documentos parcialmente migrados.

---

## Compatibilidade com fichas existentes

- Mantida: formato persistido de `race`, `subRace`, `customFields` e `_migration` não mudou.
- Mantida: sem alteração em UI, layout, CSS ou identidade visual.
- Mantida: migração segue idempotente (`characterNeedsRaceSubRacePersist` + normalização).
- Mantida: suporte a legado (`Sub-raca` em custom field e `ancestry`) com resolução mais robusta.

---

## Riscos remanescentes

Itens não incluídos nesta rodada (fora do escopo Crítico/Importante):

1. Baixa visibilidade para Mestre de valores homebrew mapeados para `nenhum` (permanece `console.warn`).
2. Documentação da especificação ainda contém trechos históricos que podem parecer estado atual.
3. Export JSON continua sem `schemaVersion` explícito.

---

## Observação de escopo

Foram aplicadas apenas correções relacionadas aos itens classificados como Crítico/Importante, com mudanças localizadas em `app.js` e sem refatoração ampla.
