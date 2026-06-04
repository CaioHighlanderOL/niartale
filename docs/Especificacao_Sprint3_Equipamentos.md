# Especificação Técnica — Sprint 3: Equipamentos e Armadura

**Data:** 2026-06-03
**Fontes:** `docs/NiarTale_Documento_Continuidade.md`, `docs/Planilha Original.xlsx` (aba `Ficha`), `docs/Auditoria_Paridade_UI_Planilha.md`
**Escopo:** (1) Interface de Equipamentos; (2) Equipar/Desequipar itens; (3) Tipo de Armadura explícito (Leve/Média/Pesada).
**Natureza:** especificação. **Não implementar.**

> Objetivo central: fechar a lacuna **Crítica C1** da auditoria de UI — hoje o usuário não tem como controlar o tipo de armadura pela ficha, porque (a) não existe aba/tela de Equipamentos e (b) o tipo é apenas inferido pelo texto do nome de um item equipado.

---

## 0. Contexto técnico atual (linha de base)

### 0.1 Modelo de dados
`defaultCharacter()` (`app.js`) define:

```js
equipment: [
  { id, slot:"Arma",     name:"Faca cega",      equipped:true, notes:"" },
  { id, slot:"Armadura", name:"Casaco listrado", equipped:true, notes:"" },
]
```

### 0.2 Resolução de armadura (única consumidora de `equipment` nos cálculos)
```js
function armorState(c) {
  const eq = c.equipment.filter((e) => e.equipped).map((e) => norm(`${e.slot} ${e.name}`));
  return {
    light:  eq.some((e) => e.includes("leve")),
    medium: eq.some((e) => e.includes("media") || e.includes("medio")),
    heavy:  eq.some((e) => e.includes("pesada") || e.includes("pesado")),
  };
}
```

### 0.3 Consumo em `excelCalc()`
```js
const armor = armorState(c);
const armorCA       = (armor.light?2:0) - (armor.medium?3:0) - (armor.heavy?6:0);
const armorDodgePen = (armor.medium?3:0) + (armor.heavy?6:0);
const armorRD       = (armor.light?5:0) + (armor.medium?10:0) + (armor.heavy?20:0);
// ...
const ca    = 10 + mods.agi + armorCA + (sr.caBonus1 ?? 0) + (sr.caBonus2 ?? 0);
const dodge = initiative - armorDodgePen - (sr.dodgePen ?? 0);
const physicalReduction = Math.round(armorRD + hateRD + (sr.rdFis ?? 0) + Number(buf.physicalReduction||0));
```

### 0.4 Fatos relevantes
- **Não existe UI** para `equipment`: `SHEET_TABS` vai de `inventory` direto a `notes`. O usuário não vê, não adiciona, não edita, não equipa.
- A ficha **default** vem com "Casaco listrado" equipado, mas o nome **não** contém `leve/media/pesada` → hoje contribui **zero** de armadura. Ou seja, o efeito de armadura é praticamente inalcançável na prática.
- `armorState` é a **única** ponte entre `equipment` e os cálculos. Nenhum outro derivado lê `equipment`.
- Persistência atual: `normalizeCharacter()` faz `equipment: data.equipment ?? base.equipment`; não há normalização por item nem em `sanitizeCharacterForPersist()`.

### 0.5 Equivalência na planilha
| Planilha | Significado | Efeito |
|---|---|---|
| `R21` | Armadura Leve | C.A. +2, R.D. Física +5 |
| `R23` | Armadura Média | C.A. -3, Esquiva -3, R.D. Física +10 |
| `R25` | Armadura Pesada | C.A. -6, Esquiva -6, R.D. Física +20 |

São marcações **independentes** (somáveis). A implementação atual de `excelCalc` já reflete exatamente esses valores e o caráter somável — **isto não deve mudar**.

---

## 1. Decisão de modelo (fundamental para as 3 funcionalidades)

**Recomendado — tipo explícito por item (`armorType`)**, integrado à interface de equipamentos:

