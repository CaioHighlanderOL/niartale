# Relatorio de Implementacao — Sprint UX-1: Cards Colapsaveis Individuais

**Data:** 2026-06-05
**Base:** `docs/Especificacao_Sprint_UX1_Cards_Colapsaveis.md`, `docs/NiarTale_Documento_Continuidade.md`
**Resultado:** Sprint UX-1 implementada integralmente. Sem erros de lint.

> Esta sprint adiciona colapso **por item** (segundo nivel), coexistindo com o colapso **por secao** (`collapsibleCard`) ja existente.

---

## 1. Escopo entregue

| Funcionalidade | Status |
|---|---|
| Cards colapsaveis individuais — Habilidades | ✓ |
| Cards colapsaveis individuais — Inventario | ✓ |
| Cards colapsaveis individuais — Equipamentos | ✓ |
| Cards colapsaveis individuais — Campos Extras | ✓ |
| Nome editavel exibido no cabecalho | ✓ |
| Renomeacao refletida no proximo render | ✓ |
| Item novo inicia expandido | ✓ |
| Itens existentes iniciam recolhidos | ✓ |
| Placeholder `(sem nome)` quando vazio | ✓ |
| Campos Extras — criar com guarda de permissao | ✓ |
| Campos Extras — editar por `id` (I2 / robusto) | ✓ |
| Campos Extras — "Almas" deletavel (I1) | ✓ |
| Campos Extras — backfill de `id` legado (I2) | ✓ |
| Campos Extras — campo "Sub-raca" preservado (I3) | ✓ |

---

## 2. Arquivos alterados

### `app.js`

**Estado efemero por item:**
- `const expandedItems = new Set()` — objeto de modulo, chave `"<characterId>:<categoria>:<itemId>"`, isolado por ficha. NAO persiste.
- Helpers: `itemStateKey`, `isItemExpanded`, `markItemExpanded`, `toggleItem` (alterna e chama `render()`).

**Util de UI — `collapsibleItemCard(c, category, id, titleText, body, removeBtn)`:**
- Renderiza `section.panel.content-card.collapsible-card.list-item-card`.
- Cabecalho: `div.item-collapse-header` com `button.item-collapse-toggle` (chevron + nome, `aria-expanded`) e o botao remover ao lado — sem aninhar `<button>`.
- Quando recolhido, o corpo (`card-collapse-body`) nao e montado no DOM.
- Placeholder `(sem nome)` quando `titleText` e vazio.

**Aplicacao nas 4 categorias:**
- `buildItemCard` (Habilidades/Inventario): retorna `collapsibleItemCard(c, key, item.id, item.name, [grid], removeBtn)`.
- `buildEquipmentCard` (Equipamentos): titulo = `[slot, name].filter(Boolean).join(" — ")`; retorna `collapsibleItemCard`.
- Campos Extras (`renderGeneral`): cada campo e `collapsibleItemCard(c, "customFields", f.id, f.label, [Campo, Valor], removeBtn)`.

**Item novo inicia expandido:**
- `addListItem`: extrai `id` antes de inserir no array; chama `markItemExpanded(c, key, id)`.
- `addCustomField`: mesmo padrao com `uid("cf")` extraido.

**Correcoes de Campos Extras (I1/I2/I3):**
- `normalizeCustomFields(fields)`: novo helper aditivo/idempotente — garante `id` em todo campo (backfill), `label`/`value` como string. Aplicado em `applyRaceSubRaceNormalization` (cobre load e save) — I2.
- `applyRaceSubRaceNormalization`: removida reinjecao forcada de "Almas"; strip de "Sub-raca" condicional a `!subRaceAlreadyValid` — I1 e I3.
- `ensureCharacterRaceSubRace`: strip de "Sub-raca" tambem condicional (`!subRaceFromKey`) — I3.
- `updateCustomField(c, id, patch)`: edita por `id` (nao por indice) com guarda `canEdit`.
- `addCustomField`: guarda `canEdit` com toast.
- `removeListItem`: remove por `id` (ja existia; "Almas" agora nao e reinjetado).

### `styles.css`
Novas classes reaproveitando os tokens atuais:
- `.item-collapse-header` — flex, space-between, alinha toggle e remover.
- `.item-collapse-toggle` — botao sem borda, flex, texto ao lado do chevron.
- `.item-card-title` — overflow ellipsis (nome truncado em cabecalho compacto).
- `.item-collapse-toggle:hover .item-card-title` — cor de acento.
- `.item-collapse-toggle:focus-visible` — outline de acessibilidade.

### `docs/NiarTale_Documento_Continuidade.md`
- Nota sobre `collapsibleItemCard`/`expandedItems` adicionada na secao de renderizacao.

