# Especificacao Tecnica — Sprint UX-1: Expandir/Recolher Secoes

**Data:** 2026-06-04
**Fontes:** `docs/NiarTale_Documento_Continuidade.md`, `docs/Roadmap_Atualizado.md`, codigo `app.js`, `styles.css`
**Natureza:** especificacao. **Nao implementar.**

## Escopo

Adicionar expandir/recolher (minimizar/maximizar) para as secoes:

- Habilidades
- Inventario
- Equipamentos
- Campos Extras
- Notas

## Objetivos

- Reduzir rolagem excessiva em fichas grandes.
- Melhorar uso em fichas com muitos itens.
- Manter a identidade visual atual (retro-pixel).
- **Nao** alterar regras, calculos, permissoes nem persistencia existente.

---

## 1. Principios e restricoes

1. **Sem impacto em `excelCalc`** nem em qualquer derivado. Colapsar e puramente apresentacao.
2. **Sem mudanca de persistencia existente.** O modelo do personagem (Firestore) **nao** ganha campos. O estado expandido/recolhido vive **apenas em memoria de sessao** (objeto de modulo), reaplicado a cada render.
3. **Sem mudanca de permissoes.** Recolher/expandir e disponivel a qualquer um que ja visualiza a secao; nao altera `canEdit`.
4. **Reuso visual.** Reaproveitar o estilo de `content-card`; o cabecalho vira clicavel, sem novo redesign.
5. **Compatibilidade total** com fichas antigas: como nada e persistido, fichas legadas abrem normalmente (default = expandido).

---

## 2. Modelo de estado (efemero)

- Estado mantido em um objeto de modulo `collapsedSections` (chave -> boolean).
- Chave por personagem + secao: `"<characterId>:<sectionKey>"` (ex.: `abc123:inventory`).
  - Evita que o estado de uma ficha vaze para outra ao trocar de personagem.
- Helpers: `isSectionCollapsed(c, key)`, `toggleSection(c, key)` (alterna e chama `render()`).
- Default: **expandido** (ausencia de chave = nao colapsado), preservando o comportamento atual.
- Como o app re-renderiza todo o DOM, o estado **nao** pode viver no DOM; vive no objeto de sessao e e reaplicado a cada `render()`.

> Decisao: estado **de sessao, nao persistido**. Atende ao requisito "nao alterar persistencia existente" e evita migracao. Trade-off aceito: recolhimentos se perdem ao recarregar a pagina.

---

## 3. Componente de UI

`collapsibleCard(c, key, title, children, opts)`:

- Renderiza um `section.panel.content-card.collapsible-card`.
- Cabecalho = `button.card-collapse-header` com `<h3>` (titulo, opcionalmente com contagem `(N)`) e um chevron (`▾` expandido / `▸` recolhido).
- `aria-expanded` reflete o estado (acessibilidade).
- Click no cabecalho chama `toggleSection`.
- Quando recolhido, o corpo (`card-collapse-body`) **nao** e montado no DOM (apenas o cabecalho fica visivel).

CSS reaproveita variaveis existentes; classes novas: `.card-collapse-header`, `.collapse-chevron`, `.card-collapse-body`. Sem alterar a paleta nem a tipografia atuais.

---

## 4. Detalhamento por secao

### 4.1 Habilidades (`key: "abilities"`)
- **Comportamento atual:** lista sempre renderizada por inteiro; em fichas com muitas habilidades, gera rolagem longa.
- **Comportamento esperado:** cabecalho "Habilidades" clicavel; recolhido oculta a lista, mantendo o cabecalho. Contagem opcional `(N)`.
- **Persistencia do estado:** sessao (`<id>:abilities`); nao persistido.
- **Riscos:** baixo. Edicao/adicao de habilidade continua igual ao expandir.

### 4.2 Inventario (`key: "inventory"`)
- **Comportamento atual:** lista completa sempre visivel.
- **Comportamento esperado:** "Inventario (N)" colapsavel; recolhido some a lista e botoes de item.
- **Persistencia do estado:** sessao (`<id>:inventory`).
- **Riscos:** baixo. Garantir que adicionar/remover item reabra/atualize a contagem ao expandir.