- Cada item de `equipment` ganha um campo `armorType ∈ {"", "leve", "media", "pesada"}`.
- `armorState(c)` passa a resolver, para cada item **equipado**:
  1. se `armorType` estiver preenchido → usa o tipo explícito;
  2. senão → **fallback** para a inferência atual por nome (compatibilidade retroativa).
- A agregação continua **somável** entre itens equipados (preserva a semântica da planilha e do `excelCalc`).

Por que esta abordagem:
- Satisfaz as três funcionalidades de forma coesa (a tela de equipamentos é onde se define o tipo).
- **Mantém `excelCalc` intocado** — só muda a *resolução* dentro de `armorState`.
- Elimina o erro silencioso da inferência por nome, sem quebrar fichas antigas (fallback).

> Alternativa considerada e **não** recomendada: campo único de ficha `c.armorType` (um só tipo ativo). Mais simples, porém perde a natureza somável da planilha (R21/R23/R25 independentes) e desacopla o tipo do item equipado, criando duas fontes de verdade. Registrada apenas como alternativa.

---

## 2. Funcionalidade A — Interface de Equipamentos

### Comportamento atual
- Não há aba nem card de equipamentos. `equipment` existe no modelo, é persistido, mas é invisível e ineditável pela UI.

### Comportamento esperado
- Nova seção/aba "Equipamentos" (ou card dentro de Inventário) listando os itens de `equipment`.
- Por item: editar `slot`, `name`, `notes`; selecionar `armorType`; alternar `equipped`; remover item; e botão "＋ Equipamento" para adicionar.
- Reaproveitar os utilitários existentes (`buildStableListEditor`/`field`/`checkField`/`selectField`/`addListItem`/`removeListItem`) para não recriar inputs durante digitação.
- Respeitar permissões: edição apenas para `canEdit(c)`; botões de adicionar/remover marcados `data-master-only` quando aplicável, no mesmo padrão das demais abas.
- Sem redesign visual: mesma linguagem dos cards atuais.

### Persistência
- `equipment` já é persistido. Adicionar `normalizeEquipment()` para garantir, por item, a forma `{ id, slot, name, equipped:Boolean, notes, armorType }` com defaults.
- Chamar a normalização em `normalizeCharacter()` (carga) e em `sanitizeCharacterForPersist()` (save), espelhando o padrão de `combat`/`exp/xp/nvl`.

### Migração
- **Lazy e aditiva.** Fichas antigas sem `armorType` recebem `armorType:""` na carga; `equipped` ausente vira `false` (ou preserva o valor existente). Nenhuma migração eager necessária.
- Item legado sem `id` recebe `uid("eq")`.

### Impacto em C.A. / Esquiva / R.D.
- **Nenhum por si só** — apenas tornar a lista visível/editável não altera cálculo. O impacto vem da Funcionalidade C (tipo) e B (equipado/não).

### Arquivos afetados
- `app.js`: nova `renderEquipment()` (ou card); entrada em `SHEET_TABS` e no dispatch `renderTab()`; `normalizeEquipment()`; ajustes em `normalizeCharacter()` e `sanitizeCharacterForPersist()`.
- `styles.css`: somente se necessário reaproveitar classes existentes (preferir não criar novas).
- `docs/NiarTale_Documento_Continuidade.md`: documentar a nova aba e o campo `armorType`.

### Riscos de regressão
- Baixo. Adicionar uma aba não toca em cálculo. Risco principal: foco/refresh durante digitação (mitigado por `renderIfSafe`/`buildStableListEditor`).

### Testes necessários
- Abrir ficha legada: aba aparece com itens existentes intactos.
- Adicionar/editar/remover item persiste após reload.
- Player só edita as próprias fichas; Mestre edita todas; botões restritos ocultos para player.
- Digitação contínua sem perda de foco.

---

## 3. Funcionalidade B — Equipar / Desequipar itens

