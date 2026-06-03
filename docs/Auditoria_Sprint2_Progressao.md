# Auditoria — Sprint 2 (Progressão: EXP, XP, Aplicados, NVL)

**Data:** 2026-06-03
**Fontes:** `app.js`, `firestore.rules`, `docs/Especificacao_Sprint2_Progressao.md`, `docs/Relatorio_Implementacao_Sprint2_Progressao.md`, `docs/NiarTale_Documento_Continuidade.md`, `docs/Planilha Original.xlsx`
**Natureza:** somente auditoria. Nenhuma alteração de código foi realizada.

## Veredito: APROVADO — sem item Crítico

Implementação aditiva, retrocompatível e sem impacto em `excelCalc`. Foram identificados **0 Críticos**, **2 Importantes** e **3 Menores**, todos relacionados a UX/consistência, não a corrupção de dados ou regressão de cálculo.

---

## 1. Aderência à planilha — ALTA

| Campo | Planilha | Implementação | Status |
|---|---|---|---|
| EXP | `E13/F13` (manual) | `c.exp` manual | ✓ |
| XP | `E14/F14` (manual) | `c.xp` manual | ✓ |
| Aplicados | `H13 = SUM(F15:F24)` | `appliedPoints` = soma de FOR/CON/AGI/INT/MAG | ✓ |
| NVL | `G14/H14` ("atual/máximo") | par `lv`/`nvl` exibido como `lv/nvl` | ✓ |

- `H13 = SUM(F15:F24)` foi confirmado no XML e corresponde à soma dos 5 valores brutos de atributo — exatamente o que `appliedPoints(c)` faz (`app.js` L1469).
- EXP/XP sem fórmula na planilha → corretamente modelados como manuais, sem relação automática inferida.
- `H14` é texto `atual/máximo` sem fórmula → modelado como par manual; coerente.

**Observação Menor (M1):** a planilha não define limite/teto para EXP/XP; o app aplica clamp inferior `>= 0`. É uma extensão defensiva, não uma divergência mecânica.

## 2. Aderência à especificação — TOTAL

Todos os itens da `Especificacao_Sprint2_Progressao.md` foram cumpridos:

- `defaultCharacter()` adiciona `exp/xp/nvl` (`app.js` L332). ✓
- `normalizeCharacter()` injeta defaults com clamp (`app.js` L382–384). ✓
- `sanitizeCharacterForPersist()` normaliza/clampa antes de salvar (`app.js` L217–219). ✓
- `appliedPoints()` como helper isolado, **não** persistido (`app.js` L1469). ✓
- Card "Progressao" em `renderStats` com EXP/XP/NVL + métricas APLICADOS e LV/NVL (`app.js` L967–977). ✓
- `excelCalc` inalterado. ✓
- HUD mantém apenas `lv` (`app.js` L814). ✓

Divergência **positiva** em relação à spec: a spec sugeria `field(..., updateNested...)`; a implementação usou `updateChar(c, { exp/xp/nvl })`. É equivalente e até preferível (passa por validação/resolve de `updateChar`). Sem problema.

## 3. Compatibilidade com fichas antigas — OK

- Fichas sem `exp/xp/nvl` recebem `0` em `normalizeCharacter` (`?? base`), sem erro de render.
- Campos são aditivos; nada existente é removido ou renomeado.
- `appliedPoints` depende só de `attributes`, que já é normalizado.

## 4. Persistência no Firestore — OK

- `saveChar` serializa o doc inteiro (`const { id, ...data } = c`), então `exp/xp/nvl` são gravados naturalmente.
- `sanitizeCharacterForPersist` garante números válidos (clamp `>= 0`).
- Tipos compatíveis (number). Nenhum campo aninhado novo problemático.
- Sem defeito de persistência identificado. O ponto de atenção relacionado à materialização em documentos migrados está em **I2** (seção 5).

## 5. Migração de dados — OK (lazy), com 1 ponto Importante

- Estratégia **lazy** confirmada: defaults em `normalizeCharacter`; consolidação no próximo `saveChar`.
- **Não há migração eager** para `exp/xp/nvl` — coerente com a spec.

**Importante (I2) — `buildRaceSubRaceFirestorePatch` é um update parcial e NÃO inclui `exp/xp/nvl`.**
- Arquivo afetado: `app.js` L145–160 (e uso em L563).
- Situação: quando `migrateRaceSubRaceOnce` grava uma ficha (Mestre, escopo da campanha), ele faz `batch.update(d.ref, patch)` apenas com `race/subRace/customFields/_migration/updatedAt`. Isso **não** adiciona os campos de progressão ao documento.
- Risco: **baixo/médio**. Não corrompe nada (os campos continuam sendo resolvidos por `normalizeCharacter` na leitura), mas significa que `exp/xp/nvl` só são materializados no Firestore quando a ficha for salva por edição normal. Em consultas/integrações externas que leem o doc cru (ex.: export, relatórios fora do app), o campo pode estar ausente.
- Correção sugerida: **não** alterar o patch de raça/sub-raça (manter responsabilidade única). Se materialização garantida for desejada, criar uma migração aditiva própria/idempotente para progressão **ou** documentar explicitamente que a materialização é lazy. Recomendação: documentar (mais barato e suficiente).