### 4.3 Equipamentos (`key: "equipment"`)
- **Comportamento atual:** aba/secao de equipamentos sempre expandida (Sprint 3).
- **Comportamento esperado:** "Equipamentos (N)" colapsavel; recolhido oculta itens, toggles equipar/desequipar e selects de `armorType`.
- **Persistencia do estado:** sessao (`<id>:equipment`).
- **Riscos:** baixo-medio — confirmar que recolher **nao** altera `equipped`/`armorType` (apenas oculta a UI; calculos de C.A./Esquiva/R.D. seguem usando os dados, nao a visibilidade).

### 4.4 Campos Extras (`key: "customFields"`)
- **Comportamento atual:** lista de campos extras sempre visivel, com botao de adicionar.
- **Comportamento esperado:** "Campos extras (N)" colapsavel; recolhido oculta campos e o botao adicionar.
- **Persistencia do estado:** sessao (`<id>:customFields`). Os campos extras em si continuam persistidos normalmente (sem mudanca).
- **Riscos:** baixo. Nao confundir estado de colapso (sessao) com dados de campos extras (persistidos).

### 4.5 Notas (`key: "notes"`)
- **Comportamento atual:** textarea de notas sempre renderizada.
- **Comportamento esperado:** "Notas" colapsavel; recolhido oculta a textarea.
- **Persistencia do estado:** sessao (`<id>:notes`).
- **Riscos:** baixo — ao recolher durante digitacao, garantir que o valor ja foi propagado (o app salva em `change/blur`/`updateChar`); recolher nao deve descartar texto nao salvo. Recomenda-se nao recolher automaticamente.

---

## 5. Arquivos afetados

| Arquivo | Mudanca |
|---|---|
| `app.js` | Objeto `collapsedSections`; helpers `sectionStateKey`/`isSectionCollapsed`/`toggleSection`; util `collapsibleCard`; envolver as 5 secoes (`renderAbilities`, `renderInventory`, `renderEquipment`, campos extras, `renderNotes`) com `collapsibleCard`. |
| `styles.css` | Classes `.card-collapse-header`, `.collapse-chevron`, `.card-collapse-body` reusando a paleta atual. |

**Nao tocar:** `excelCalc`, normalizacoes, `sanitizeCharacterForPersist`, `firestore.rules`, modelo do personagem.

---

## 6. Riscos gerais e mitigacao

| Risco | Severidade | Mitigacao |
|---|---|---|
| Estado de colapso vazar entre personagens | Medio | Chave inclui `characterId` |
| Perda de digitacao ao recolher Notas | Baixo | Recolher manual; valor propagado em `updateChar`; nao auto-colapsar |
| Recolher afetar calculo por engano | Alto se mal feito | Colapso so controla montagem do DOM; dados intactos; `excelCalc` nao consultado para visibilidade |
| Regressao de acessibilidade | Baixo | `aria-expanded` + cabecalho como `button` focavel |
| Estado perdido ao recarregar | Baixo (aceito) | Decisao consciente: sessao, sem persistencia |

---

## 7. Testes necessarios

1. **Toggle por secao:** recolher e expandir cada uma das 5 secoes; cabecalho permanece, corpo aparece/some, chevron alterna.
2. **Isolamento por ficha:** recolher secao na ficha A, abrir ficha B → B inicia expandida; voltar para A → estado de A mantido (na mesma sessao).
3. **Persistencia inalterada:** recolher secoes, recarregar a pagina → dados intactos; secoes voltam expandidas (estado de sessao zera).
4. **Sem impacto em calculo:** recolher Equipamentos com itens equipados → C.A./Esquiva/R.D. inalterados (comparar com `Testes_Regressao.md`).
5. **Notas:** digitar, recolher, expandir → texto preservado.
6. **Campos extras:** criar/editar/excluir com a secao expandida; recolher e expandir → contagem `(N)` correta, dados persistidos.
7. **Permissoes:** usuario sem `canEdit` consegue recolher/expandir (visual), mas continua sem editar conteudo.
8. **Acessibilidade:** foco por teclado no cabecalho; `aria-expanded` correto.

---

## 8. Fora de escopo

- Persistir o estado expandido/recolhido entre sessoes/dispositivos.
- "Recolher tudo / Expandir tudo" global.
- Animacoes de transicao alem do necessario.
- Qualquer mudanca de calculo, regra, permissao ou modelo de dados.

*Fim da especificacao. Nenhuma alteracao de codigo foi realizada.*
