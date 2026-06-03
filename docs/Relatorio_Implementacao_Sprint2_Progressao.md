# Relatorio de Implementacao — Sprint 2 (Progressao)

**Data:** 2026-06-03  
**Escopo implementado:** EXP, XP, Aplicados, NVL  
**Base de referencia:** `docs/Especificacao_Sprint2_Progressao.md`, `docs/Planilha Original.xlsx` (aba `Ficha`)

Nenhuma alteracao de identidade visual foi aplicada. A sprint reutiliza estruturas existentes de modelo, render e persistencia.

---

## 1) Arquivos alterados

- `app.js`
- `docs/NiarTale_Documento_Continuidade.md`
- `docs/Relatorio_Implementacao_Sprint2_Progressao.md` (novo)

---

## 2) Funcionalidades implementadas

### 2.1 Novos campos de progressao no modelo

Adicionados em `defaultCharacter()`:

- `exp: 0`
- `xp: 0`
- `nvl: 0`

Objetivo: cobrir os equivalentes da planilha:

- EXP (`E13/F13`)
- XP (`E14/F14`)
- LVL/NVL (`G14/H14`) — mantendo `lv` como nivel atual e adicionando `nvl`.

### 2.2 Compatibilidade em leitura (fichas antigas)

Em `normalizeCharacter()`:

- `exp`, `xp` e `nvl` sao normalizados para numero com fallback seguro para `0`;
- clamp para `>= 0` aplicado na normalizacao.

Isso permite abrir fichas antigas que nao possuem esses campos sem erro nem necessidade de migracao eager.

### 2.3 Normalizacao antes de salvar

Em `sanitizeCharacterForPersist()`:

- `exp`, `xp` e `nvl` sao normalizados para numero e clampados para `>= 0` antes da persistencia.

### 2.4 Aplicados derivado (read-only)

Implementado helper:

- `appliedPoints(c)` = soma de `attributes.for/con/agi/int/mag`.

Paridade com planilha:

- `H13 = SUM(F15:F24)` (na pratica, soma dos 5 atributos da ficha).

Regra adotada:

- **Aplicados nao e persistido**; e sempre calculado no render.

### 2.5 UI de Progressao na ficha

Na aba Atributos (`renderStats`), foi adicionado o card **Progressao** com:

- campos editaveis: `EXP`, `XP`, `NVL`;
- metricas read-only: `APLICADOS` e `LV/NVL`.

Fluxo reutilizado:

- campos usam `field(..., { type:\"number\", refresh:true })`;
- escrita via `updateChar` + persistencia padrao (`scheduleCharSave`/`saveChar`).

### 2.6 Impacto em calculos mecanicos

- `excelCalc()` nao foi alterado;
- nenhum derivado mecanico foi impactado.

---

## 3) Estrategia de migracao utilizada

### 3.1 Tipo

**Migracao lazy (aditiva)**, sem batch eager.

### 3.2 Como funciona

- `normalizeCharacter()` injeta defaults (`exp/xp/nvl`) em memoria para fichas que ainda nao possuem os campos;
- no proximo ciclo natural de save, os campos passam a ser persistidos no Firestore;
- como os campos sao aditivos e independentes de `excelCalc`, nao foi necessario processo de migracao em massa.

### 3.3 Motivo da escolha

- menor risco operacional;
- idempotente;
- evita escrita desnecessaria em toda a base.

---

## 4) Testes recomendados

### 4.1 Funcionais

1. Editar `EXP`, `XP` e `NVL` e confirmar persistencia apos recarregar.
2. Alterar atributos FOR/CON/AGI/INT/MAG e confirmar recomputo de `APLICADOS`.
3. Confirmar exibicao correta de `LV/NVL` no card de progressao.

### 4.2 Compatibilidade

4. Abrir ficha legada sem `exp/xp/nvl` e validar render sem erro.
5. Salvar ficha legada e confirmar que novos campos sao persistidos com defaults validos.

### 4.3 Nao-regressao

6. Confirmar que HUD continua exibindo `LV` atual (`lv`) sem alteracao de layout.
7. Confirmar que `excelCalc` (HP/PP/C.A/INI/ESQ/BLOQ/P.A/R.D.) nao mudou.
8. Verificar fluxo Jogador/Mestre (permissoes de edicao) inalterado.

---

## 5) Riscos remanescentes

### R1 — Semantica EXP vs XP (medio)

- A planilha nao define relacao automatica entre EXP e XP;
- implementacao preserva ambos como manuais e independentes;
- risco: equipes podem esperar uma regra automatica que nao existe.

### R2 — Ausencia de validacao de orcamento por Aplicados (medio)

- `Aplicados` e exibido, mas nao bloqueia distribuicao de atributos;
- decisao proposital para nao travar fichas legadas nesta sprint.

### R3 — Coexistencia lv/nvl sem regra de consistencia (baixo)

- `nvl` pode ficar menor que `lv` se preenchido manualmente;
- sprint atual nao aplica correcao automatica por design conservador.

---

## 6) Resultado da Sprint 2

Sprint 2 implementada integralmente com alteracoes aditivas, baixo risco de regressao e sem impacto em `excelCalc`. A compatibilidade retroativa foi preservada por normalizacao lazy e persistencia natural no fluxo existente.
