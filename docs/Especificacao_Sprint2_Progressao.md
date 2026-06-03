# Especificação Técnica — Sprint 2 (Progressão)

**Data:** 2026-06-03
**Base:** `docs/Plano_Paridade_Planilha.md` (Sprint 2), `docs/Relatorio_Paridade_Ficha_Planilha.md`, `docs/NiarTale_Documento_Continuidade.md`
**Fonte canônica:** `docs/Planilha Original.xlsx` (aba `Ficha`)
**Natureza:** especificação. **Nenhum código deve ser implementado nesta etapa.**

Escopo desta sprint: **EXP**, **XP**, **Aplicados**, **NVL**.

---

## 0. Resumo e células de origem (conferidas no XLSX)

| Campo | Célula rótulo | Célula valor | Fórmula na planilha | Natureza |
|---|---|---|---|---|
| EXP | `E13` ("E.X.P") | `F13` | — (entrada manual) | número manual |
| Aplicados | `G13` ("Aplicados") | `H13` | `SUM(F15:F24)` | derivado (read-only) |
| XP | `E14` ("XP") | `F14` | — (entrada manual) | número manual |
| LVL/NVL | `G14` ("LVL/NVL") | `H14` | — (texto `"0/0"`, manual) | par atual/máximo manual |

Observações importantes da planilha:
- `H13 = SUM(F15:F24)` soma o intervalo onde ficam os **valores dos 5 atributos** (`F15`=FOR, `F17`=CON, `F19`=AGI, `F21`=INT, `F23`=MAG; linhas pares vazias). Ou seja, **Aplicados = soma dos valores brutos de atributo**.
- `H14` é um texto no formato `atual/máximo` (não há fórmula). No app, o "atual" já existe como `c.lv`; falta o "máximo" (`nvl`).
- `F13` (EXP) e `F14` (XP) são números livres, sem fórmula — preenchidos manualmente.

---

## 1. Campo: EXP

### 1.1 Origem na planilha
- `E13` = rótulo "E.X.P"; valor em `F13` (numérico, sem fórmula).
- Representa a experiência total/acumulada do personagem.

### 1.2 Regras de cálculo
- **Sem cálculo derivado.** É um valor manual.
- Normalização recomendada: `Number(v) || 0`, sem clamp superior; permitir `>= 0` (sugerido) para evitar negativos acidentais.
- **Não** alimenta `excelCalc` nem qualquer derivado. Apenas informativo nesta sprint.

### 1.3 Persistência
- Novo campo escalar no documento da ficha: `exp: number` (default `0`).
- Fluxo padrão já existente: `updateChar(c, { exp })` → `scheduleCharSave` → `sanitizeCharacterForPersist` → `saveChar` (`updateDoc`).
- Sem alteração em `firestore.rules` (campo dentro do doc da própria ficha).

### 1.4 Impacto na ficha
- UI sugerida: aba **Geral** (card "Informacoes") ou aba **Atributos** (novo card "Progressao").
- Recomendação: novo card **"Progressao"** em `renderStats` para manter Geral enxuto e agrupar EXP/XP/Aplicados/NVL.
- Sem impacto em HUD, cálculos, permissões ou em outras abas.

### 1.5 Compatibilidade com fichas existentes
- Fichas antigas não possuem `exp`. Deve ser tratado como `0` na leitura.
- Aditivo: nenhum campo existente é alterado ou removido.

### 1.6 Estratégia de migração
- **Lazy (preferencial):** `normalizeCharacter()` injeta `exp: data.exp ?? 0`. O campo passa a ser persistido no próximo `saveChar` natural.
- **Sem migração eager dedicada.** Não há necessidade de batch; o valor default é seguro e idempotente.

---

## 2. Campo: XP

### 2.1 Origem na planilha
- `E14` = rótulo "XP"; valor em `F14` (numérico, sem fórmula).
- Distinto de EXP: interpretado como XP corrente/disponível (não acumulado).

### 2.2 Regras de cálculo
- **Sem cálculo derivado.** Valor manual.
- Normalização: `Number(v) || 0`, sugerido `>= 0`.
- Não alimenta `excelCalc`.

> Nota de modelagem: a planilha mantém EXP (`F13`) e XP (`F14`) como campos separados e independentes. Esta especificação preserva essa separação **sem** inferir relação automática entre eles (ex.: XP = EXP − gasto), pois não há fórmula que sustente isso na planilha.

### 2.3 Persistência
- Novo campo escalar: `xp: number` (default `0`).
- Mesmo fluxo de persistência do EXP.

