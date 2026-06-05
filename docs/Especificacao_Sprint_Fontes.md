# Especificacao Tecnica — Sprint Personalizacao de Fontes

**Data:** 2026-06-05
**Fontes:** `docs/NiarTale_Documento_Continuidade.md`, codigo `app.js`, `styles.css`
**Natureza:** especificacao. **Nao implementar.**

**Objetivo:** permitir que cada ficha use uma fonte visual propria, sem qualquer impacto mecanico.

**Escopo (5 opcoes):** Padrao, Serif, Fantasia, Manuscrita, **Medieval**.

> Esta spec amplia `Especificacao_Sprint_Personalizacao.md` (4 fontes) adicionando **Medieval** e detalhando o carregamento de fonte web (necessario para o estilo medieval).

---

## 0. Principio de desenho (reuso do padrao de Tema)

A fonte segue o mesmo mecanismo das cores do tema:

- O tema vive em `c.theme` e e aplicado por `applyTheme(c)` setando variaveis CSS em `el.body` (`app.js:1701`).
- A fonte sera um campo de `theme` (`theme.font`) aplicado por uma **nova variavel CSS** `--char-font`, mapeada para um *font stack* em `styles.css`.

Isso garante persistencia, defaults e compatibilidade "de graca" (`theme` ja e mesclado com `base.theme` em `normalizeCharacter`).

> **Identidade visual:** HUD, titulos, rotulos e numeros derivados usam `--pixel` (monospace) e **continuam** usando `--pixel`. A fonte personalizada (`--char-font`) aplica-se apenas ao **conteudo textual** da ficha (paragrafos, valores de campos, nome/notas/itens/historia), nunca aos numeros mecanicos.

---

## 1. Modelo de dados e chaves

```js
theme: {
  type, angle, colors,
  font: "padrao" | "serif" | "fantasia" | "manuscrita" | "medieval"  // novo; default "padrao"
}
```

Constantes (analogas a `SUB_RACE_KEYS`/`LABELS`):

```text
FONT_KEYS   = ["padrao", "serif", "fantasia", "manuscrita", "medieval"]
FONT_LABELS = { padrao:"Padrao", serif:"Serif", fantasia:"Fantasia", manuscrita:"Manuscrita", medieval:"Medieval" }
```

Mapeamento para *font stacks*:

| Chave | Variavel | Font stack | Requer fonte web? |
|---|---|---|---|
| `padrao` | `--font-padrao` | `var(--sans)` (atual) | Nao |
| `serif` | `--font-serif` | `Georgia, "Times New Roman", serif` | Nao |
| `fantasia` | `--font-fantasia` | `"Papyrus", "Luminari", fantasy` | Nao |
| `manuscrita` | `--font-manuscrita` | `"Segoe Script", "Bradley Hand", "Comic Sans MS", cursive` | Nao |
| `medieval` | `--font-medieval` | `"<FonteMedievalWeb>", "UnifrakturCook", "Old English Text MT", "Blackletter686", serif` | **Sim (recomendado)** |

`--char-font` recebe o stack da chave selecionada; default `padrao`.

> **Nota Medieval:** nao existe **familia generica** medieval em CSS (so `serif/sans-serif/cursive/fantasy/monospace`). Sem fonte web, o resultado depende de fontes do SO (`Old English Text MT` no Windows, raramente em outros), com fallback final `serif`. Para fidelidade consistente, Medieval **deve** carregar uma fonte web (ver §2.2).

---

## 2. Carregamento da fonte

### 2.1 Fontes sem rede (Padrao/Serif/Fantasia/Manuscrita)
- Usam stacks do sistema + familias genericas → **zero custo de rede**, troca instantanea via `--char-font`, sem FOUT/FOIT.
- Trade-off: aparencia de Fantasia/Manuscrita varia por SO. Aceitavel.

### 2.2 Fonte web (Medieval) — carregamento sob demanda
- Self-hospedar **1** fonte medieval `.woff2` (ex.: UnifrakturCook/UnifrakturMaguntia, subset Latin) no projeto (sem CDN externo, mantendo o padrao "sem build").
- `@font-face` com **`font-display: swap`** (texto aparece no fallback `serif` e troca quando a fonte carrega — evita texto invisivel).
- **Lazy/sob demanda:** carregar a fonte medieval **apenas quando** a ficha selecionar `font="medieval"`, nao no boot. Estrategias possiveis:
  - injetar um `<link rel="preload" as="font">`/`<style>` de `@font-face` apenas ao aplicar a fonte; ou
  - declarar `@font-face` no CSS (a fonte so e baixada pelo browser quando algum elemento a usa — comportamento nativo de `font-display: swap`).
- Fallback garantido: enquanto carrega/se falhar, usa `serif`. Offline → render normal no fallback.

### 2.3 Regra geral
- Toda chave termina em uma **familia generica** (`sans-serif`/`serif`/`fantasy`/`cursive`), garantindo render mesmo offline ou se a fonte web falhar.
- Nenhuma fonte deve **bloquear** a renderizacao da ficha.

---

## 3. Persistencia por ficha

