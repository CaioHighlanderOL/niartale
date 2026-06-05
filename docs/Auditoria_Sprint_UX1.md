# Auditoria — Sprint UX-1: Cards Colapsaveis Individuais

**Data:** 2026-06-05
**Fontes:** `docs/Especificacao_Sprint_UX1_Cards_Colapsaveis.md`, `docs/Relatorio_Implementacao_Sprint_UX1.md`, codigo `app.js`, `styles.css`
**Natureza:** auditoria independente. **Nao implementar.**

> Escopo: colapso **por item** + renomeacao em Habilidades, Inventario, Equipamentos e Campos Extras (inclui correcoes de CRUD dos Campos Extras).

---

## 1. Expandir / Recolher

| Categoria | Card por item | Evidencia | Veredito |
|---|---|---|---|
| Habilidades | `collapsibleItemCard(c, key, item.id, item.name, ...)` | `app.js:1158` | OK |
| Inventario | mesmo motor `buildItemCard` | `app.js:1158` | OK |
| Equipamentos | `collapsibleItemCard(c, "equipment", item.id, title, ...)` | `app.js:1228` | OK |
| Campos Extras | `collapsibleItemCard(c, "customFields", f.id, f.label, ...)` | `app.js:950` | OK |

- `toggleItem` alterna a chave em `expandedItems` e chama `render()` (`app.js:1850`).
- Recolhido: corpo (`card-collapse-body`) **nao** montado; cabecalho mantem nome + chevron + remover (`app.js:1859-1875`).
- `aria-expanded` no toggle; cabecalho em `div` com `button` de toggle + remover (sem aninhar botoes). **OK.**

---

## 2. Renomeacao

- **Habilidades/Inventario:** campo `name` no corpo atualiza memoria; titulo do cabecalho = `item.name`. OK.
- **Equipamentos:** titulo = `slot — name`; ambos editaveis no corpo. OK.
- **Campos Extras:** `field("Campo", f.label, (v) => updateCustomField(c, f.id, {label:v}))`; titulo = `f.label`. Edicao por `id` (`app.js:947-953, 1477-1481`). OK.
- Reflexo do nome no cabecalho ocorre no **proximo render** (sem re-render por tecla → foco preservado). Placeholder `(sem nome)` quando vazio. **OK.**

---

## 3. Persistencia

- Estado de colapso vive em `expandedItems` (Set de modulo, `app.js:290`), chave `"<characterId>:<categoria>:<itemId>"` — **efemero por sessao**.
- `sanitizeCharacterForPersist` **nao** referencia `expandedItems` → o colapso nao vaza para o Firestore.
- Nome e dados dos itens persistem normalmente via `saveChar`/`scheduleCharSave`.
- **OK** (colapso volta ao default ao recarregar; dados intactos — conforme spec).

---

## 4. Compatibilidade com fichas antigas

- Itens de listas ja possuem `id` (via `addListItem`); Campos Extras recebem `id` por backfill em `normalizeCustomFields` (`app.js:102-110`), aplicado em `applyRaceSubRaceNormalization` (load e save). OK.
- **I1 (Almas deletavel):** reinjecao forcada removida; "Almas" so vem do default de fichas novas. OK.
- **I3 ("Sub-raca" preservado):** strip condicional a `!subRaceAlreadyValid` em `applyRaceSubRaceNormalization` (`app.js:130-131`) e `!subRaceFromKey` em `ensureCharacterRaceSubRace`. OK.
- Sem migracao eager; `firestore.rules` inalterado. **OK.**

---

## 5. Inexistencia de regressoes

### 5.1 Calculos
- `collapsibleItemCard`/`toggleItem` nao chamam `excelCalc` nem usam derivados para decidir visibilidade.
- `armorState(c)` filtra por `e.equipped` sobre `c.equipment`, independente do colapso → equipamento recolhido **continua contando** em C.A./Esquiva/R.D. **Sem regressao.**

### 5.2 Permissoes
- `addCustomField`/`addListItem`/`updateCustomField`/`removeListItem` mantem guarda `canEdit`; botoes restritos com `data-master-only`/`disabled`. Toggle e visual (nao depende de `canEdit`), correto. **Sem regressao.**

### 5.3 Persistencia
- Nenhum campo novo persistido; colapso fora do persist. Backfill de `id` e aditivo/idempotente. **Sem regressao.**

### 5.4 `excelCalc`
- Intocado. **OK.**

Sem erros de lint.

---

## 6. Achados classificados

### Criticos
- Nenhum.

### Importantes
- Nenhum.

### Menores
- **M1 — Nome no cabecalho atualiza apenas no proximo render.** Intencional (preserva foco). Impacto leve.
- **M2 — Item criado com a secao recolhida.** O item nasce expandido, mas so aparece ao expandir a secao (colapso por secao). Estado correto; visibilidade diferida. Impacto muito baixo.
- **M3 — Colapso por item perdido ao recarregar.** Por design (sessao). Aceito.
- **M4 — "Almas" nao retorna em fichas antigas que nunca o tiveram.** Consequencia intencional da correcao I1; novas fichas recebem via default.

---

## 7. Conformidade com a especificacao

| Requisito | Status |
|---|---|
| Cards colapsaveis individuais (4 categorias) | ✓ |
| Nome editavel / renomeacao no cabecalho | ✓ |
| Cabecalho compacto quando recolhido | ✓ |
| Estado padrao: existentes recolhidos / novo expandido | ✓ |
| Colapso de sessao (nao persistido) | ✓ |
| Campos Extras: criar/editar/excluir/persistir/carregar corrigidos | ✓ |
| Sem alteracao de calculos / regras / `excelCalc` | ✓ |
| Compatibilidade com fichas antigas / sem eager | ✓ |
| Identidade visual mantida | ✓ |
| Sem erros de lint | ✓ |

---

## 8. Conclusao

Expandir/recolher e renomeacao funcionam nas quatro categorias; o colapso e efemero por sessao, isolado por ficha e puramente visual; as correcoes de Campos Extras (I1/I2/I3) estao aplicadas. Nenhuma regressao de calculo, permissao ou persistencia. Nenhum achado Critico ou Importante.

## GO

A Sprint UX-1 (cards colapsaveis individuais) esta aprovada para producao.

*Fim da auditoria. Nenhuma alteracao de codigo foi realizada.*