### Comportamento atual
- `equipped` existe no modelo e é lido por `armorState`, mas **não há controle** para alterná-lo. O valor só muda editando o dado cru no Firestore.

### Comportamento esperado
- Toggle (`checkField`) "Equipado" por item, com `refresh:true` para recalcular derivados imediatamente.
- Desequipar um item de armadura remove sua contribuição de C.A./Esquiva/R.D.; equipar adiciona.
- Itens não-armadura (Arma, etc.) podem ter `equipped` sem efeito mecânico (apenas organizacional), preservando o comportamento atual.

### Persistência
- Coberta por `normalizeEquipment()` (`equipped` coagido para `Boolean`). Salvamento via fluxo padrão `updateArrayItem`/`scheduleCharSave`.

### Migração
- Lazy. `equipped` ausente → `false`. **Atenção:** a ficha default atual traz itens com `equipped:true`; preservar valores existentes para não desequipar itens já marcados.

### Impacto em C.A. / Esquiva / R.D.
- **Direto**, via `armorState`:
  - Equipar armadura **Leve** → C.A. +2, R.D. Física +5.
  - Equipar armadura **Média** → C.A. -3, Esquiva -3, R.D. Física +10.
  - Equipar armadura **Pesada** → C.A. -6, Esquiva -6, R.D. Física +20.
  - Desequipar → remove a respectiva contribuição.
- R.D. Mágica **não** é afetada por armadura (apenas HATE/sub-raça/buff) — manter assim.

### Arquivos afetados
- `app.js`: toggle na `renderEquipment()`; nenhuma alteração em `excelCalc` nem em `armorState` (já lê `equipped`).

### Riscos de regressão
- Médio-baixo. O ponto sensível é o `refresh` recalcular C.A./Esquiva/R.D. enquanto o usuário digita em outro campo — usar o mesmo padrão de `refresh` já adotado em Buffs/Condições.
- Cascata conhecida: `mods.agi` → C.A./INI/Esquiva. Equipar armadura **não** mexe em `mods.agi`, mas mexe em C.A./Esquiva via `armorCA`/`armorDodgePen`; validar os três juntos.

### Testes necessários
- Equipar/desequipar Leve/Média/Pesada e conferir C.A., Esquiva e R.D. Física contra a tabela acima.
- Conferir interação com sub-raças que mexem em C.A./Esquiva (Réptil `caBonus1/caBonus2`/`dodgePen`, Parasita) — valores devem **somar**, não substituir.
- Reload mantém estado equipado.

---

## 4. Funcionalidade C — Tipo de Armadura explícito (Leve/Média/Pesada)

### Comportamento atual
- Tipo **inferido** por substring (`leve`/`media`/`medio`/`pesada`/`pesado`) no `slot name` de itens equipados. Sem palavra-chave → nenhuma armadura, **silenciosamente**.

### Comportamento esperado
- `selectField` "Tipo de armadura" por item com opções: Nenhuma / Leve / Média / Pesada → grava `armorType`.
- `armorState` resolve por item: `armorType` explícito tem **prioridade**; fallback para inferência por nome só quando `armorType === ""` (compatibilidade).
- Agregação somável entre itens equipados (preserva planilha): `light = algum item equipado resolve "leve"`, idem `medium`/`heavy`.
- **Evitar dupla contagem:** quando `armorType` estiver setado, o nome do item **não** é mais avaliado para aquele item.

### Persistência
- `armorType` incluído em `normalizeEquipment()` com default `""`; valores válidos restritos ao enum (qualquer outro → `""`).

### Migração
- Lazy/aditiva. Fichas antigas: `armorType:""` → mantêm exatamente o comportamento atual (inferência por nome). Zero mudança de resultado para quem não mexer no novo campo.

### Impacto em C.A. / Esquiva / R.D.
- Idêntico ao da Funcionalidade B, agora **determinístico** (não depende de o nome conter a palavra certa).
- `excelCalc` **não muda**: `armorCA`, `armorDodgePen`, `armorRD` continuam com os mesmos coeficientes (2/-3/-6; 3/6; 5/10/20). Só a *origem* de `armor.light/medium/heavy` fica explícita.

