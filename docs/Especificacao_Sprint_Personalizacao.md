# Especificacao Tecnica — Sprint Personalizacao: Fonte Visual por Ficha

**Data:** 2026-06-05
**Fontes:** `docs/NiarTale_Documento_Continuidade.md`, codigo `app.js`, `styles.css`
**Natureza:** especificacao. **Nao implementar.**

**Objetivo:** permitir que cada ficha utilize uma fonte visual personalizada, escolhida pelo usuario, sem qualquer impacto mecanico.

**Escopo inicial (4 opcoes):**
- Fonte Padrao
- Fonte Serif
- Fonte Fantasia
- Fonte Manuscrita

---

## 0. Principio de desenho (reuso do padrao de Tema)

A personalizacao de fonte deve seguir **exatamente** o mecanismo ja usado para cores do tema:

- O tema vive em `c.theme` e e aplicado por `applyTheme(c)` setando variaveis CSS em `el.body` (`--char-c1`, `--char-gradient`, etc., `app.js:1701`).
- A fonte sera **mais um campo de `theme`** (`theme.font`) e sera aplicada por uma **nova variavel CSS** `--char-font`, mapeada para um *font stack* em `styles.css`.

Isso garante persistencia, defaults e compatibilidade "de graca" (o objeto `theme` ja e mesclado com `base.theme` em `normalizeCharacter`).

> **Importante (identidade visual):** a HUD, titulos, rotulos e numeros derivados usam `--pixel` (monospace) e **devem continuar usando** `--pixel`. A fonte personalizada (`--char-font`) aplica-se ao **conteudo textual da ficha** (paragrafos, valores de campos, nome/notas/itens/historia), nunca aos numeros mecanicos criticos — preserva legibilidade e identidade retro.

---

## 1. Modelo de dados e chaves

Novo campo em `theme`:

```js
theme: {
  type, angle, colors,
  font: "padrao" | "serif" | "fantasia" | "manuscrita"  // novo; default "padrao"
}
```

Constantes (analogas a `SUB_RACE_KEYS`/`LABELS`):

```text
FONT_KEYS   = ["padrao", "serif", "fantasia", "manuscrita"]
FONT_LABELS = { padrao:"Padrao", serif:"Serif", fantasia:"Fantasia", manuscrita:"Manuscrita" }
```

Mapeamento para *font stacks* (em `:root`/CSS, sem rede no escopo inicial):

| Chave | Variavel | Font stack sugerido (web-safe) |
|---|---|---|
| `padrao` | `--font-padrao` | `var(--sans)` (atual) |
| `serif` | `--font-serif` | `Georgia, "Times New Roman", serif` |
| `fantasia` | `--font-fantasia` | `"Papyrus", "Luminari", fantasy` |
| `manuscrita` | `--font-manuscrita` | `"Segoe Script", "Bradley Hand", "Comic Sans MS", cursive` |

`--char-font` recebe o stack da chave selecionada; default `padrao`.

---

## 2. Persistencia por ficha

- Persistido em `c.theme.font` (string com chave de `FONT_KEYS`).
- **Nenhuma colecao/campo novo de topo**: e subcampo de `theme`, ja persistido por `saveChar`/`updateDoc`.
- Defaults e compatibilidade:
  - `defaultTheme()` passa a incluir `font: "padrao"`.
  - `normalizeCharacter` ja faz `theme: { ...base.theme, ...data.theme }` → fichas antigas sem `font` herdam `"padrao"` automaticamente (**migracao lazy, aditiva, sem eager**).
  - `updateTheme(c, { font })` valida a chave (cai em `"padrao"` se desconhecida) e reaplica via `applyTheme`.
- `sanitizeCharacterForPersist`: garantir `theme.font` ∈ `FONT_KEYS` (senao `"padrao"`).
- `firestore.rules`: **inalterado** (subcampo de documento ja permitido ao owner/Mestre).

---

## 3. Aplicacao e impacto visual

- `applyTheme(c)` passa a setar `el.body.style.setProperty("--char-font", fontStackFor(c.theme.font))`.
- Em `styles.css`, os seletores de **conteudo da ficha** (ex.: valores de campos, `textarea`, paragrafos de notas/historia, titulos de item de card) usam `font-family: var(--char-font)`.
- **Nao alterar** os seletores que usam `--pixel` (HUD, labels, numeros derivados, botoes/titulos) — eles permanecem monospace.
- Resultado: a personalizacao muda a "voz" textual da ficha (ex.: Serif para tom classico, Manuscrita para tom de diario), mantendo a moldura retro-pixel.
- Escopo visual recomendado para `--char-font`: corpo de campos de texto livre, notas, historia, descricoes/observacoes de itens/habilidades e o titulo do card de item. Fora: numeros, rotulos e HUD.

---

## 4. Compatibilidade

- Fichas antigas: abrem com `font="padrao"` (default herdado) — **visual identico ao atual**.
- Sem migracao eager; sem mudanca de modelo de topo; sem mudanca de `firestore.rules`.
- Chave desconhecida (dado corrompido/legado) → resolve para `"padrao"` (degrada com seguranca).
- Aditivo e reversivel: voltar para "Padrao" restaura o visual original.

---

## 5. Acessibilidade