### 2.4 Impacto na ficha
- UI no mesmo card "Progressao".
- Sem impacto em cálculos/HUD/permissões.

### 2.5 Compatibilidade com fichas existentes
- Aditivo. Fichas antigas leem `xp` como `0`.

### 2.6 Estratégia de migração
- Lazy via `normalizeCharacter()` (`xp: data.xp ?? 0`). Sem eager.

---

## 3. Campo: Aplicados (derivado)

### 3.1 Origem na planilha
- `G13` = rótulo "Aplicados"; valor em `H13 = SUM(F15:F24)`.
- `F15:F24` cobre os valores brutos dos 5 atributos (`FOR/CON/AGI/INT/MAG`).

### 3.2 Regras de cálculo
- **Derivado, read-only.** Definição:

```
Aplicados = attributes.for.value
          + attributes.con.value
          + attributes.agi.value
          + attributes.int.value
          + attributes.mag.value
```

- Implementação sugerida: novo helper puro, ex. `appliedPoints(c)`, somando `Number(c.attributes[k]?.value || 0)` para `k ∈ {for,con,agi,int,mag}`.
- **Não** deve ser persistido como valor próprio (é função dos atributos). Calcular na renderização, como já se faz com derivados de `excelCalc`.
- **MVP sem validação de orçamento:** apenas exibir. **Não** bloquear/limitar `attributes` com base em EXP/XP nesta sprint (evita travar fichas legadas fora de orçamento).

### 3.3 Persistência
- **Nenhuma.** Campo calculado em tempo de render; não entra no documento Firestore.
- Caso se opte por exibir junto de `excelCalc`, pode ser incorporado ao retorno de `excelCalc` **ou** mantido como helper isolado. Recomendação: **helper isolado** (`appliedPoints`) para não inflar `excelCalc` nem arriscar os derivados de combate já validados.

### 3.4 Impacto na ficha
- UI: métrica read-only no card "Progressao" (ex.: `metricCard("APLICADOS", appliedPoints(c))`).
- Sem impacto em HUD, permissões ou em `excelCalc` (se mantido como helper separado).

### 3.5 Compatibilidade com fichas existentes
- Total. Depende apenas de `attributes`, que já existe e é normalizado.
- Fichas antigas exibem o valor correto imediatamente, sem migração.

### 3.6 Estratégia de migração
- **Não aplicável** (campo derivado, não persistido).

---

## 4. Campo: NVL (par LVL/NVL)

### 4.1 Origem na planilha
- `G14` = rótulo "LVL/NVL"; valor em `H14` = texto `"atual/máximo"` (ex.: `"0/0"`), manual.
- "LVL" (atual) já corresponde a `c.lv`. "NVL" (máximo/alvo) é o que falta.

### 4.2 Regras de cálculo
- **Sem cálculo derivado** nesta sprint. `nvl` é manual.
- `lv` permanece com a **mesma semântica atual** (nível atual exibido na HUD e na lista do Mestre). **Não redefinir `lv`.**
- `lv` e `nvl` representam informações distintas e devem ser editáveis de forma independente.
- Normalização: `nvl: Number(v) || 0` (ou `|| lv` se preferir default coerente); sugerido `>= 0`.
- Regra de consistência opcional (não obrigatória no MVP): se `nvl > 0 && nvl < lv`, apenas sinalizar visualmente; **não** alterar `lv` automaticamente.

### 4.3 Persistência
- Novo campo escalar: `nvl: number` (default `0`).
- Mesmo fluxo padrão de persistência.
- `lv` continua persistido como hoje (inalterado).

### 4.4 Impacto na ficha
- UI no card "Progressao": editar `lv` (**Level**) e `nvl` (**Nivel**) de forma independente.
- **HUD:** opcional exibir `lv/nvl` em `hudStat("LV", ...)`. Recomendação MVP: manter HUD mostrando apenas `lv` para não alterar identidade/contagem visual; exibir o par somente no card de Progressao.
- Lista do Mestre (`renderMaster`) usa `LV ${c.lv}` — manter como está (sem regressão).

### 4.5 Compatibilidade com fichas existentes
- Aditivo. `nvl` ausente → `0`.
- `lv` não muda de tipo nem de semântica → nenhuma regressão em HUD/listagem.

### 4.6 Estratégia de migração
- Lazy via `normalizeCharacter()` (`nvl: data.nvl ?? 0`). Sem eager.
- Opcional (não recomendado no MVP): inicializar `nvl = lv` em migração eager. Evitar, pois adiciona escrita em massa sem ganho funcional.

---

