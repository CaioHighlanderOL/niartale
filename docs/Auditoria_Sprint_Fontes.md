# Auditoria — Sprint Fontes: Personalizacao de Fonte por Ficha

**Data:** 2026-06-05
**Fontes:** `docs/Especificacao_Sprint_Fontes.md`, `docs/Relatorio_Implementacao_Sprint_Fontes.md`, codigo `app.js`, `styles.css`
**Natureza:** auditoria independente. **Nao implementar.**

---

## 1. Selecao de fonte

- `enumField("Fonte", ...)` em `renderThemeEditor` (`app.js:1008-1013`) com `FONT_KEYS`/`FONT_LABELS` (5 opcoes: Padrao, Serif, Fantasia, Manuscrita, Medieval), `refresh:true`, `disabled: !canEdit(c)`.
- Ao alterar, chama `updateTheme(c, { font })` → `updateChar` + `render` → `applyTheme` reaplica `--char-font`.
- Valor exibido resolve para `"padrao"` se a chave atual for invalida. **OK.**

## 2. Persistencia

- `theme.font` e subcampo de `theme`, persistido por `saveChar`/`updateDoc` como o restante do tema. Sem campo novo de topo.
- `defaultTheme()` inclui `font:"padrao"` (`app.js:344`) → fichas novas nascem com Padrao.
- `sanitizeCharacterForPersist` (`app.js:264`) normaliza `theme.font` invalido para `"padrao"` antes de persistir. **OK.**

## 3. Fallback

- `fontStackFor(key)` retorna stack com **familia generica** ao final (`serif`/`fantasy`/`cursive`/`sans-serif`); chave desconhecida → `var(--sans)` (`app.js:52`).
- `applyTheme` valida `FONT_KEYS.includes(t.font)` antes de aplicar (`app.js:1735-1736`).
- `--char-font` tem default `var(--sans)` em `:root` (`styles.css:32`) — visual atual garantido mesmo antes de `applyTheme`.
- **Medieval:** stack `"MedievalSharp"/"UnifrakturCook"/"Old English Text MT"/serif`; sem a fonte no SO, cai em `serif`. Sem arquivo `.woff2` self-hosted nesta fase (Fase 2 opcional, conforme spec). **OK** (fallback seguro).

## 4. Compatibilidade

- `normalizeCharacter` faz `theme: { ...base.theme, ...data.theme }` → fichas antigas sem `font` herdam `"padrao"`; visual identico ao atual.
- Chave corrompida → resolvida para `"padrao"` em 3 pontos (UI, `applyTheme`, `sanitize`).
- Sem migracao eager; `firestore.rules` inalterado. **OK.**

## 5. Ausencia de regressoes

### 5.1 Calculos / `excelCalc`
- Nenhuma alteracao em `excelCalc`, `armorState`, derivados ou progressao. A fonte e exclusivamente apresentacao (variavel CSS). **Sem regressao.**

### 5.2 Identidade visual / HUD
- `--char-font` aplicado apenas a `.field input`, `.field textarea`, `textarea`, `.item-card-title`, `.card-collapse-header h3` (`styles.css:692-698`).
- Os ~18 seletores `--pixel` (HUD, labels, `attribute-score`, titulos, botoes) permanecem intactos. Numeros derivados (`metricCard` → `strong`) nao estao nos seletores de `--char-font` (herdam `--sans`). **Sem regressao** de identidade.

### 5.3 Permissoes
- Seletor de Fonte com `disabled: !canEdit(c)`; o card Tema ja e visivel so a quem edita. `updateTheme`→`updateChar` tem guarda `canEdit`. **Sem regressao.**

### 5.4 Persistencia
- Sanitizacao aditiva; nenhum campo removido; nenhum efeito sobre outros campos do `theme`. **Sem regressao.**

Sem erros de lint.

---

## 6. Achados classificados

### Criticos
- Nenhum.

### Importantes
- Nenhum.

### Menores
- **M1 — Medieval sem `.woff2` self-hosted.** Em SOs sem a fonte, renderiza em `serif` (inconsistencia entre maquinas). Conforme a spec (Fase 2 opcional). Impacto: estetico, baixo.
- **M2 — Inputs numericos herdam `--char-font`.** `.field input` inclui inputs `type=number` (ex.: valor de atributo, buffs). Com fontes decorativas, numeros editaveis mudam de fonte. Nao afeta calculo nem os **derivados** (que usam `--pixel`); apenas o campo de entrada. Impacto: cosmetico, baixo. Mitigacao opcional futura: excluir `input[type=number]` do seletor.
- **M3 — Fonte nao persiste estado entre dispositivos offline antes do 1o save.** Comportamento normal de qualquer campo; nao especifico de fontes.

---

## 7. Conformidade com requisitos

| Requisito | Status |
|---|---|
| Fonte selecionavel na UI | ✓ |
| Persistencia por ficha | ✓ |
| Fallback seguro | ✓ |
| Compatibilidade com fichas antigas | ✓ |
| Sem alteracao em calculos ou regras | ✓ |
| Sem erros de lint | ✓ |

---

## 8. Conclusao

Selecao, persistencia, fallback e compatibilidade funcionam; a fonte e puramente apresentacao e nao toca `excelCalc`, derivados nem permissoes; HUD/numeros derivados permanecem em `--pixel`. Nenhum achado Critico ou Importante; apenas Menores (M1 Medieval sem self-host, M2 inputs numericos com `--char-font`), aceitos ou de baixo impacto.

## GO

A Sprint Fontes esta aprovada para producao.

*Fim da auditoria. Nenhuma alteracao de codigo foi realizada.*
