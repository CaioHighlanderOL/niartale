# Especificacao — Sub-raca "Boneco Magico"

**Data:** 2026-06-05
**Fontes:** `docs/NiarTale_Documento_Continuidade.md`, `docs/Planilha Original.xlsx`, codigo `app.js`
**Tipo:** especificacao tecnica (sem implementacao neste documento)

---

## 1. Objetivo

Formalizar a sub-raca **Boneco Magico** como opcao selecionavel na ficha, mantendo-a **mecanicamente neutra**. E uma adicao do sistema NiarTale, **nao existente na planilha original** (a planilha lista em G8: Anfibio, Esqueleto, Elemental, Fantasma, Reptil, Alcadethes, Aranha, Flor, Parasita, Variados — sem "Boneco Magico").

Por ser adicao do sistema sem regra de planilha, **nao recebe** bonus/penalidades mecanicas.

---

## 2. Restricoes (obrigatorias)

Esta sub-raca **NAO** pode:

- criar atributos novos (`attributes` inalterado);
- criar modificadores novos (`mods.*` inalterado);
- criar formulas novas;
- alterar `excelCalc` (nenhuma linha);
- alterar progressao (`exp`, `xp`, `lv`, `nvl`, `Aplicados`).

Consequencia direta: **nenhuma entrada em `SUB_RACE_SR`**. `excelCalc` consulta `SUB_RACE_SR[subRace] ?? {}`; com a chave ausente, o resultado e `{}` e nenhum derivado muda. E exatamente o mesmo padrao ja adotado para **Fantasma**, **Flor** e **Variados**.

---

## 3. Estado atual no codigo

A chave **ja existe** como rotulo/opcao, sem regra mecanica:

```64:75:app.js
const SUB_RACE_KEYS = [
  "nenhum", "anfibio", "esqueleto", "elemental", "fantasma",
  "reptil", "alcadethes", "aranha", "flor", "parasita", "variados",
  "boneco magico",
];
const RACE_LABELS = { humano: "Humano", monstro: "Monstro", nenhum: "Nenhum" };
const SUB_RACE_LABELS = {
  nenhum: "Nenhum", anfibio: "Anfíbio", esqueleto: "Esqueleto", elemental: "Elemental",
  fantasma: "Fantasma", reptil: "Réptil", alcadethes: "Alcadethes", aranha: "Aranha",
  flor: "Flor", parasita: "Parasita", variados: "Variados",
  "boneco magico": "Boneco Mágico",
};
```

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

`"boneco magico"` **nao** aparece em `SUB_RACE_SR` — comportamento desejado e ja conforme a especificacao.

**Conclusao:** do ponto de vista de codigo, a sub-raca ja esta corretamente formalizada. Esta especificacao documenta e valida esse estado; **nenhuma alteracao de codigo e necessaria**.

---

## 4. Onde sera exibida

| Local | Comportamento |
|---|---|
| Aba **Geral** → card da ficha → `enumField` "Sub-raca" (`app.js:949`) | Aparece como opcao **"Boneco Mágico"** na lista, derivada de `SUB_RACE_KEYS`/`SUB_RACE_LABELS`. Selecionavel por quem tem `canEdit`. |
| **HUD / cabecalho da ficha** (`app.js:1365-1366`) | Quando selecionada, exibe ` / Boneco Mágico` apos a raca, via `SUB_RACE_LABELS[resolveSubRaceKey(c.subRace)]`. |

Nenhum novo componente de UI e criado. Reusa o mesmo `selectField`/`enumField` das demais sub-racas.

---

## 5. Persistencia

- Persistida em `characters/{id}.subRace` com a **chave canonica** `"boneco magico"` (string).
- Escrita por `updateChar(c, { subRace: v })` no `enumField`; `updateChar` normaliza via `resolveSubRaceKey` (`app.js:1455`).
- `sanitizeCharacterForPersist()` mantem a chave (valida em `SUB_RACE_KEYS`); nao ha `_migration.subRaceFrom` porque a entrada e reconhecida.
- `normalizeCharacter()` → `applyRaceSubRaceNormalization()` resolve e preserva a chave na carga.
- Nenhum campo novo no documento; nenhuma mudanca em `firestore.rules`.

---

## 6. Compatibilidade

- **Fichas novas:** padrao `subRace: "nenhum"`; usuario pode escolher Boneco Magico a qualquer momento.
- **Fichas antigas sem `subRace`:** `normalizeCharacter` injeta `"nenhum"` (migracao lazy); inalteradas ate edicao manual.
- **Custom field legado "Sub-raca" = "Boneco Magico":** `resolveSubRaceKey` normaliza ("Boneco Mágico" → `norm` → `"boneco magico"`), entao a migracao mapeia corretamente para `subRace` e o custom legado e removido (regra I3 preservada).
- **Selecionar e depois reabrir:** valor persiste e reidrata sem perda.
- Sem impacto sobre Habilidades/Inventario/Equipamentos/Pericias.

---

## 7. Impacto mecanico

**Nulo.** Verificado contra os derivados de `excelCalc`:

| Derivado | Efeito de Boneco Magico |
|---|---|
| `mods.for / con / agi / int / mag` | nenhum |
| `hpMax` / `ppMax` | nenhum |
| `ca` / `dodge` / `block` / `initiative` / `pa` | nenhum |
| `physicalReduction` / `magicReduction` | nenhum |
| Pericias (`skillBonus`) | nenhum |
| Progressao (`exp`/`xp`/`lv`/`nvl`/`Aplicados`) | nenhum |

Justificativa: `excelCalc` le `const sr = SUB_RACE_SR[subRace] ?? {}` (`app.js:1620`). Como `"boneco magico"` nao esta em `SUB_RACE_SR`, `sr = {}` e todos os termos de sub-raca ficam neutros. A raca (`c.race`) continua governando HP/PP base normalmente, independentemente da sub-raca.

---

## 8. Lore / uso pretendido (informativo, sem efeito de regra)

Boneco Magico e uma sub-raca de caracterizacao (narrativa/estetica). Qualquer particularidade de mesa fica a cargo do Mestre e dos campos textuais existentes (Historia, Notas, Habilidades, Campos extras), **sem** traducao em bonus automatico.

---

## 9. Criterios de aceitacao

1. "Boneco Mágico" aparece no select de Sub-raca (aba Geral). ✓ (ja conforme)
2. Selecao persiste como `subRace: "boneco magico"` e reidrata. ✓
3. Cabecalho da ficha exibe ` / Boneco Mágico`. ✓
4. Nenhum derivado de `excelCalc` muda ao alternar para/da sub-raca. ✓
5. `SUB_RACE_SR` permanece sem a chave; `excelCalc` inalterado. ✓
6. Migracao de custom legado "Sub-raca: Boneco Magico" mapeia para `subRace`. ✓

---

## 10. Plano de verificacao (sem alterar codigo)

- Criar/abrir ficha, escolher "Boneco Mágico", salvar e recarregar → valor mantido.
- Comparar painel de derivados com `subRace = "nenhum"` mantendo atributos/raca → valores identicos.
- Importar ficha legada com custom `Sub-raca = Boneco Magico` → migra para `subRace` e remove o custom.

---

## 11. Conclusao

A sub-raca **Boneco Magico** ja esta formalizada no sistema como opcao selecionavel, persistente e **mecanicamente neutra**, respeitando integralmente as restricoes (sem novos atributos, modificadores, formulas, sem tocar `excelCalc` nem a progressao). **Nenhuma implementacao adicional e necessaria**; este documento serve como especificacao e registro de validacao.

*Documento de especificacao. Nenhuma alteracao de codigo foi realizada.*
