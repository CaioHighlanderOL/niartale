# Auditoria — Sub-raca Boneco Magico

**Data:** 2026-06-05
**Fontes:** `docs/Especificacao_Boneco_Magico.md`, `docs/Relatorio_Implementacao_Boneco_Magico.md`, codigo `app.js`
**Natureza:** auditoria independente. **Nao implementar.**

---

## 1. Exibicao

- **Select (aba Geral):** `enumField("Sub-raca", ...)` (`app.js:948-952`) gera as opcoes a partir de `SUB_RACE_KEYS`/`SUB_RACE_LABELS`. "Boneco Mágico" aparece na lista. **OK.**
- **Tooltip informativo:** a chave esta em `noMechanicalKeys` (`app.js:951`); em `enumField`, isso apenas define `opt.title = "Sem bonus mecanico na planilha atual"` (`app.js:1853-1861`). E puramente informativo, **sem efeito de calculo**. **OK.**
- **Cabecalho/lista de fichas:** `resolveSubRaceKey(c.subRace) !== "nenhum"` exibe ` / Boneco Mágico` via `SUB_RACE_LABELS` (`app.js:1365-1366`). **OK.**

## 2. Persistencia

- Escrita por `updateChar(c, { subRace: v })` (`app.js:950`); `updateChar` resolve via `resolveSubRaceKey` → `"boneco magico"` (chave valida em `SUB_RACE_KEYS`). Persiste como string canonica em `characters/{id}.subRace`.
- `sanitizeCharacterForPersist()` mantem a chave reconhecida; nao gera `_migration.subRaceFrom`.
- `normalizeCharacter()` → `applyRaceSubRaceNormalization()` preserva a chave na carga.
- Sem campo novo no documento; `firestore.rules` inalterado. **OK.**

## 3. Compatibilidade

- **Fichas novas:** default `subRace:"nenhum"`; Boneco Magico selecionavel a qualquer momento.
- **Fichas antigas sem `subRace`:** `normalizeCharacter` injeta `"nenhum"` (lazy); inalteradas ate edicao.
- **Custom legado `Sub-raca = "Boneco Mágico"`:** `resolveSubRaceKey(norm("Boneco Mágico"))` → `"boneco magico"` (esta em `SUB_RACE_KEYS`) → migra para `subRace`; custom removido (regra I3). Migracao **lazy**, sem eager. **OK.**

## 4. Ausencia de efeitos mecanicos inesperados

Confirmado diretamente em `excelCalc` (`app.js:1620`):

```1620:1620:app.js
  const sr = SUB_RACE_SR[subRace] ?? {};
```

Como `"boneco magico"` **nao** existe em `SUB_RACE_SR` (`app.js:83-91`), `sr = {}`. Todos os termos de sub-raca usam `?? 0`/`?? false`:

| Derivado | Termo de sub-raca | Resultado |
|---|---|---|
| `mods.for/con/agi/mag` | `sr.forMod/conMod/agiMod/magMod ?? 0`, `sr.suppressForBuf` | neutro |
| `mods.int` | nao usa sub-raca | neutro |
| `hpMax` | `sr.hpZero`/`sr.hpPen ?? 0`/`sr.hpBonus` | neutro |
| `ppMax` | `sr.ppDouble` | neutro |
| `ca` | `sr.caBonus1/caBonus2 ?? 0` | neutro |
| `dodge` | `sr.dodgePen ?? 0` | neutro |
| `block` | `sr.blockPen ?? 0` | neutro |
| `physicalReduction`/`magicReduction` | `sr.rdFis/rdMag ?? 0` | neutro |

`excelCalc` **nao foi alterado**. Progressao (`exp`/`xp`/`lv`/`nvl`/`Aplicados`) nao depende de sub-raca. Selecionar/desselecionar Boneco Magico nao altera nenhum valor derivado. **OK.**

---

## 5. Achados classificados

### Criticos
- Nenhum.

### Importantes
- Nenhum.

### Menores
- **M1 — Sub-raca sem regra na planilha original.** Boneco Magico e adicao do sistema (nao existe na planilha). E decisao de produto ja documentada; mesmo padrao de Fantasma/Flor/Variados. Nao e defeito.
- **M2 — Neutralidade depende de manter a chave fora de `SUB_RACE_SR`.** Se no futuro alguem adicionar a chave em `SUB_RACE_SR`, passa a ter efeito. Risco apenas para evolucao futura; estado atual correto. Recomendacao: manter o comentario/registro de que a chave e intencionalmente neutra.

---

## 6. Conformidade com requisitos

| Requisito | Status |
|---|---|
| Exibicao (select + cabecalho) | ✓ |
| Persistencia (`subRace:"boneco magico"`) | ✓ |
| Compatibilidade (lazy, sem eager) | ✓ |
| Ausencia de efeitos mecanicos | ✓ |
| `excelCalc` inalterado | ✓ |
| `firestore.rules` inalterado | ✓ |

---

## 7. Conclusao

A sub-raca Boneco Magico esta exibida, persiste corretamente, e totalmente compativel com fichas existentes e e mecanicamente neutra por construcao (chave ausente em `SUB_RACE_SR`; `excelCalc` intocado). Nenhum achado Critico ou Importante; apenas Menores informativos.

## GO

Sub-raca Boneco Magico aprovada para producao.

*Fim da auditoria. Nenhuma alteracao de codigo foi realizada.*