- **Padrao permanece o default** e usa stack legivel (`--sans`).
- Fontes **Fantasia** e **Manuscrita** reduzem legibilidade; recomendacoes:
  - **Nao** aplicar a fonte decorativa a numeros mecanicos, rotulos ou HUD (mantidos em monospace legivel).
  - Manter tamanhos minimos atuais e contraste (a fonte nao altera cores nem `color-scheme`).
  - A escolha e **opt-in por ficha** e facilmente reversivel.
  - Considerar nota/tooltip no seletor indicando que fontes decorativas podem reduzir legibilidade.
- Sem impacto em navegacao por teclado ou leitores de tela (apenas `font-family`).

---

## 6. Performance

- **Escopo inicial = zero custo de rede:** todos os stacks usam fontes do sistema/web-safe + familias genericas (`serif`, `fantasy`, `cursive`). Sem download, sem FOUT/FOIT, sem bloqueio de render.
- Trade-off: a aparencia de Fantasia/Manuscrita varia por SO (fontes do sistema diferentes). Aceitavel no escopo inicial.
- **Evolucao futura (fora do escopo inicial):** se for desejada fidelidade consistente, self-hospedar `.woff2` (subset Latin) com:
  - `font-display: swap` (evita texto invisivel);
  - `<link rel="preload">` **apenas** da fonte efetivamente selecionada;
  - carregamento sob demanda (lazy) ao escolher a fonte, nao no boot.
  - Isso adiciona custo de rede/peso e deve ser decisao explicita posterior.

---

## 7. Estrategia de carregamento de fontes

1. **Fase 1 (esta sprint):** apenas *font stacks* do sistema em CSS. Troca instantanea via variavel `--char-font`. Nenhum recurso externo.
2. **Fase 2 (opcional, futura):** self-host de 1 fonte por categoria decorativa (`woff2` subset), com `font-display: swap`, `preload` condicional e fallback para a generica equivalente enquanto carrega. Nunca bloquear a ficha; FOUT aceitavel.
3. Em qualquer fase, o fallback final de cada stack e uma familia generica (`serif`/`fantasy`/`cursive`/`sans-serif`), garantindo render mesmo offline.

---

## 8. Arquivos afetados (quando implementado)

| Arquivo | Mudanca |
|---|---|
| `app.js` | `FONT_KEYS`/`FONT_LABELS`; `defaultTheme().font="padrao"`; `updateTheme` validar `font`; `applyTheme` setar `--char-font`; `sanitizeCharacterForPersist` validar `theme.font`; `enumField` "Fonte" no editor de Tema (`renderThemeEditor`). |
| `styles.css` | Variaveis `--font-*` e `--char-font`; aplicar `var(--char-font)` nos seletores de **conteudo** da ficha (sem tocar nos `--pixel`). |

**Nao alterar:** `excelCalc`, `armorState`, derivados, progressao, `firestore.rules`, qualquer regra/calculo.

---

## 9. UI de selecao

- No card **Tema** (`renderThemeEditor`, visivel a quem pode editar), adicionar um `enumField` "Fonte" com `FONT_KEYS`/`FONT_LABELS`, `refresh:true`, chamando `updateTheme(c, { font: v })`.
- Pre-visualizacao opcional: aplicar a fonte ao `theme-preview` ou a um texto de exemplo.

---

## 10. Riscos

| Risco | Severidade | Mitigacao |
|---|---|---|
| Fonte decorativa em numeros/HUD prejudicar leitura | Media | Restringir `--char-font` ao conteudo; HUD/numeros seguem `--pixel` |
| Inconsistencia entre SOs (fontes do sistema) | Baixa (aceito) | Generica como fallback; Fase 2 opcional com self-host |
| Dado legado/corrompido em `theme.font` | Baixa | Resolver para `"padrao"` |
| Expectativa de fontes "bonitas" sem rede | Baixa | Documentar trade-off; Fase 2 cobre fidelidade |

---

## 11. Testes necessarios

1. **Selecao:** trocar entre Padrao/Serif/Fantasia/Manuscrita altera o conteudo da ficha; HUD/numeros permanecem monospace.
2. **Persistencia:** escolher fonte, salvar, recarregar → `theme.font` mantido e reaplicado.
3. **Compatibilidade:** ficha antiga sem `theme.font` abre como "Padrao" (visual identico ao atual).
4. **Reversibilidade:** voltar para "Padrao" restaura o visual original.
5. **Sem regressao mecanica:** nenhum derivado/calculo muda ao trocar de fonte (cruzar com `Testes_Regressao.md`).
6. **Offline:** sem rede, todas as fontes renderizam via fallback do sistema.
7. **Permissoes:** apenas quem tem `canEdit` altera a fonte; demais visualizam o resultado.
8. **Dado invalido:** `theme.font="xyz"` resolve para "Padrao" sem quebrar.

---

## 12. Fora de escopo

- Tamanho de fonte por ficha, peso, espacamento (apenas familia nesta sprint).
- Upload de fontes pelo usuario.
- Fontes self-hosted/Google Fonts (Fase 2 opcional).
- Qualquer alteracao de calculo, regra ou `excelCalc`.

*Fim da especificacao. Nenhuma alteracao de codigo foi realizada.*