## 5. Mudanças de modelo propostas (sem implementar)

### 5.1 `defaultCharacter()`
Adicionar três campos escalares (Aplicados **não** entra, pois é derivado):

```js
// novos campos
exp: 0,
xp: 0,
nvl: 0,
```

### 5.2 `normalizeCharacter()`
Garantir defaults na leitura (retrocompatibilidade):

```js
exp: Number(data.exp ?? base.exp) || 0,
xp:  Number(data.xp  ?? base.xp)  || 0,
nvl: Number(data.nvl ?? base.nvl) || 0,
```

### 5.3 `sanitizeCharacterForPersist()`
Normalizar antes de gravar (coerência e clamp `>= 0`):

```js
c.exp = Math.max(0, Number(c.exp || 0));
c.xp  = Math.max(0, Number(c.xp  || 0));
c.nvl = Math.max(0, Number(c.nvl || 0));
```

### 5.4 Helper derivado (Aplicados)

```js
function appliedPoints(c) {
  return ["for","con","agi","int","mag"]
    .reduce((sum, k) => sum + Number(c.attributes?.[k]?.value || 0), 0);
}
```

### 5.5 UI (sugestão de baixo risco)
- Novo card **"Progressao"** em `renderStats(c)`:
  - `field("LEVEL", c.lv, ...)` (number)
  - `field("NIVEL", c.nvl, ...)` (number)
  - `field("EXP", c.exp, ...)` (number)
  - `field("XP", c.xp, ...)` (number)
  - `metricCard("APLICADOS", appliedPoints(c))` (read-only)
- Usar `updateChar`/`updateNested` + `{ type:"number", refresh:true }`, padrão já presente.

---

## 6. Impacto em `excelCalc` e derivados

- **Nenhum.** EXP, XP e NVL não entram em nenhum cálculo de `excelCalc`.
- Aplicados é função apenas de `attributes`, calculado fora de `excelCalc` (helper isolado), sem alterar HP/PP/C.A/INI/ESQ/BLOQ/P.A/R.D.
- Recomendação reforçada: **não** introduzir validação de orçamento de pontos nesta sprint (manter `attributes` livre, como hoje).

---

## 7. Compatibilidade retroativa — visão consolidada

| Aspecto | Efeito |
|---|---|
| Formato persistido | Aditivo (`exp`, `xp`, `nvl`); nada removido. |
| Fichas antigas | Leem defaults `0`; persistem no próximo save natural. |
| `lv` | Inalterado (semântica e uso na HUD/lista preservados). |
| `excelCalc` | Sem mudança. |
| `firestore.rules` | Sem mudança. |
| Identidade visual | Preservada (somente novos campos no padrão existente). |

---

## 8. Estratégia de migração — visão consolidada

- **Lazy (padrão):** defaults injetados em `normalizeCharacter()`; consolidação no Firestore acontece no próximo `saveChar`.
- **Eager:** **não necessária.** Diferente de raça/sub-raça, não há reinterpretação de dados legados; defaults `0` são seguros e idempotentes.
- **Idempotência:** reaplicar normalização não altera valores já válidos.
- **Rollback:** trivial — como os campos são aditivos e não afetam cálculo, remover a UI/campos não corrompe fichas (valores ficam inertes).

---

## 9. Riscos e mitigação

| Risco | Nível | Mitigação |
|---|---|---|
| Tentação de validar orçamento (Aplicados vs EXP/XP) e travar fichas legadas | Médio | Manter Aplicados read-only no MVP; sem bloqueio. |
| Alterar semântica de `lv` ao introduzir par `lv/nvl` | Médio | Adicionar `nvl` separado; não tocar `lv` nem HUD/lista. |
| Persistir Aplicados como campo (dessincroniza de `attributes`) | Baixo | Mantê-lo derivado; nunca gravar. |
| Inflar `excelCalc` com progressão | Baixo | Usar helper isolado `appliedPoints`. |

---

## 10. Critérios de aceite (para a futura implementação)

1. EXP, XP e NVL editáveis, persistidos e recarregados corretamente.
2. Aplicados exibido como `SUM(FOR,CON,AGI,INT,MAG)` e atualizado ao mudar atributos.
3. `lv` inalterado na HUD e na lista do Mestre.
4. Fichas antigas (sem os novos campos) abrem, exibem `0` e salvam sem erro.
5. `excelCalc` e derivados de combate inalterados (sem regressão).
6. Sem alteração de identidade visual e sem mudança em `firestore.rules`.

*Fim da especificação. Nenhuma alteração de código foi realizada.*
