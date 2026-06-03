# Plano de Implementação — Paridade com a Planilha Original

**Data:** 2026-06-03
**Base:** `docs/Relatorio_Paridade_Ficha_Planilha.md`
**Natureza:** planejamento. Nenhum código foi implementado ou alterado.

> Cada item informa: **impacto**, **dependências**, **risco de regressão** e **arquivos provavelmente afetados**.
> Convenção de risco: 🟢 baixo · 🟡 médio · 🔴 alto.

---

## Visão geral dos sprints

| Sprint | Foco | Itens | Risco agregado |
|:---:|------|------|:---:|
| 1 | Estado de combate + blocos dinâmicos | HATE, Inversão, HP/PP Restante, CalculaDANO, CalculaCURA, CalculaPP | 🟡 |
| 2 | Progressão | EXP, XP, Aplicados, NVL | 🟡 |
| 3 | Correções importantes | Perícias (bônus de atributo), Armaduras (controle explícito) | 🟡 |
| 4 | Recursos extras | Revisão do recurso EN | 🟢 |

**Premissas comuns a todos os sprints**
- Persistência segue o fluxo atual: `updateChar` / `updateNested` → `scheduleCharSave` → `sanitizeCharacterForPersist` → `saveChar`.
- Novos campos devem ser adicionados em `defaultCharacter()` e protegidos em `normalizeCharacter()` para retrocompatibilidade de fichas antigas.
- Sem alteração de `firestore.rules` (campos novos ficam dentro do doc da própria ficha).
- Validação manual (não há suíte automatizada no projeto).

---

## Sprint 1 — Estado de combate e blocos dinâmicos

Objetivo: expor os modificadores de combate já calculados e introduzir os blocos de dano/cura/PP da planilha (`W18:X29`).

### 1.1 HATE (toggle)
- **Impacto:** alto. `conditions.hateBoost` já soma +30 aos mods (For/Con/Agi/Mag) e +16 nas R.D., mas hoje só é editável via Firestore. Expor destrava um modificador central de combate.
- **Dependências:** nenhuma (lógica já existe em `excelCalc`).
- **Risco de regressão:** 🟢 — apenas adiciona controle; o cálculo não muda. Garantir `refresh:true` para recalcular HUD/painel.
- **Arquivos afetados:** `app.js` (`renderStats`/`renderResources` para inserir `checkField`; `updateNested(c,["conditions","hateBoost"],v)`). Sem mudança em modelo (já em `defaultCharacter` L302) nem em `excelCalc`.

### 1.2 Inversão (toggle)
- **Impacto:** alto. `conditions.inversion` soma +14 aos mods (exceto INT). Mesma natureza do HATE.
- **Dependências:** mesma UI/seção do HATE (entregar juntos).
- **Risco de regressão:** 🟢 — só controle.
- **Arquivos afetados:** `app.js` (`renderStats`, `updateNested(c,["conditions","inversion"],v)`).

### 1.3 CalculaDANO + HP Restante (`W18:X23`)
- **Impacto:** alto. Introduz registro estruturado de dano sofrido e HP restante = `hpMax - SUM(dano) + SUM(cura)`.
- **Dependências:** depende da estrutura nova de "entradas de combate" (modelo). Casado com 1.4 e 1.5 (mesmo bloco). `hpMax` vem de `excelCalc`.
- **Risco de regressão:** 🟡 — novo modelo persistido; risco de divergência entre HP da HUD/`resources.hp.current` e o "HP Restante" calculado. Definir fonte única de verdade (recomendado: HP Restante derivado, `resources.hp.current` opcionalmente espelhado).
- **Arquivos afetados:** `app.js` (modelo em `defaultCharacter`/`normalizeCharacter`; nova função de render do bloco; possível novo helper de cálculo; integração em `resourceBars`/`calculatedPanel`). `docs/` (atualizar especificação/continuidade).

### 1.4 CalculaCURA (`Y18:Y23`)
- **Impacto:** alto. Coluna de cura/recuperação que alimenta o HP Restante.
- **Dependências:** mesma estrutura de 1.3.
- **Risco de regressão:** 🟡 — herda o risco de fonte única de HP.
- **Arquivos afetados:** `app.js` (mesmo bloco de 1.3).

### 1.5 CalculaPP + PP Restante (`W25:X29`)
- **Impacto:** alto. Espelha 1.3/1.4 para PP: `ppMax - SUM(gasto) + SUM(recuperação)`.
- **Dependências:** reutiliza o componente genérico criado em 1.3/1.4; `ppMax` de `excelCalc`. Atenção ao rótulo PP vs `resources.mp`.
- **Risco de regressão:** 🟡 — divergência entre `resources.mp.current` e "PP Restante".
- **Arquivos afetados:** `app.js` (mesmo bloco/componente; `resourceBars`).

