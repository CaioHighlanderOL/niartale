# Auditoria — Correção da Janela PDF (Resize/Move)

**Data:** 2026-06-05
**Tipo:** auditoria de verificação (read-only). **Nenhum arquivo foi modificado.**
**Escopo:** exclusivamente a correção do redimensionamento/movimento da janela PDF.
**Base:** `docs/Relatorio_Correcao_PDF_Resize.md`, `docs/Relatorio_Implementacao_PDF_Local.md`, `docs/Auditoria_PDF_Local.md`, código `app.js` (`openPdfWindow`), `styles.css` (`.pdf-win*`).

---

## Sumário executivo

A correção resolve o problema reportado. Mover a janela altera **apenas** `x/y` (via `applyPosition`, que escreve só `left/top`), e o `ResizeObserver` é bloqueado durante o arrasto por `isDragging`. O `ResizeObserver` agora lê `offsetWidth/offsetHeight`, que — graças ao `box-sizing: border-box` global — correspondem exatamente ao `style.width/height` escrito, eliminando o encolhimento progressivo de 2 px. Minimizar e maximizar preservam as dimensões personalizadas.

**Veredito final: GO.**

Achados: **0 Críticos, 0 Importantes, 4 Menores** (1 pré-existente fora do escopo da correção; demais informativos).

---

## 1. Movimento

| Critério | Verificação no código | Status |
|---|---|---|
| Arrastar altera apenas `x/y` | `pointermove` atualiza `winX/winY` e chama `applyPosition()` (só `left/top`) | OK |
| Largura inalterada | `applyPosition` não toca em `width`; `winW` nunca é reescrito no drag | OK |
| Altura inalterada | `applyPosition` não toca em `height`; `winH` nunca é reescrito no drag | OK |
| Nenhuma atualização indevida de width/height | `cssText` não é usado no drag; só `left/top` mudam → caixa de conteúdo estável | OK |
| Movimentos consecutivos mantêm tamanho | `winW/winH` permanecem constantes em N eventos de `pointermove` | OK |
| ResizeObserver não dispara no drag | Guarda `if (... || isDragging) return;` + tamanho não muda | OK (dupla proteção) |

**Análise:** o bug original ocorria porque `applyGeometry()` (chamado no `pointermove`) escrevia `cssText`, invalidando o estilo inline e disparando o `ResizeObserver`, que lia `contentRect.width` (= `winW − 2` por causa das bordas). A correção elimina ambas as causas: o drag não escreve mais `width/height` e o observer é bloqueado por `isDragging`.

---

## 2. Redimensionamento

| Critério | Verificação | Status |
|---|---|---|
| Resize altera largura/altura | `resize: both` (CSS) + `ResizeObserver` lê `win.offsetWidth/offsetHeight` | OK |
| Tamanho novo persistido | `persist()` chamado no callback do observer | OK |
| Tamanho restaurado ao reabrir | `loadPdfWinState()` → `winW = saved.w`, `winH = saved.h` | OK |
| ResizeObserver não dispara alterações falsas | Guarda contra `isMaximized/isMinimized/isDragging`; leitura coerente com escrita | OK |
| Largura/altura persistidas = último resize real | `offsetWidth === style.width` sob `box-sizing: border-box` (global, `styles.css:50`) | OK |

**Ponto-chave verificado:** a correção troca `contentRect` por `offsetWidth/offsetHeight`. Isso só elimina totalmente a divergência se o elemento for `border-box` (offsetWidth inclui borda, igual ao valor escrito em `style.width`). Confirmado: `*, *::before, *::after { box-sizing: border-box; }` (`styles.css:50`). Logo, `offsetWidth === winW` escrito — sem drift. (Ver risco R1 caso essa regra global mude.)

---

## 3. Minimizar

| Critério | Verificação | Status |
|---|---|---|
| Não sobrescreve largura salva | `toggleMinimize` não altera `winW`; `applyGeometry` (ramo min) usa `winW` | OK |
| Não sobrescreve altura salva | Ramo min faz `style.height = ""`; `winH` intacto na variável | OK |
| Restaurar recupera tamanho anterior | Segundo `toggleMinimize` → ramo normal aplica `winW/winH` originais | OK |
| Minimizar não gera resize persistente | `persist()` **não** é chamado em `toggleMinimize`; observer guardado por `isMinimized` | OK |

**Análise:** ao minimizar, o grid colapsa via CSS (`.pdf-win--min`: `grid-template-rows: auto 0 0`, `min-height: 0`, `height: auto`, body/footer `display:none`). A altura visual muda, mas o `ResizeObserver` retorna cedo (`isMinimized`), então a altura colapsada **não** é persistida. `winW/winH` permanecem nas variáveis. Correto. (A correção do M1 da auditoria anterior — `min-height: 0 !important` — está aplicada e confere.)

---

## 4. Maximizar

| Critério | Verificação | Status |
|---|---|---|
| Não apaga dimensões personalizadas | `toggleMaximize` não altera `winW/winH`; `persist()` salva os valores originais | OK |
| Restaurar retorna ao tamanho anterior | Ramo normal de `applyGeometry` reaplica `winW/winH` | OK |
| Posição anterior preservada | `winX/winY` nunca mudam ao maximizar; restauração usa `clampX(winX)/clampY(winY)` | OK |
| Observer não persiste tamanho maximizado | Guarda `isMaximized` no callback | OK |