## 6. Regressões em HP, PP, raça e sub-raça — NENHUMA

- `excelCalc` não foi tocado; `hpMax/ppMax`, mods, C.A, INI, ESQ, BLOQ, P.A, R.D. permanecem idênticos.
- Bloco `combat` (Sprint 1) intacto; `normalizeCombatState` continua sendo chamado em `sanitize`.
- Raça/sub-raça: `applyRaceSubRaceNormalization` segue sendo a última etapa de `normalizeCharacter`; os novos campos são atribuídos em `merged` **antes** da normalização de raça e não interferem nela.
- `characterNeedsRaceSubRacePersist` e `buildRaceSubRaceFirestorePatch` inalterados → migração de raça/sub-raça não regrediu.

## 7. Impacto em permissões — NENHUM

- `firestore.rules` para `characters` autoriza `update` por owner/Mestre sem validação por campo; campos novos (`exp/xp/nvl`) são aceitos sem mudança de regra.
- UI: campos do card Progressao usam `field`/`updateChar`, que respeitam `canEdit` (Jogador só edita a própria ficha; campos desabilitados quando `!canEdit`).
- `nvl` não tem restrição "somente Mestre" — coerente com a spec (campo do jogador). Se o produto quiser que NVL (nível máximo de campanha) seja exclusivo do Mestre, é decisão futura (ver M2).

## 8. Impacto em campanhas existentes — NENHUM

- Nenhuma escrita em `campaigns/*`; `CAMPAIGN_ID` e fluxo de campanha inalterados.
- Migração eager de raça/sub-raça por Mestre não foi modificada; nenhum novo gatilho de escrita em massa foi introduzido na Sprint 2.

---

## Classificação consolidada

### Crítico
- Nenhum.

### Importante

**I1 — Dessincronização possível entre `lv` e `nvl` (sem regra de consistência).**
- Arquivo: `app.js` L905 (`lv`), L971/L975 (`nvl`, `lv/nvl`).
- Risco: médio (UX/semântica). `nvl` pode ficar menor que `lv` ou `0`, exibindo pares como `5/0`, o que pode confundir.
- Correção sugerida: exibir aviso visual quando `nvl > 0 && nvl < lv` (sem alterar `lv`), ou definir default `nvl = lv` em criação de ficha nova. Não bloquear.

**I2 — Materialização lazy não cobre o patch de migração de raça/sub-raça.**
- Arquivo: `app.js` L145–160 / L563.
- Risco: médio-baixo. `exp/xp/nvl` ausentes no doc cru até o próximo save normal; afeta leitores externos do Firestore (não o app).
- Correção sugerida: documentar a materialização lazy como comportamento esperado **ou** adicionar migração aditiva idempotente própria de progressão (separada do patch de raça/sub-raça).

### Menor

**M1 — Clamp `>= 0` em EXP/XP sem equivalente explícito na planilha.**
- Arquivo: `app.js` L217–219, L382–384.
- Risco: baixo. Impede valores negativos; pode divergir de uma planilha que (teoricamente) aceitasse negativos. Sem efeito mecânico.
- Correção sugerida: manter; registrar a decisão na documentação.

**M2 — `nvl` editável por qualquer dono de ficha.**
- Arquivo: `app.js` L971.
- Risco: baixo. Se NVL representar teto de campanha, idealmente seria controle de Mestre.
- Correção sugerida: decisão de produto; se necessário, marcar o campo com gating de Mestre (como já se faz com `player`/`{ disabled: !isMaster() }`).

**M3 — Atualização não-imediata de APLICADOS/LV-NVL durante digitação.**
- Arquivo: `app.js` L942 (atributos `refresh:true`) e card Progressao.
- Risco: baixo. Por `!isTyping()`, as métricas só recomputam após blur/refresh — mesmo padrão já existente no projeto (consistente, não é novo defeito).
- Correção sugerida: nenhuma obrigatória; se desejado, forçar re-render no `change`.

---

## Recomendações finais (sem implementar)

1. Tratar **I1** com aviso visual leve (não bloquear) e/ou default `nvl = lv` em fichas novas.
2. Resolver **I2** por documentação (materialização lazy) — caminho mais barato e suficiente.
3. Menores (M1–M3) são aceitáveis como estão; registrar M1 e decidir M2 conforme regra de campanha.

Nenhum item impede produção. A Sprint 2 está consistente com a planilha, com a especificação e com a base existente, sem regressões mecânicas.

*Fim da auditoria. Nenhuma alteração de código foi realizada.*
