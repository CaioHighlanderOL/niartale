# Relatório de Implementação — Sprint 4: Exposição de Bônus de Redução de Dano

**Data:** 2026-06-03
**Escopo entregue:** exposição na UI de `buffs.physicalReduction` e `buffs.magicReduction` como campos editáveis `RD FIS` e `RD MAG`.
**Base:** `docs/Especificacao_Sprint4_RD.md` (item I1 da auditoria de UI).

---

## 1. Arquivos alterados

### `app.js`
| Região | Mudança |
|---|---|
| `renderStats()` — card "Buffs" | A grade passou a incluir dois campos explícitos após os 7 buffs existentes: `field("RD FIS", c.buffs.physicalReduction, …)` e `field("RD MAG", c.buffs.magicReduction, …)`, ambos `type:"number"` + `refresh:true`, gravando via `updateNested(c, ["buffs","physicalReduction"|"magicReduction"], Number(v||0))`. |

Trecho implementado:

```980:988:app.js
    card("Buffs", [
      node("div", "grid three", [
        ...["for","agi","int","mag","con","hp","pp"].map((k) =>
          field(k.toUpperCase(), c.buffs[k], (v) => updateNested(c, ["buffs",k], Number(v||0)), { type:"number", refresh:true })
        ),
        field("RD FIS", c.buffs.physicalReduction, (v) => updateNested(c, ["buffs","physicalReduction"], Number(v||0)), { type:"number", refresh:true }),
        field("RD MAG", c.buffs.magicReduction, (v) => updateNested(c, ["buffs","magicReduction"], Number(v||0)), { type:"number", refresh:true }),
      ]),
    ]),
```

### `docs/NiarTale_Documento_Continuidade.md`
- Data/escopo atualizados para Sprint 4.
- Seção 7.5 (Buffs): nota de que `physicalReduction`/`magicReduction` são editáveis como `RD FIS`/`RD MAG`.

### `docs/Auditoria_Paridade_UI_Planilha.md`
- Item I1 marcado como endereçado.

### `docs/Relatorio_Implementacao_Sprint4_RD.md`
- Este relatório.

> `excelCalc()`, fórmulas de R.D./C.A./Esquiva, modelo de dados, normalização e persistência: **não alterados**.

---

## 2. Estratégia utilizada

- **Exposição pura:** os campos já existiam no modelo (`defaultCharacter`), na normalização (merge de `buffs`) e no cálculo (`excelCalc` L1534-1535). A sprint apenas **adicionou os dois inputs** que faltavam.
- **Rótulos legíveis:** em vez de estender o `map` (que usa `k.toUpperCase()` e exibiria `PHYSICALREDUCTION`/`MAGICREDUCTION`), os dois campos foram adicionados como `field(...)` explícitos com rótulos `RD FIS` e `RD MAG`, conforme solicitado. Os 7 buffs originais permanecem inalterados.
- **Mesma mecânica dos demais buffs:** `type:"number"`, `refresh:true` (recalcula `R.FIS`/`R.MAG` no painel Calculados imediatamente) e gravação via `updateNested`, idêntico aos buffs já existentes — sem novidade visual.

---

## 3. Conformidade com os requisitos

| Requisito | Status |
|---|---|
| Não alterar `excelCalc` | ✓ Intocado (já consumia os campos) |
| Não alterar fórmulas | ✓ R.FIS/R.MAG/C.A./Esquiva inalteradas |
| Não alterar persistência | ✓ Merge de `buffs` e `updateNested` já existentes |
| Não alterar identidade visual | ✓ Reuso de `field`/`card`/`grid three` |
| Utilizar rótulos legíveis | ✓ `RD FIS` / `RD MAG` |
| Evitar `PHYSICALREDUCTION`/`MAGICREDUCTION` | ✓ Não exibidos (campos explícitos, fora do `map`) |

---

## 4. Migração e compatibilidade

- **Sem migração eager.** Fichas antigas: `normalizeCharacter()` faz `buffs: { ...base.buffs, ...(data.buffs||{}) }`, garantindo `physicalReduction:0`/`magicReduction:0` por default.
- Comportamento idêntico ao anterior até o usuário editar os campos; `R.FIS`/`R.MAG` permanecem com o mesmo valor para quem não mexer.
- `firestore.rules` inalterado.

---

## 5. Testes recomendados

1. **Presença:** aba Atributos → card Buffs exibe `RD FIS` e `RD MAG` editáveis (rótulos corretos, sem `PHYSICALREDUCTION`/`MAGICREDUCTION`).
2. **R.D. Física:** definir `RD FIS = 5` aumenta `R.FIS` (painel Calculados) em 5, somado a armadura/HATE/sub-raça.
3. **R.D. Mágica:** definir `RD MAG = 3` aumenta `R.MAG` em 3.
4. **Independência de armadura:** equipar armadura altera `R.FIS` mas **não** `R.MAG` (R.D. Mágica não recebe `armorRD`).
5. **Persistência:** recarregar a ficha preserva os valores.
6. **Compatibilidade:** ficha antiga (sem os campos) abre com `0` e R.FIS/R.MAG inalterados.
7. **Permissão:** player edita só as próprias fichas; campos desabilitados sem permissão (comportamento padrão de `field`).
8. **Foco/refresh:** edição numérica recalcula sem quebrar a digitação (mesmo padrão dos demais buffs).

---

## 6. Riscos remanescentes

| Risco | Severidade | Observação |
|---|---|---|
| Confusão entre buff de entrada e valor final | Baixo | `RD FIS`/`RD MAG` (buffs, editáveis) vs `R.FIS`/`R.MAG` (Calculados, read-only). Rótulos distintos mitigam; documentado. |
| Escopo parcial vs planilha | Informativo | Expõe o **bônus somado** (`Y15`/`Y16`), não a tabela Tipo/Quantidade (`W14/X14`). Intencional, fora do escopo. |
| Valores negativos | Baixo | `field` aceita números negativos; coerção `Number(v||0)`. Se indesejado, clamp futuro em `sanitizeCharacterForPersist` (não exigido aqui). |

*Implementação concluída. Lints: sem erros.*
