# Auditoria — Campos Extras (customFields)

**Data:** 2026-06-04
**Fontes:** `docs/NiarTale_Documento_Continuidade.md`, codigo `app.js`
**Natureza:** auditoria independente. **Nao implementar.**

---

## 1. Ciclo de vida verificado

| Operacao | Funcao | Evidencia | Veredito |
|---|---|---|---|
| Criar | `addCustomField` | `app.js:1444-1449` | Funciona, com guarda `canEdit` |
| Editar | `field()` → `updateCustomField(c, id, patch)` → `updateArrayItem` | `app.js:927-928, 1452-1456, 1371-1375` | Funciona, por `id` |
| Excluir | `removeListItem(c, "customFields", f.id)` | `app.js:924, 1465-1470` | Funciona por `id`, **exceto** casos abaixo |
| Persistir | `saveChar` → `sanitizeCharacterForPersist` → `updateDoc` (doc inteiro) | `app.js:1387-1400, 208-241` | Funciona |
| Carregar | `normalizeCharacter` → `applyRaceSubRaceNormalization` | `app.js:397-417, 103-132` | Funciona |
| Reordenar | — | inexistente | **Nao implementado** (limitacao) |
| Compat. fichas antigas | `data.customFields ?? base.customFields` | `app.js:411` | Parcial (ver I2) |

**Foco durante digitacao:** a edicao usa `field()` **sem** `opts.refresh`, logo nao chama `render()` por tecla — foco preservado. O `id` no closure (nao indice) torna a edicao robusta a reordenacao/mutacao do array. Bom.

---

## 2. Achados

### Criticos
- Nenhum.

### Importantes

**I1 — Campo "Almas" e indeletavel (UI inconsistente com comportamento).**
`applyRaceSubRaceNormalization` reinjeta "Almas" sempre que ele estiver ausente (`app.js:113-116`), e essa funcao roda tanto no **carregamento** (`normalizeCharacter`) quanto na **persistencia** (`sanitizeCharacterForPersist`). Fluxo de exclusao:
```
removeListItem → c.customFields.filter(...)   // remove Almas
              → saveChar → sanitize → reinjeta Almas (novo id)
              → render                          // Almas reaparece
```
Resultado: o botao "×" sugere que "Almas" e deletavel, mas ele volta imediatamente (com `id` novo). 
**Impacto:** confusao do usuario / acao sem efeito. **Risco:** medio (UX). **Recomendacao:** ou tornar "Almas" um campo de sistema visivelmente nao removivel (sem botao ×), ou parar de reinjetar quando o usuario o remove deliberadamente.

**I2 — Fichas antigas com `customFields` sem `id` ficam ineditaveis e inremoviveis.**
`normalizeCharacter` faz `data.customFields ?? base.customFields` **sem backfill de `id`** (`app.js:411`). Como `updateCustomField` (`findIndex(f.id === id)`) e `removeListItem` (`filter(item.id !== id)`) operam por `id`, qualquer entrada legada sem `id`:
- nao pode ser editada (`findIndex` → -1, nenhuma alteracao);
- nao pode ser removida individualmente (filtro por `id === undefined` nao casa o item).
**Impacto:** campos legados "presos". **Risco:** medio, depende do historico de dados (entradas criadas fora de `addCustomField`/default). **Recomendacao:** backfill de `id` na normalizacao (`map` garantindo `id: f.id || uid("cf")`).

**I3 — Campo nomeado "Sub-raca" e silenciosamente removido (perda de dado + efeito colateral).**
`stripSubRaceCustomFields` remove qualquer campo cujo label normalize para `"sub-raca"` (`app.js:95-97`), e o valor e desviado para `c.subRace`. `norm()` remove acentos/caixa mas **nao** hifens, entao "Sub-raça", "SUB-RACA" etc. caem nessa regra. Um usuario que crie um campo extra legitimamente chamado "Sub-raca" o vera desaparecer no proximo save, e o valor vira sub-raca da ficha.
**Impacto:** perda silenciosa de campo + alteracao inesperada de sub-raca. **Risco:** baixo-medio (label incomum, mas efeito grave). **Recomendacao:** restringir o strip apenas a migracao legada (uma vez), nao em todo save; ou documentar "Sub-raca" como label reservado.

### Menores

**M1 — Reordenacao inexistente.** Pedida na auditoria; nao ha UI nem modelo para reordenar campos. Limitacao, nao bug. A ordem segue a do array (ordem de criacao).

**M2 — Labels duplicados permitidos.** `addCustomField` cria sempre "Novo campo"; nada impede multiplos campos com o mesmo label. `customFieldVal` retorna apenas o **primeiro** match (`app.js:78-80`), entao leituras por label (ex.: "Almas") podem ignorar duplicatas. **Risco:** baixo. **Recomendacao:** opcional — avisar/dedupe por label em campos semanticos.

**M3 — Reinjecao de "Almas" gera `id` novo a cada ausencia.** Em fichas sem "Almas", cada `normalizeCharacter`/`sanitize` cria um `id` diferente, podendo provocar escrita/diff desnecessario. **Risco:** baixo. Ligado a I1.

**M4 — Persistencia por sobrescrita de documento inteiro.** `saveChar` faz `updateDoc(..., { ...data })` com todo o objeto (`app.js:1392-1393`); em uso multi-aba/concorrente vale "last write wins" para `customFields`. **Risco:** baixo (mitigado por `locallyDirtyCharacters` e debounce). 

**M5 — Saves redundantes na edicao.** `field()` dispara `scheduleCharSave` no `input` e `saveChar` no `change`/blur (`app.js:1702-1708`); somado ao debounce, ha gravacoes redundantes (sem dano funcional). **Risco:** muito baixo.

**M6 — Sem validacao de tamanho/conteudo** de label e value (texto livre). **Risco:** muito baixo.

---

## 3. Compatibilidade com fichas antigas (resumo)

| Cenario | Resultado |
|---|---|
| Ficha sem `customFields` | Recebe default (inclui "Almas"). OK |
| `customFields` com `id` | Editar/excluir OK |
| `customFields` **sem `id`** | Editar/excluir quebrados (**I2**) |
| Campo legado "Sub-raca" | Migrado para `c.subRace` e removido (by design; ver I3 para colisao com campo legitimo) |

---

## 4. Conclusao

Criar, editar, excluir, persistir e carregar **funcionam** no caminho feliz (campos com `id` criados pela UI atual), com foco preservado e operacoes por `id`. Nao ha reordenacao (limitacao conhecida). Os pontos de atencao sao:

- **Importantes:** I1 (Almas indeletavel/UI inconsistente), I2 (campos legados sem `id` presos), I3 (label "Sub-raca" removido silenciosamente).
- **Menores:** M1–M6 (reordenacao ausente, labels duplicados, churn de id, sobrescrita de doc, saves redundantes, ausencia de validacao).

Nenhum achado **Critico**. Recomenda-se priorizar I2 (compatibilidade/perda de acesso) e I1 (consistencia de UX) numa futura sprint de Campos Extras.

*Fim da auditoria. Nenhuma alteracao de codigo foi realizada.*