**Status:** ✅ **Implementado em 2026-06-03**.
- `conditions.hateBoost` e `conditions.inversion` expostos por `checkField` nas abas Atributos e Recursos.
- Novo bloco persistido `combat` em `defaultCharacter` + normalização em `normalizeCharacter`/`sanitizeCharacterForPersist` para retrocompatibilidade.
- Novo card `Fluxo de combate` em Recursos com entradas para Calcula Dano, Calcula Cura, Calcula PP e PP Recuperado (5 slots cada, como planilha).
- Novas métricas derivadas exibidas: DANO, CURA, HP REST., PP GASTO, PP REC., PP REST.
- Decisão aplicada de baixo risco: nesta sprint, os restantes são exibidos por derivação e **não** substituem automaticamente `resources.hp.current`/`resources.mp.current`.

**Entregável do Sprint 1:** toggles de HATE/Inversão na aba Atributos/Recursos e um bloco "Combate" com entradas de Dano/Cura/Gasto-PP/Recuperação-PP e os restantes calculados. Recomenda-se criar **um componente genérico de bloco de pares (tipo/quantidade)** para reaproveitar em HP e PP.

**Risco transversal do Sprint 1:** definir **fonte única de verdade** para HP/PP atual (hoje em `resources.*.current`). Sem isso, há risco de dois valores concorrentes (regressão de UX). Decisão de design deve preceder a implementação.

---

## Sprint 2 — Progressão (EXP / XP / Aplicados / NVL)

Objetivo: completar a progressão da planilha (`F13`, `F14`, `H13`, `H14`).

### 2.1 EXP (`F13` / `G13` Aplicados)
- **Impacto:** médio-alto. EXP total e o conceito de "Aplicados".
- **Dependências:** definição de regra (a planilha trata `H13 = SUM(F15:F24)` = soma dos valores de atributo). Precisa alinhar com `attributes[*].value`.
- **Risco de regressão:** 🟡 — se "Aplicados" passar a validar/limitar `attributes`, pode travar fichas legadas fora do orçamento de pontos. Recomenda-se exibir sem bloquear no MVP.
- **Arquivos afetados:** `app.js` (modelo: `exp`/`xp`; `renderGeneral` ou `renderStats`; possível cálculo de "Aplicados" derivado dos atributos). `docs/`.

### 2.2 XP (`F14`)
- **Impacto:** médio. XP disponível/corrente, distinto de EXP total.
- **Dependências:** depende de 2.1 (mesma seção e modelo).
- **Risco de regressão:** 🟢 — campo numérico isolado.
- **Arquivos afetados:** `app.js` (modelo + render).

### 2.3 Aplicados (`H13`)
- **Impacto:** médio. Soma de pontos investidos em atributos.
- **Dependências:** lê `c.attributes` (já existe). Pode ser puramente derivado (read-only).
- **Risco de regressão:** 🟢 se read-only; 🟡 se virar validador de orçamento.
- **Arquivos afetados:** `app.js` (helper de soma + exibição em `renderStats`).

### 2.4 NVL (`H14` — par LVL/NVL)
- **Impacto:** médio. Hoje só existe `lv` atual; falta o nível máximo/alvo (`atual/máximo`).
- **Dependências:** define se NVL é manual (Mestre) ou derivado de EXP.
- **Risco de regressão:** 🟡 — `lv` já é usado na HUD e em listagens; alterar sua semântica pode afetar exibições. Preferir **adicionar** `nvl` sem mexer em `lv`.
- **Arquivos afetados:** `app.js` (modelo: `nvl`; `renderGeneral`; HUD `hudStat` se for exibir o par). `docs/`.

**Entregável do Sprint 2:** seção de Progressão com EXP, XP, Aplicados (derivado) e par LV/NVL. Manter retrocompatibilidade adicionando campos novos sem redefinir `lv`.

---

## Sprint 3 — Correções importantes (Perícias e Armaduras)

### 3.1 Perícias — bônus do atributo base (coluna `Bônus` / `N`)
- **Impacto:** alto na fidelidade. Hoje `skillBonus` soma apenas `trained(+5) + master(+10) + extra`, **sem** o modificador do atributo base que a planilha agrega na coluna `Bônus`.
- **Dependências:** exige um **mapa perícia → atributo** (ex.: Atletismo→FOR, Arcanismo→MAG, etc.), que precisa ser confirmado contra a planilha antes de codar.
- **Risco de regressão:** 🔴 — `skillBonus` é reutilizado em `excelCalc` para **Reflexo (INI/ESQ)** e **Percepção (P.A)**. Alterar a fórmula pode mudar derivados já validados. Mitigação: separar "bônus de perícia base" (para INI/ESQ/P.A, como hoje) do "total exibido com atributo" (apenas na lista), evitando dupla contagem.
- **Arquivos afetados:** `app.js` (`skillBonus` e/ou nova função `skillTotal`; `renderSkills`; constante de mapeamento perícia→atributo; revisar usos em `excelCalc` L1373/L1380). `docs/`.