**Análise:** o ramo maximizado usa `cssText = "left:0;top:0;width:100vw;height:100dvh"`, o que dispara o observer, mas a guarda `isMaximized` impede a gravação de `100vw/100dvh` em `winW/winH`. `persist()` em `toggleMaximize` grava os `winW/winH` originais + `maximized:true`. Restauração correta.

---

## 5. Persistência

| Cenário | Verificação | Status |
|---|---|---|
| Refresh da página | Estado em `localStorage["niartale.pdfWindow"]`; reaberto por `loadPdfWinState` | OK |
| Fechar e reabrir | `close()` chama `persist()`; próxima abertura restaura | OK |
| Múltiplos PDFs | Apenas uma janela por vez (`querySelector(".pdf-win")?.remove()`) | OK (ver M1) |
| PDFs locais (IndexedDB) | `openDocument` → `getPdfBlob` → object URL → `openPdfWindow`; geometria independe da origem | OK |
| PDFs por URL | `openPdfWindow(item.url, ...)`; mesma lógica de geometria | OK |
| Posição persiste | `persist()` grava `x/y` no `pointerup`, max e close | OK (ver M3) |
| Tamanho persiste | `persist()` grava `w/h` apenas em resize real | OK |
| Sem redimensionamento espontâneo | Confirmado nas seções 1–4 | OK |

---

## 6. Compatibilidade (ausência de regressão)

A correção tocou **apenas** o interior de `openPdfWindow` (`app.js`) e a classe `.pdf-win--min` (`styles.css`). Não foram alterados:

| Área | Status |
|---|---|
| Upload local (`addDocumentLocal`) | Intocado |
| IndexedDB (`openMediaDb`/`putPdfBlob`/`getPdfBlob`/`deletePdfBlob`) | Intocado |
| Abertura em popup (`openDocument`) | Intocado (apenas consome `openPdfWindow`) |
| Abertura em nova aba (`openDocumentInNewTab`/`openPdfInNewTab`) | Intocado |
| Duplicação de ficha (`duplicateCharacter`) | Intocado |
| Normalização (`normalizeDocumentItem`/`normalizeDocuments`) | Intocado |
| Sanitização (`sanitizeCharacterForPersist`) | Intocado |
| Firestore / `excelCalc` / permissões | Intocados |

Sem regressões identificadas.

---

## 7. Qualidade

### Verificações automáticas
- `ReadLints` (`app.js`, `styles.css`): **sem erros**.
- `node --input-type=module --check < app.js` → **exit 0**.

### Análise específica

| Item | Resultado |
|---|---|
| Loop de ResizeObserver | **Eliminado.** Sob `border-box`, `offsetWidth === style.width` → callback grava valor idêntico, sem feedback. Guardas extra (`isDragging/min/max`). |
| Eventos duplicados | Drag usa `setPointerCapture`; um único conjunto de handlers por janela. (Exceção: M1 abaixo.) |
| Listeners não removidos | `close()` remove `keydown` e desconecta o observer. (Exceção: M1 — caminho `querySelector().remove()`.) |
| Estados inconsistentes | `isMaximized/isMinimized/isDragging` mutuamente tratados; transições corretas. |
| Código morto da correção | Nenhum. `applyPosition` e `applyGeometry` ambos usados; `contentRect` removido. |

### Achados

Nenhum **Crítico**. Nenhum **Importante**.

**Menores:**

- **M1 (pré-existente, fora do escopo da correção de resize):** ao abrir um novo PDF com uma janela já aberta, `openPdfWindow` faz `document.querySelector(".pdf-win")?.remove()` — remove o nó do DOM, mas **não** chama o `close()` da janela anterior. Consequência: o `keydown` da janela antiga permanece registrado em `document` (e seu `ResizeObserver`/closure não é desconectado), causando vazamento de listener e possível duplicação do handler de `Esc` (o `Esc` dispararia o `close` antigo, revogando um object URL já irrelevante). Não afeta o comportamento de mover/redimensionar, e já existia antes desta correção. Recomendação futura: chamar um teardown da janela anterior em vez de `.remove()` direto.
- **M2 (informativo):** o `ResizeObserver` dispara um callback inicial ao observar, executando um `persist()` redundante na abertura (grava os mesmos valores). Inofensivo (uma escrita em `localStorage` por abertura).
- **M3 (informativo):** `winX/winY` são persistidos sem clamp (valores brutos do drag); a renderização sempre reaplica `clampX/clampY`, então visualmente nunca há janela fora da tela, mas o dado salvo pode conter coordenadas fora dos limites. Sem impacto funcional.
- **M4 (risco/dependência — R1):** a correção do drift de tamanho depende de `box-sizing: border-box` global (`styles.css:50`). Se essa regra deixar de valer para `.pdf-win`, `offsetWidth` passaria a divergir de `style.width` e o crescimento de 2 px por ciclo poderia retornar. Recomendação: manter `.pdf-win` explicitamente `border-box` se o reset global mudar.

---

## 8. Conclusão

- **Mover a janela não altera o tamanho:** confirmado (drag escreve só `left/top`; `isDragging` bloqueia o observer).
- **Largura/altura mudam só em resize real:** confirmado (`offsetWidth/offsetHeight` sob `border-box`; guardas no observer).
- **Minimizar/Maximizar** preservam dimensões e restauram corretamente.
- **Persistência** correta em refresh, reabertura, locais e por URL.
- **Sem regressão** em upload, IndexedDB, popup, nova aba, duplicação, normalização, sanitização e Firestore.

## Veredito

**GO**

*Auditoria concluída. Nenhum arquivo foi modificado; gerado apenas este relatório.*