- Persistido em `c.theme.font` (chave de `FONT_KEYS`).
- **Sem colecao/campo novo de topo**: subcampo de `theme`, ja persistido por `saveChar`/`updateDoc`.
- Defaults/compatibilidade:
  - `defaultTheme()` inclui `font: "padrao"`.
  - `normalizeCharacter` ja faz `theme: { ...base.theme, ...data.theme }` → fichas antigas sem `font` herdam `"padrao"` (**migracao lazy, aditiva, sem eager**).
  - `updateTheme(c, { font })` valida a chave (cai em `"padrao"` se desconhecida) e reaplica via `applyTheme`.
- `sanitizeCharacterForPersist`: garantir `theme.font` ∈ `FONT_KEYS` (senao `"padrao"`).
- `firestore.rules`: **inalterado**.

---

## 4. Impacto visual

- `applyTheme(c)` seta `el.body.style.setProperty("--char-font", fontStackFor(c.theme.font))`.
- Em `styles.css`, seletores de **conteudo** da ficha usam `font-family: var(--char-font)`: valores de campos, `textarea`, paragrafos de notas/historia, descricoes/observacoes de itens/habilidades e o titulo do card de item.
- **Nao alterar** seletores `--pixel` (HUD, labels, numeros derivados, botoes/titulos).
- Medieval tende a reduzir legibilidade em textos longos; por isso fica restrita ao conteudo e nunca a numeros.

---

## 5. Acessibilidade

- **Padrao** permanece o default, com stack legivel (`--sans`).
- **Fantasia/Manuscrita/Medieval** reduzem legibilidade; recomendacoes:
  - **Nao** aplicar a fonte decorativa a numeros, rotulos ou HUD (mantidos em monospace).
  - Manter tamanhos minimos e contraste atuais (a fonte nao altera cores).
  - Escolha **opt-in por ficha** e facilmente reversivel (voltar a "Padrao").
  - Tooltip no seletor avisando que fontes decorativas (em especial Medieval) podem reduzir legibilidade.
  - `font-display: swap` evita periodo de texto invisivel para a fonte web.
- Sem impacto em navegacao por teclado ou leitores de tela (apenas `font-family`).

---

## 6. Compatibilidade

- Fichas antigas abrem com `font="padrao"` (default herdado) — **visual identico ao atual**.
- Sem migracao eager; sem mudanca de modelo de topo; `firestore.rules` inalterado.
- Chave desconhecida/legada → resolve para `"padrao"` (degrada com seguranca).
- Aditivo e reversivel.

---

## 7. Arquivos afetados (quando implementado)

| Arquivo | Mudanca |
|---|---|
| `app.js` | `FONT_KEYS`/`FONT_LABELS` (5 chaves); `defaultTheme().font="padrao"`; `updateTheme` validar `font`; `applyTheme` setar `--char-font`; `sanitizeCharacterForPersist` validar `theme.font`; `enumField` "Fonte" em `renderThemeEditor`. |
| `styles.css` | Variaveis `--font-*` e `--char-font`; `@font-face` medieval (`font-display: swap`); aplicar `var(--char-font)` nos seletores de **conteudo** (sem tocar nos `--pixel`). |
| assets | 1 arquivo `.woff2` medieval self-hospedado (subset Latin). |

**Nao alterar:** `excelCalc`, `armorState`, derivados, progressao, permissoes, `firestore.rules`.

---

## 8. UI de selecao

- No card **Tema** (`renderThemeEditor`, visivel a quem pode editar), adicionar `enumField` "Fonte" com `FONT_KEYS`/`FONT_LABELS`, `refresh:true`, chamando `updateTheme(c, { font: v })`.
- Pre-visualizacao opcional aplicando a fonte a um texto de exemplo.

---

## 9. Riscos

| Risco | Severidade | Mitigacao |
|---|---|---|
| Medieval sem familia generica → inconsistente entre SOs | Media | Self-host de `.woff2` + `font-display: swap`; fallback `serif` |
| Peso/latencia da fonte web medieval | Baixa | Subset Latin; carregamento sob demanda; nao bloquear render |
| Fonte decorativa em numeros/HUD prejudicar leitura | Media | Restringir `--char-font` ao conteudo |
| Dado legado/corrompido em `theme.font` | Baixa | Resolver para `"padrao"` |

---

## 10. Testes necessarios

1. **Selecao:** trocar entre as 5 fontes altera o conteudo; HUD/numeros permanecem monospace.
2. **Persistencia:** escolher fonte, salvar, recarregar → `theme.font` mantido e reaplicado.
3. **Compatibilidade:** ficha antiga sem `theme.font` abre como "Padrao" (visual identico).
4. **Reversibilidade:** voltar para "Padrao" restaura o visual original.
5. **Medieval — carregamento:** ao selecionar Medieval, a fonte web carrega (swap) e aplica; antes/da falha, usa fallback `serif`.
6. **Offline:** sem rede, todas renderizam via fallback (Medieval cai em `serif`/fonte do SO).
7. **Sem regressao mecanica:** nenhum derivado/calculo muda ao trocar de fonte (cruzar com `Testes_Regressao.md`).
8. **Permissoes:** apenas quem tem `canEdit` altera a fonte; demais visualizam.
9. **Dado invalido:** `theme.font="xyz"` resolve para "Padrao".

---

## 11. Fora de escopo

- Tamanho/peso/espacamento de fonte por ficha (apenas familia nesta sprint).
- Upload de fontes pelo usuario.
- CDNs externos de fonte (manter self-host, sem build).
- Qualquer alteracao de calculo, regra ou permissao.

*Fim da especificacao. Nenhuma alteracao de codigo foi realizada.*
