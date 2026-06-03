# Relatorio de Implementacao — Sprint 1 (Paridade Planilha)

**Data:** 2026-06-03  
**Escopo implementado:** HATE, Inversao, Calcula Dano, Calcula Cura, Calcula PP, HP/PP Restante  
**Base de referencia:** `docs/Plano_Paridade_Planilha.md`, `docs/Planilha Original.xlsx` (aba `Ficha`)

Nenhuma mudanca de identidade visual foi aplicada. As alteracoes focam em modelo, calculo derivado e exposicao de controles na UI existente.

---

## 1) Arquivos alterados

- `app.js`
- `docs/NiarTale_Documento_Continuidade.md`
- `docs/Plano_Paridade_Planilha.md` (status da Sprint 1 marcado como implementado)

---

## 2) Funcionalidades implementadas

### 2.1 HATE e Inversao com controle de UI

- Mantida a logica existente em `excelCalc()`:
  - `conditions.hateBoost` (+30 em FOR/CON/AGI/MAG e +16 em R.D.)
  - `conditions.inversion` (+14 em FOR/CON/AGI/MAG)
- Adicionados toggles com `checkField` em:
  - aba **Atributos** (`card("Condicoes")`)
  - aba **Recursos** (`card("Fluxo de combate")`)
- Persistencia reaproveita fluxo atual (`updateNested` + `scheduleCharSave` + `saveChar`).

### 2.2 Modelo de combate para paridade da planilha

- Novo bloco `combat` no personagem:
  - `hpDamage` (5 slots)
  - `hpHeal` (5 slots)
  - `ppSpend` (5 slots)
  - `ppRecover` (5 slots)
- Funcoes adicionadas para compatibilidade e seguranca:
  - `defaultCombatState()`
  - `normalizeCombatSeries()`
  - `normalizeCombatState()`
- Retrocompatibilidade:
  - `normalizeCharacter()` injeta defaults quando `combat` nao existe.
  - `sanitizeCharacterForPersist()` normaliza antes de salvar.
  - Todos os valores sao convertidos para numero e clampados para `>= 0`.

### 2.3 Calcula Dano, Calcula Cura, Calcula PP e PP Recuperado na UI

- Novo card **Fluxo de combate** na aba Recursos com entradas numericas:
  - Calcula Dano (5 linhas)
  - Calcula Cura (5 linhas)
  - Calcula PP (gasto, 5 linhas)
  - PP Recuperado (5 linhas)
- Helpers adicionados:
  - `sumSeries()`
  - `combatFlow()`
  - `updateCombatSeries()`
  - `renderCombatSeriesInputs()`
  - `renderCombatFlowCard()`

### 2.4 HP Restante e PP Restante derivados

- Implementado com as formulas da planilha:
  - `HP Restante = hpMax - SUM(hpDamage) + SUM(hpHeal)` (equivalente a `X23`)
  - `PP Restante = ppMax - SUM(ppSpend) + SUM(ppRecover)` (equivalente a `X30`)
- Totais e restantes exibidos em metricas no card Fluxo de combate:
  - `DANO`, `CURA`, `HP REST.`, `PP GASTO`, `PP REC.`, `PP REST.`

### 2.5 Reuso de calculo existente

- `hpMax` e `ppMax` continuam vindo de `excelCalc()`.
- Nao houve alteracao de formulas centrais de raca/sub-raca, atributos, derivados, pericias ou armadura.

---

## 3) Riscos identificados

### R1 — Dupla referencia de estado para HP/PP atual (medio)

- Atualmente coexistem:
  - `resources.hp.current` / `resources.mp.current` (controle manual)
  - `HP Restante` / `PP Restante` (derivado do bloco `combat`)
- Nesta sprint, por seguranca, os derivados **nao sobrescrevem automaticamente** `resources.*.current`.
- Impacto: pode haver divergencia visual se o usuario editar os dois blocos sem disciplina operacional.

### R2 — Persistencia de novo bloco em fichas legadas (baixo)

- Mitigado por normalizacao em leitura (`normalizeCharacter`) e antes de persistir (`sanitizeCharacterForPersist`).
- Valores invalidos sao absorvidos e normalizados.

### R3 — Edicao rapida de varias entradas de combate (baixo)

- Usa o debounce ja existente (`scheduleCharSave`), sem alterar o mecanismo de dirty snapshot.
- Risco residual baixo de percepcao de atraso de save em digitacao muito intensa (comportamento ja existente no app).

---

## 4) Testes recomendados

### 4.1 Regressao funcional (obrigatorio)

1. **HATE ON/OFF** na aba Atributos e Recursos:
   - confirmar atualizacao imediata de `mods.for/con/agi/mag` e `R.FIS/R.MAG`.
2. **Inversao ON/OFF**:
   - confirmar +14 em FOR/CON/AGI/MAG e nenhuma alteracao em INT.
3. **Persistencia dos toggles**:
   - salvar, recarregar pagina e validar manutencao do estado.

### 4.2 Bloco de combate (obrigatorio)

4. Preencher `hpDamage` e validar:
   - `DANO = SUM(Dano 1..5)`
   - `HP REST. = hpMax - DANO + CURA`
5. Preencher `hpHeal` e validar recomputo de `HP REST.`.
6. Preencher `ppSpend`/`ppRecover` e validar:
   - `PP GASTO = SUM(Gasto 1..5)`
   - `PP REC. = SUM(Rec 1..5)`
   - `PP REST. = ppMax - PP GASTO + PP REC.`

### 4.3 Compatibilidade (obrigatorio)

7. Abrir ficha antiga sem campo `combat`:
   - garantir que UI renderiza sem erro e salva corretamente.
8. Testar usuario Jogador e Mestre:
   - confirmar que permissoes de edicao continuam intactas.

### 4.4 Nao-regressao visual/comportamental (recomendado)

9. Verificar que layout geral e tema visual permanecem iguais (sem redesign).
10. Verificar que save debounce e protecao de snapshot dirty continuam funcionando durante digitacao.

---

## 5) Validacoes realizadas nesta implementacao

- `ReadLints` executado em `app.js` e docs alterados: **sem erros**.
- Conferencia de formulas na planilha:
  - `X21 = SUM(W19:W23)`
  - `X23 = K24-SUM(W19:W23)+SUM(Y19:Y23)`
  - `X28 = SUM(W26:W30)`
  - `X30 = K27-SUM(W26:W30)+SUM(Y26:Y30)`

---

## 6) Resultado da Sprint 1

Sprint 1 implementada com alteracoes minimas e seguras, mantendo compatibilidade com fichas existentes e reutilizando calculos ja consolidados (`excelCalc`). A principal pendencia remanescente desta sprint e a decisao futura sobre consolidar (ou nao) `HP/PP Restante` como fonte unica de verdade para `resources.hp.current`/`resources.mp.current`.
