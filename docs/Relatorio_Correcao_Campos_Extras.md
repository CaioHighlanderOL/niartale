# Relatorio de Correcao — Campos Extras (customFields)

**Data:** 2026-06-04
**Base:** `docs/Auditoria_Campos_Extras.md`
**Escopo:** corrigir apenas itens **Criticos** e **Importantes**.
**Restricoes atendidas:** sem alterar calculos, `excelCalc` ou permissoes; compatibilidade com fichas existentes preservada.

---

## 1. Itens tratados

A auditoria nao listou itens **Criticos**. Foram corrigidos os tres **Importantes**:

| Id | Problema | Status |
|---|---|---|
| I1 | "Almas" reinjetado em toda normalizacao → campo indeletavel | ✅ Corrigido |
| I2 | Campos legados sem `id` ineditaveis/inremoviveis | ✅ Corrigido |
| I3 | Campo nomeado "Sub-raca" removido silenciosamente | ✅ Corrigido |

Itens **Menores** (M1–M6) foram deliberadamente **nao** alterados, conforme escopo.

---

## 2. Arquivos alterados

### `app.js`

**(I2) Novo helper `normalizeCustomFields(fields)`** — `app.js` (junto aos utilitarios de customFields):
- Garante `id` em todo campo extra (`id: f?.id || uid("cf")`), preservando ids existentes.
- Normaliza `label`/`value` ausentes para string vazia.
- Aditivo e idempotente; retorna novo array/objetos (sem mutacao do input).

**(I1 + I3) `applyRaceSubRaceNormalization`:**
- **Removida** a reinjecao forcada de "Almas". O campo continua presente em fichas novas (vem de `defaultCharacter()`) e em fichas que ja o possuem, mas **deixa de ser recriado** quando o usuario o exclui — tornando-o deletavel (I1).
- A remocao do custom "Sub-raca" passou a ser **condicional**: so ocorre quando `subRace` ainda nao e uma chave valida (`!subRaceAlreadyValid`), isto e, quando o campo legado e de fato a **fonte** da migracao. Se `subRace` ja e valido, os campos do usuario sao preservados (I3).
- Passou a normalizar os campos via `normalizeCustomFields` antes de qualquer filtro (I2 no caminho de carregamento e de persistencia, pois ambos passam por esta funcao).

**(I3) `ensureCharacterRaceSubRace`:**
- A remocao do custom "Sub-raca" agora so acontece quando o valor **nao** veio de uma chave valida (`!subRaceFromKey`). Quando a sub-raca ja e valida (ex.: selecionada na UI), um campo extra chamado "Sub-raca" e preservado.

Nenhuma alteracao em `excelCalc`, formulas, normalizacao de combate/equipamento, ou regras de permissao (`canEdit`/`data-master-only` intactos).

---

## 3. Estrategia utilizada

1. **Ponto unico de normalizacao.** Tanto o carregamento (`normalizeCharacter`) quanto a persistencia (`sanitizeCharacterForPersist`) chamam `applyRaceSubRaceNormalization`. Concentrar o backfill de `id` ali cobre os dois fluxos sem duplicar logica.
2. **Backfill idempotente.** `normalizeCustomFields` so cria `id` quando ausente; fichas ja corretas passam inalteradas — sem churn de dados nem reescritas desnecessarias.
3. **Migracao preservada.** A migracao legada de "Sub-raca" continua funcionando: quando `subRace` esta vazio, o valor do custom e consumido e o campo removido (comportamento original). A mudanca apenas evita remover o campo quando ele **nao** e a fonte (caso de campo criado pelo usuario).
4. **Almas como dado, nao como invariante.** "Almas" nao participa de nenhum calculo (`excelCalc` nao o le); portanto remover a reinjecao e seguro e respeita a intencao do usuario de exclui-lo.

---

## 4. Compatibilidade com fichas existentes

| Cenario | Antes | Depois |
|---|---|---|
| Ficha sem `customFields` | default (com Almas) | igual (default com Almas) |
| `customFields` com `id` | OK | OK (inalterado) |
| `customFields` **sem `id`** | editar/excluir quebrados | **id preenchido no load**; editar/excluir OK |
| Excluir "Almas" | reaparecia | **permanece excluido** |
| Campo do usuario "Sub-raca" (com subRace valido) | removido no save | **preservado** |
| Migracao legada de sub-raca (subRace vazio) | migra e remove | **igual** (migra e remove) |

Nenhuma migracao eager foi adicionada; as correcoes sao lazy (aplicadas no proximo load/save), aditivas e nao destrutivas.

---

## 5. Riscos remanescentes

- **Almas em fichas antigas sem o campo:** com a reinjecao removida, fichas antigas que nunca tiveram "Almas" nao o ganharao automaticamente. Mitigacao: o usuario pode adiciona-lo manualmente; novas fichas ja vem com ele. (Comportamento desejado pela correcao de I1.)
- **Ambiguidade residual de "Sub-raca" na migracao:** se uma ficha legada tiver `subRace` vazio **e** um campo "Sub-raca" que o usuario gostaria de manter, a migracao ainda consumira/removera esse campo (caso unico e inevitavel; documentado). Apos a migracao, novos campos "Sub-raca" sao preservados.
- **Itens Menores nao tratados** (M1 reordenacao, M2 labels duplicados, M4 sobrescrita de doc, M5 saves redundantes, M6 validacao) permanecem como melhorias futuras.

---

## 6. Testes recomendados

1. **Excluir "Almas":** remover via "×", recarregar → permanece excluido.
2. **Ficha legada sem `id`:** carregar ficha com `customFields` sem `id` → editar label/valor e excluir funcionam.
3. **Criar/editar/excluir** campos comuns → persistencia e contagem `(N)` corretas.
4. **Campo "Sub-raca" do usuario:** com uma sub-raca valida selecionada, criar campo extra "Sub-raca" → permanece apos salvar/recarregar.
5. **Migracao legada:** ficha com `subRace` vazio e custom "Sub-raca=Anfibio" → valor migra para `subRace`, campo removido (comportamento original mantido).
6. **Regressao de calculo:** abrir fichas variadas e conferir PV/PP/C.A./INI/ESQ/R.D. inalterados (cruzar com `Testes_Regressao.md`).
7. **Permissoes:** usuario sem `canEdit` nao cria/edita/exclui campos (botoes ocultos/desabilitados).

---

## 7. Conclusao

Os tres itens Importantes (I1, I2, I3) foram corrigidos com alteracoes minimas, concentradas na normalizacao de raca/sub-raca e em um helper aditivo de `customFields`. Calculos, `excelCalc` e permissoes permanecem intactos, e a compatibilidade com fichas existentes foi preservada (correcoes lazy e nao destrutivas). Sem erros de lint.

*Fim do relatorio.*