### Arquivos afetados
- `app.js`: alterar **apenas** `armorState()` (resolução por tipo com fallback) + `normalizeEquipment()`; UI do select em `renderEquipment()`.
- `docs/NiarTale_Documento_Continuidade.md` (seção 7.9 e 8.6) e `docs/Auditoria_Paridade_UI_Planilha.md` (marcar C1/V3 endereçados).

### Riscos de regressão
- **Principal:** alterar `armorState` pode mudar C.A./Esquiva/R.D. de fichas existentes se o fallback por nome for removido. **Mitigação obrigatória:** manter o fallback enquanto `armorType` vazio.
- Risco de dupla contagem se um item tiver `armorType:"leve"` **e** nome contendo "leve" — resolução por prioridade (tipo vence, ignora nome) elimina isso.
- Coerção do enum: entradas inválidas devem cair em `""` (sem efeito), não quebrar o cálculo.

### Testes necessários
- Ficha legada com item "Armadura leve" equipado e `armorType:""` → mantém C.A. +2 / R.D. +5 (fallback).
- Mesmo item após setar `armorType:"leve"` → resultado idêntico (sem dobrar).
- Trocar tipo Leve→Pesada reflete imediatamente em C.A./Esquiva/R.D.
- Dois itens de armadura equipados (ex.: Leve + Média) → efeitos somam, conforme planilha.
- `armorType` inválido salvo manualmente no Firestore → tratado como `""`.

---

## 5. Resumo de alterações de código previstas

| Área | Mudança | Toca cálculo? |
|---|---|---|
| `SHEET_TABS` + `renderTab()` | nova aba "Equipamentos" | Não |
| `renderEquipment()` (nova) | listar/adicionar/editar/remover, toggle equipado, select de tipo | Não |
| `normalizeEquipment()` (nova) | normaliza item `{id,slot,name,equipped,notes,armorType}` | Não |
| `normalizeCharacter()` | chamar `normalizeEquipment()` | Não |
| `sanitizeCharacterForPersist()` | chamar `normalizeEquipment()` | Não |
| `armorState()` | resolver por `armorType` com fallback por nome | **Sim (indireto)** |
| `excelCalc()` | **nenhuma** | Não |
| `firestore.rules` | **nenhuma** (owner/master já podem atualizar) | — |
| docs | continuidade + auditoria | — |

---

## 6. Estratégia de migração consolidada

- **Tipo:** lazy + aditiva (mesmo padrão de `combat` e `exp/xp/nvl`).
- **Sem migração eager**, sem flag em `users/{uid}`.
- **Garantia de não-regressão:** com `armorType` default `""`, todas as fichas existentes produzem os mesmos C.A./Esquiva/R.D. até que alguém edite o novo campo.
- `firestore.rules` inalterado.

---

## 7. Critérios de aceite (GO da Sprint 3)

1. Usuário vê e gerencia equipamentos pela ficha (adicionar/editar/remover).
2. Usuário equipa/desequipa itens com reflexo imediato e correto em C.A./Esquiva/R.D.
3. Usuário define tipo de armadura explicitamente (Leve/Média/Pesada), sem depender do nome.
4. Fichas antigas abrem sem alteração de resultados de cálculo (fallback ativo).
5. `excelCalc` não foi alterado; coeficientes da planilha preservados.
6. Persistência e permissões (player/mestre) corretas; sem perda de foco em digitação.

---

## 8. Fora de escopo (Sprint 3)

- I1 (R.D. adicional editável), I2 (Condição Atual), I3 (HATE/HOPE %), I4 (bônus de perícia com atributo base), V1 (Theme Song), V2 (CASH no HUD). Tratados em sprint posterior.
- Decisão sobre EN/Energia (mantida para Sprint 4).

*Fim da especificação. Nenhuma alteração de código foi realizada.*
