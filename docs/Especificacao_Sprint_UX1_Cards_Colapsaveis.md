# Especificacao Tecnica — Sprint UX-1: Cards Colapsaveis Individuais + Campos Extras

**Data:** 2026-06-05
**Fontes:** `docs/NiarTale_Documento_Continuidade.md`, `docs/Roadmap_Atualizado.md`, codigo `app.js`, `styles.css`
**Natureza:** especificacao. **Nao implementar.**

**Objetivo:** melhorar a usabilidade de fichas grandes tornando cada item um card colapsavel individual (com nome editavel no cabecalho) e corrigir o ciclo completo dos Campos Extras.

**Escopo:** Habilidades, Inventario, Equipamentos, Campos Extras.

> Coexiste com o colapso **por secao** (`collapsibleCard`/`collapsedSections`) ja existente. Esta sprint adiciona um segundo nivel: colapso **por item**.

---

## 1. Cards colapsaveis individuais

### 1.1 Comportamento atual
- **Habilidades/Inventario:** `buildStableListEditor` → `buildItemCard` renderiza cada item com **todos** os campos sempre visiveis.
- **Equipamentos:** `buildEquipmentCard` com todos os campos visiveis.
- **Campos Extras:** `renderGeneral` renderiza cada campo como `rowCard` (label/valor sempre visiveis).
- Resultado: fichas com muitos itens geram rolagem longa; nao ha colapso por item.

### 1.2 Comportamento esperado
- Cada item vira um **card colapsavel individual**.
- **Recolhido:** mostra apenas um **cabecalho compacto** = nome + chevron + botao remover; demais campos ocultos.
- **Expandido:** cabecalho + todos os campos atuais do item (sem mudar campos/layout interno).
- Toggle **individual** por item, independente dos demais e do colapso de secao.
- Acessibilidade: cabecalho com `button` de toggle e `aria-expanded`; navegavel por teclado.
- **Restricao critica:** colapsar e **apenas visual** — nao altera nenhum dado do item. Um equipamento recolhido **continua contando** em `armorState`/`excelCalc` (`equipped`/`armorType` intactos).

### 1.3 Cabecalho — fonte do nome
| Categoria | Nome exibido |
|---|---|
| Habilidades | `name` |
| Inventario | `name` |
| Equipamentos | `slot — name` (compoe os dois quando existirem) |
| Campos Extras | `label` |

Quando o nome estiver vazio, exibir placeholder neutro `(sem nome)`.

---

## 2. Nomeacao e renomeacao
- O **nome** aparece como titulo do cabecalho (recolhido e expandido), refletindo o valor atual.
- **Renomeacao a qualquer momento:** editar o campo de nome no corpo expandido (`name`/`slot` ou `label` em Campos Extras) atualiza o cabecalho no **proximo render** — sem re-render por tecla, para preservar foco/cursor.
- **Sem campo novo no modelo:** reusar os campos existentes. Nada e adicionado ao documento persistido por causa do nome.

---

## 3. Estado padrao e persistencia (decisoes)

### 3.1 Estado padrao: **recolhido**, com excecao do item novo
- Itens existentes **iniciam recolhidos** ao carregar a ficha (atende ao objetivo de reduzir rolagem), exibindo so o cabecalho com o nome.
- **Item recem-criado inicia expandido** (via marcacao explicita ao criar), para edicao imediata.

### 3.2 Persistencia do colapso: **apenas sessao (NAO persistido)**
- O estado expandido/recolhido por item vive em memoria de sessao (Set de modulo `expandedItems`), chave `"<characterId>:<categoria>:<itemId>"`.
- **Nao** persiste no Firestore e **nao** altera o modelo da ficha — coerente com "compatibilidade com fichas antigas" e "sem alteracao de regras/calculos".
- **Trade-off aceito:** ao recarregar a pagina, os itens voltam ao default (recolhidos). Justifica-se por simplicidade, compatibilidade total e ausencia de migracao.
- O isolamento por `characterId` evita vazamento de estado entre fichas.

> **Nota:** apenas o **estado de colapso** e efemero. O **nome** (`name`/`slot`/`label`) e todos os dados dos itens continuam **persistidos** normalmente (sem mudanca).

---

## 4. Tratamento dos Campos Extras (CRUD completo)

Objetivo: garantir criar, editar, excluir, persistir e carregar de forma robusta, corrigindo as inconsistencias identificadas na auditoria (`Auditoria_Campos_Extras.md`).

### 4.1 Criar
- **Esperado:** botao "+ Campo" cria `{ id, label:"Novo campo", value:"" }`, com **guarda de permissao** (`canEdit`); item novo inicia **expandido**.
- **Persistencia:** salvo via `saveChar`.

### 4.2 Editar / Renomear
- **Esperado:** editar `label` (renomeia; reflete no cabecalho) e `value` localizando o campo **por `id`** (robusto a reordenacao), nao por indice.
- Sem perda de foco durante digitacao (sem re-render por tecla).