### 3.2 Armaduras — controle explícito (Leve/Média/Pesada)
- **Impacto:** alto. `armorState` infere o tipo pelo **nome** do equipamento (`includes("leve"/"media"/"pesada")`). Nome sem palavra-chave → armadura ignorada silenciosamente nos cálculos de C.A/ESQ/R.D.
- **Dependências:** adicionar `armorType` explícito ao item de `equipment` e ajustar `armorState` para preferir o campo, com fallback ao nome (retrocompatibilidade).
- **Risco de regressão:** 🟡 — `armorState` alimenta C.A, ESQ e R.D. em `excelCalc`. Itens legados sem `armorType` precisam continuar funcionando via fallback de nome. Testar fichas existentes.
- **Arquivos afetados:** `app.js` (modelo de `equipment` em `defaultCharacter`/`normalizeCharacter`; `armorState` L1397; UI de equipamento — select/checkbox de tipo; `excelCalc` consome o resultado sem mudança). `docs/`.

**Entregável do Sprint 3:** total de perícia exibido com o atributo base (sem afetar INI/ESQ/P.A) e seletor explícito de tipo de armadura com fallback compatível.

---

## Sprint 4 — Revisão de recursos extras (EN)

### 4.1 Recurso EN / Energia
- **Impacto:** médio na fidelidade. `resources.energy` (EN) existe na HUD/barras, mas **não tem correspondente na planilha** (que tem HP/PP/CASH).
- **Dependências:** decisão de produto — **manter e documentar** como extensão oficial, **renomear/mapear** para um recurso da planilha, ou **remover**.
- **Risco de regressão:** 🟡 — remover EN afeta `resourceBars` (L1304), `defaultCharacter` (L306), `normalizeCharacter` e fichas que já gravaram `resources.energy`. Se mantido, risco 🟢 (apenas documentar).
- **Arquivos afetados:** `app.js` (`resources` no modelo; `resourceBars`; `renderResources`). `docs/Especificacao_*` e `docs/NiarTale_Documento_Continuidade.md`.

**Entregável do Sprint 4:** decisão registrada sobre EN e documentação atualizada (e, se aplicável, migração suave que preserva fichas antigas).

---

## Dependências entre sprints

```
Sprint 1 (HATE/Inversão) ── independente, pode iniciar imediatamente
Sprint 1 (Dano/Cura/PP) ── define componente "bloco de pares" reutilizável
        │
        └──► reuso opcional em Sprint 2 (seções tabulares) e Sprint 3
Sprint 2 (Progressão) ── independente do Sprint 1; precisa de decisão de regra (Aplicados/NVL)
Sprint 3 (Perícias) ── ALTO acoplamento com excelCalc; isolar antes de tocar skillBonus
Sprint 3 (Armaduras) ── fallback obrigatório p/ não regredir fichas legadas
Sprint 4 (EN) ── independente; decisão de produto antes de codar
```

## Riscos de regressão — visão consolidada

| Item | Risco | Principal vetor de regressão | Mitigação |
|------|:---:|------|------|
| HATE / Inversão | 🟢 | Refresh de UI | `refresh:true` no controle |
| HP/PP Restante + Dano/Cura/PP | 🟡 | Dupla fonte de HP/PP atual | Definir fonte única antes de codar |
| EXP/XP/Aplicados | 🟡 | Validação de orçamento travar legado | MVP somente exibe, não bloqueia |
| NVL | 🟡 | Semântica de `lv` em HUD/listas | Adicionar `nvl` sem alterar `lv` |
| Perícias (bônus base) | 🔴 | `skillBonus` usado em INI/ESQ/P.A | Separar total exibido do bônus usado em derivados |
| Armaduras | 🟡 | `armorState` alimenta C.A/ESQ/R.D. | `armorType` explícito + fallback por nome |
| EN | 🟡 | Remoção afeta fichas com `resources.energy` | Manter+documentar ou migração suave |

## Arquivos provavelmente afetados — visão consolidada

- **`app.js`** — todos os sprints (modelo em `defaultCharacter`/`normalizeCharacter`; render em `renderStats`/`renderResources`/`renderGeneral`/`renderSkills`; `excelCalc`, `skillBonus`, `armorState`, `resourceBars`; componentes `checkField`/`field`/`selectField`).
- **`docs/Especificacao_Raca_SubRaca.md`** e **`docs/NiarTale_Documento_Continuidade.md`** — atualização de escopo/fórmulas a cada sprint.
- **`docs/Relatorio_Paridade_Ficha_Planilha.md`** — marcar itens conforme forem fechados.
- **`firestore.rules`** — *não previsto alterar* (campos novos ficam no doc da ficha; confirmar caso surja validação de schema).

---

## Recomendação de sequência de execução

1. **Sprint 1** começa por HATE/Inversão (ganho rápido, risco 🟢), depois o bloco Dano/Cura/PP (decidir fonte única de HP/PP **antes** de codar).
2. **Sprint 2** em paralelo possível, pois não depende do Sprint 1.
3. **Sprint 3** exige cuidado máximo: isolar a mudança de `skillBonus` para não regredir INI/ESQ/P.A.
4. **Sprint 4** é decisão de produto; pode ocorrer a qualquer momento.

*Fim do plano. Nenhuma alteração de código foi realizada.*