**Nao alterados:** `excelCalc`, `armorState`, derivados, progressao, `sanitizeCharacterForPersist` (alem do backfill de `id`), `firestore.rules`, modelo de dados de topo.

---

## 3. Estrategia utilizada

1. **Colapso e apresentacao, nunca dado.** Recolher deixa de montar o DOM do corpo; `equipped`, `armorType`, `name`, `label`, `value`, `qty` etc. permanecem intactos. Um equipamento recolhido **continua contando** em `armorState`/`excelCalc`.
2. **Estado de sessao, sem persistencia.** `expandedItems` vive em memoria, chaveado por `characterId:categoria:id`, zerando ao recarregar. Sem campo novo no Firestore, sem migracao.
3. **Default recolhido + item novo expandido.** Reduz rolagem em fichas grandes sem atrapalhar o fluxo de criacao.
4. **Nome reutilizado, sem campo novo.** Titulo usa `name`/`slot`/`label` existentes. Renomeacao no corpo; cabecalho atualiza no proximo render (sem re-render por tecla, foco preservado).
5. **Correcoes de Campos Extras centralizadas.** `normalizeCustomFields` aplicado no ponto unico de normalizacao que cobre load e save, sem duplicar logica.
6. **HTML valido.** Cabecalho em `div` com `button` de toggle + botao remover ao lado (sem aninhar botoes).

---

## 4. Compatibilidade com fichas antigas

| Cenario | Resultado |
|---|---|
| Itens com `id` (habilidades/inventario/equipamentos) | OK — toggle funciona normalmente |
| Campos extras legados **sem `id`** | `id` preenchido em load; editar/excluir passam a funcionar |
| "Almas" existente | Permanece; agora pode ser excluido definitivamente |
| Campo "Sub-raca" do usuario (com sub-raca valida) | Preservado — nao e removido no save |
| Migracao legada de sub-raca (subRace vazio) | Continua funcionando (migra e remove o custom) |
| Fichas sem `customFields` | Recebem default com "Almas" normalmente |

Sem migracao eager; sem alteracao de `firestore.rules`.

---

## 5. Testes recomendados

Para cada categoria (Habilidades, Inventario, Equipamentos, Campos Extras):
1. Criar → item novo aparece expandido com placeholder; demais recolhidos.
2. Renomear → digitar nome, sair do campo → cabecalho atualiza; sem perda de foco.
3. Expandir/recolher individual → nao afeta os demais.
4. Cabecalho recolhido → mostra so nome + chevron + remover.
5. Remover pelo cabecalho recolhido → lista atualizada.

Transversais:
6. Placeholder `(sem nome)` em item sem nome.
7. Equipamento recolhido → C.A./Esquiva/R.D. inalterados (cruzar com `Testes_Regressao.md` T-EQP/T-ARM).
8. Nenhum derivado muda ao recolher/expandir qualquer item.
9. Recarregar → dados intactos; colapso volta ao default (recolhido).
10. Ficha A recolhida → abrir ficha B (default) → voltar A (estado preservado na sessao).
11. Sem `canEdit`: expande/recolhe visualmente; nao edita/renomeia/remove.
12. Campos Extras: excluir "Almas" persiste; ficha legada sem `id` editavel; campo "Sub-raca" do usuario preservado.

---

## 6. Riscos remanescentes

| Risco | Severidade | Observacao |
|---|---|---|
| Nome no cabecalho so atualiza no proximo render | Baixo | Intencional; evita re-render por tecla (foco preservado) |
| Item criado com a secao recolhida | Muito baixo | Item cria expandido, mas so aparece ao expandir a secao — comportamento correto |
| Estado de colapso perdido ao recarregar | Baixo (aceito) | Decisao de sessao |
| "Almas" ausente em fichas antigas sem o campo | Baixo (aceito) | Remocao da reinjecao e intencional (I1); novas fichas recebem Almas via default |

Nenhum risco critico, de calculo, de permissao ou de persistencia identificado.

---

## 7. Conformidade com os requisitos

| Requisito | Status |
|---|---|
| Cards colapsaveis individuais (4 categorias) | ✓ |
| Nome editavel / renomeacao | ✓ |
| Cabecalho compacto quando recolhido | ✓ |
| Manter identidade visual atual | ✓ |
| Nao alterar calculos / regras / `excelCalc` | ✓ |
| Compatibilidade com fichas antigas | ✓ |
| Sem migracao eager | ✓ |
| Sem erros de lint | ✓ |

*Fim do relatorio. Sprint UX-1 (cards colapsaveis individuais) concluida.*