### 4.3 Excluir
- **Esperado:** remover por `id`; a exclusao deve **persistir** (item nao reaparece).
- **Correcao "Almas" (I1):** o campo "Almas" **nao** pode ser reinjetado automaticamente apos exclusao deliberada. "Almas" permanece como default de fichas novas, mas e deletavel. (Implementado: remocao da reinjecao forcada em `applyRaceSubRaceNormalization`.)

### 4.4 Persistir / Carregar
- **Correcao de `id` legado (I2):** todo campo extra deve ter `id`; fichas antigas com entradas sem `id` recebem **backfill** na normalizacao (`normalizeCustomFields`), tornando-as editaveis/removiveis. Aditivo e idempotente.
- **Correcao "Sub-raca" (I3):** o custom field cujo label normaliza para `"sub-raca"` so e removido quando e a **fonte da migracao** (subRace ainda nao resolvido). Um campo legitimamente chamado "Sub-raca" criado pelo usuario **e preservado** quando a sub-raca ja e valida.
- **Migracao:** lazy, aditiva, **sem eager**; nao destrutiva.

### 4.5 Itens menores (fora de escopo desta correcao, registrados)
- Sem reordenacao (drag-and-drop); labels duplicados permitidos; persistencia por sobrescrita de documento. Sao melhorias futuras, nao bloqueiam o CRUD.

---

## 5. Compatibilidade
- Itens de Habilidades/Inventario/Equipamentos ja possuem `id` (via `addListItem`); Campos Extras recebem `id` por backfill. Colapso por item depende de `id` estavel.
- **Sem alteracao de calculos/regras/`excelCalc`**; `armorState`, derivados e progressao intactos.
- **Sem migracao eager** para colapso (efemero) nem para os campos extras (lazy/aditiva).
- Fichas antigas abrem recolhidas, com nome visivel; visual e comportamento mecanico inalterados.

---

## 6. Arquivos afetados (quando implementado)

| Arquivo | Mudanca |
|---|---|
| `app.js` | Estado `expandedItems` + helpers (`itemStateKey`/`isItemExpanded`/`markItemExpanded`/`toggleItem`); util `collapsibleItemCard`; aplicar em `buildItemCard` (Habilidades/Inventario), `buildEquipmentCard` e Campos Extras (`renderGeneral`); `addListItem`/`addCustomField` marcam item novo como expandido; Campos Extras: `addCustomField` com guarda, `updateCustomField` por `id`, `normalizeCustomFields` (backfill de `id`), correcoes I1/I3 na normalizacao de raca/sub-raca. |
| `styles.css` | `.item-collapse-header`, `.item-collapse-toggle`, `.item-card-title` reusando os tokens atuais; reuso de `.card-collapse-*`. |

**Nao alterar:** `excelCalc`, `armorState`, derivados, progressao, `firestore.rules`, modelo persistido (alem do backfill de `id` aditivo).

---

## 7. Riscos
| Risco | Severidade | Mitigacao |
|---|---|---|
| Recolher equipamento parecer "desequipar" | Alta se mal feito | Colapso so visual; `equipped`/`armorType` intactos; cobrir em teste |
| Perda de foco ao renomear | Media | Atualizar cabecalho no proximo render; toggle nunca dispara em `input` |
| Estado de colapso vazar entre fichas | Media | Chave inclui `characterId` |
| Estado perdido ao recarregar | Baixa (aceito) | Decisao de sessao; default recolhido |
| Campo extra legado sem `id` | Baixa | Backfill em `normalizeCustomFields` |
| "Almas" reaparecer apos excluir | Media | Remover reinjecao forcada (I1) |

---

## 8. Testes necessarios

Para **cada** categoria (Habilidades, Inventario, Equipamentos, Campos Extras):
1. Criar → item novo aparece expandido.
2. Renomear → cabecalho reflete o nome (proximo render); sem perda de foco.
3. Expandir/recolher individual → nao afeta os demais; recolhido mostra so o cabecalho.
4. Remover (inclusive pelo cabecalho recolhido) → atualiza a lista.

Transversais:
5. Estado inicial: itens existentes recolhidos; novo expandido.
6. Placeholder `(sem nome)` quando nome vazio.
7. Equipamento recolhido continua contando em C.A./Esquiva/R.D. (cruzar com `Testes_Regressao.md`).
8. Sem regressao de calculo ao recolher/expandir qualquer item.
9. Persistencia: recarregar → dados intactos; colapso volta ao default (sessao).
10. Isolamento por ficha (estado de A preservado ao alternar para B e voltar).
11. Permissoes: sem `canEdit` expande/recolhe (visual), mas nao edita/renomeia/remove.
12. Campos Extras: excluir "Almas" persiste; ficha legada sem `id` fica editavel; campo "Sub-raca" do usuario preservado com sub-raca valida.

---

## 9. Fora de escopo
- Persistir estado de colapso entre sessoes/dispositivos.
- "Recolher tudo / Expandir tudo".
- Reordenacao (drag-and-drop) de itens.
- Qualquer mudanca de calculo, regra, `excelCalc` ou modelo persistido (alem do backfill de `id`).

*Fim da especificacao. Nenhuma alteracao de codigo foi realizada.*
