# Relatorio de Correcao — Level vs Nivel

**Data:** 2026-06-03  
**Contexto:** ajuste de UX da Sprint 2 para remover ambiguidade entre campos de nivel.

---

## Problema reportado

- O visor `LV/NVL` (somente leitura) induzia a percepcao de que **Nivel** nao era editavel.
- O usuario identificava apenas um campo de nivel claramente editavel (Level/LV), gerando confusao.

---

## Regra de negocio aplicada

- **Level (`lv`)** e **Nivel (`nvl`)** representam informacoes diferentes.
- Ambos devem ser editaveis de forma independente.
- Nenhum dos dois influencia calculos mecanicos da ficha.

---

## Causa raiz

- O card de Progressao continha um `metricCard(\"LV/NVL\", ...)` (read-only).
- Como o metric card exibe o par consolidado, parte dos usuarios interpretava o componente como o proprio campo de Nivel.
- Resultado: ambiguidade entre exibicao (read-only) e edicao (input).

---

## Correcao aplicada

### 1) UI da aba Atributos > card Progressao (`app.js`)

- Removido o visor read-only `LV/NVL`.
- Adicionados dois campos editaveis e explicitos:
  - `LEVEL` (mapeado para `lv`)
  - `NIVEL` (mapeado para `nvl`)
- Mantidos os campos `EXP` e `XP`.
- Mantido `APLICADOS` como metrica derivada read-only.

### 2) Documentacao atualizada

- `docs/Especificacao_Sprint2_Progressao.md`:
  - explicita que `lv` e `nvl` sao independentes e editaveis;
  - remove recomendacao de visor `LV/NVL` no card de Progressao.
- `docs/NiarTale_Documento_Continuidade.md`:
  - registra a regra de negocio e a remocao do visor ambiguo.

---

## Garantias de nao-regressao (requisitos)

### Nao alterar calculos

- `excelCalc()` nao foi alterado.
- `lv` e `nvl` continuam fora de qualquer formula mecanica.

### Nao alterar persistencia

- Estrutura persistida inalterada: `lv` e `nvl` ja existiam e continuam sendo gravados pelo fluxo normal (`updateChar` + `saveChar`).

### Nao alterar migracao

- Nao houve mudanca em `normalizeCharacter`/estrategia lazy de migracao para Sprint 2.

### Nao alterar identidade visual

- Nenhum CSS novo ou redesign.
- Ajuste restrito a substituicao de um card read-only por dois `field(...)` no mesmo padrao visual ja existente.

---

## Resultado

- Interface agora comunica claramente que **Level** e **Nivel** sao campos distintos e editaveis.
- Ambiguidade de UX eliminada sem impacto em calculos, persistencia, migracao ou permissao.
