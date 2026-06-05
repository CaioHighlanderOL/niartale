# Relatorio de Implementacao — Sub-raca Boneco Magico

**Data:** 2026-06-05
**Fontes consultadas:** `docs/NiarTale_Documento_Continuidade.md`, `docs/Especificacao_Boneco_Magico.md`, `app.js`
**Alteracoes de codigo nesta sprint:** nenhuma

---

## 1. Conclusao antecipada

A implementacao da sub-raca **Boneco Magico** estava **completa antes desta sprint**. A verificacao linha a linha do codigo confirmou que todos os requisitos da especificacao ja se encontram satisfeitos. Nenhuma linha foi adicionada, removida ou modificada.

---

## 2. Evidencia por criterio

### 2.1 Chave canonica em `SUB_RACE_KEYS`

```64:68:app.js
const SUB_RACE_KEYS = [
  "nenhum", "anfibio", "esqueleto", "elemental", "fantasma",
  "reptil", "alcadethes", "aranha", "flor", "parasita", "variados",
  "boneco magico",
];
```

Chave `"boneco magico"` presente. `resolveSubRaceKey` retorna a chave exata quando ela esta em `SUB_RACE_KEYS`.

### 2.2 Rotulo legivel em `SUB_RACE_LABELS`

```70:75:app.js
const SUB_RACE_LABELS = {
  nenhum: "Nenhum", anfibio: "Anfíbio", esqueleto: "Esqueleto", elemental: "Elemental",
  fantasma: "Fantasma", reptil: "Réptil", alcadethes: "Alcadethes", aranha: "Aranha",
  flor: "Flor", parasita: "Parasita", variados: "Variados",
  "boneco magico": "Boneco Mágico",
};
```

Rotulo `"Boneco Magico"` com acentuacao correta.

### 2.3 Ausencia em `SUB_RACE_SR` — impacto mecanico nulo

```83:91:app.js
const SUB_RACE_SR = {
  anfibio:   { forMod:2, agiMod:2, caBonus1:0, rdFis:6, rdMag:6 },
  alcadethes:{ forMod:6, agiMod:-3, magMod:6, hpBonus:"con", caBonus1:0 },
  reptil:    { forMod:6, caBonus1:2, caBonus2:-6, dodgePen:6, rdFis:22, rdMag:22, suppressForBuf:true },
  esqueleto: { agiMod:5, hpPen:10, caBonus1:0 },
  parasita:  { conMod:-10, agiMod:6, hpPen:10, caBonus1:7, blockPen:5 },
  aranha:    { agiMod:4, caBonus1:0 },
  elemental: { hpZero:true, ppDouble:true },
};
```

`"boneco magico"` ausente. Em `excelCalc`: `const sr = SUB_RACE_SR[subRace] ?? {}` resulta em `{}`, zerando todos os termos de sub-raca. `excelCalc` nao foi alterado.

### 2.4 Exibicao no select de Sub-raca (aba Geral)

```948:952:app.js
    enumField(
      "Sub-raca", resolveSubRaceKey(c.subRace ?? ""), SUB_RACE_KEYS, SUB_RACE_LABELS,
      (v) => updateChar(c, { subRace: v }),
      { refresh: true, disabled: !canEdit(c), noMechanicalKeys: ["fantasma", "flor", "variados", "boneco magico"] }
    ),
```

"Boneco Magico" aparece no select. A opcao esta marcada em `noMechanicalKeys`, indicando que e apenas narrativa (sem bonus mecanico) — consistente com Fantasma, Flor e Variados.

### 2.5 Cabecalho da ficha (HUD)

```1360:1370:app.js
      ...state.characters.map((c) =>
        rowCard([
          node("strong","",c.name),
          node("span","tag",[
            `${c.player} / ${RACE_LABELS[resolveRaceKey(c.race)] || c.race}`,
            resolveSubRaceKey(c.subRace ?? "") !== "nenhum"
              ? ` / ${SUB_RACE_LABELS[resolveSubRaceKey(c.subRace ?? "")]}`
              : "",
            ` / LV ${c.lv}`,
          ].join("")),
```

Quando `c.subRace === "boneco magico"`: exibe ` / Boneco Magico` no rotulo do personagem.

### 2.6 Persistencia e normalizacao

- `updateChar(c, { subRace: v })` → `resolveSubRaceKey("boneco magico")` → retorna `"boneco magico"` (esta em `SUB_RACE_KEYS`) → persiste corretamente.
- `sanitizeCharacterForPersist()` chama `resolveSubRaceKey`; chave reconhecida → sem `_migration.subRaceFrom`.
- `normalizeCharacter()` → `applyRaceSubRaceNormalization()` preserva a chave na carga.
- Nenhum campo novo; `firestore.rules` inalterado.

### 2.7 Migracao de custom legado

Se uma ficha antiga tiver `customFields[].label = "Sub-raca"` e `value = "Boneco Magico"`:
- `resolveSubRaceKey(norm("Boneco Magico"))` → `norm` remove acento → `"boneco magico"` → esta em `SUB_RACE_KEYS` → migra para `subRace`.
- O campo custom e removido (regra I3, `stripSubRaceCustomFields`).
- Migracao **lazy** (ocorre na carga/save); sem eager.

---

## 3. Verificacao de requisitos

| Requisito | Status |
|---|---|
| Compatibilidade total com fichas existentes | ✓ |
| Nenhuma alteracao de formula | ✓ |
| Nenhuma alteracao de calculo (`excelCalc`) | ✓ |
| Nenhuma migracao eager | ✓ |
| Chave canonica `"boneco magico"` em `SUB_RACE_KEYS` | ✓ ja existia |
| Rotulo `"Boneco Magico"` em `SUB_RACE_LABELS` | ✓ ja existia |
| Ausencia em `SUB_RACE_SR` (impacto mecanico nulo) | ✓ ja conforme |
| Exibicao no select de Sub-raca | ✓ ja conforme |
| Exibicao no cabecalho (HUD) | ✓ ja conforme |
| Persistencia como `subRace: "boneco magico"` | ✓ ja conforme |
| Migracao lazy de custom legado | ✓ ja conforme |

---

## 4. Alteracoes realizadas

**Nenhuma.** A sub-raca Boneco Magico ja estava completamente implementada no codigo. Nao foram necessarias adicoes, remocoes ou modificacoes em nenhum arquivo.

---

## 5. Arquivos inspecionados

| Arquivo | Acao |
|---|---|
| `app.js` | Lido e verificado em todos os pontos relevantes |
| `styles.css` | Nao requerido (nenhum estilo especifico de sub-raca) |
| `firestore.rules` | Nao alterado (campo `subRace` ja coberto pelas regras existentes) |

*Fim do relatorio. Nenhuma alteracao de codigo foi realizada.*
