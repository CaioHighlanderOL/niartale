# Relatório de Correção — Janela PDF: Redimensionamento Espúrio ao Mover

**Data:** 2026-06-05

---

## 1. Diagnóstico da causa raiz

Havia dois bugs acoplados, ambos em `openPdfWindow` (`app.js`):

### Bug A — Loop cssText → ResizeObserver (causa principal do encolhimento)

Durante o drag (`pointermove`), a função `applyGeometry()` era chamada. Ela escrevia:

```js
win.style.cssText = `left:${x}px;top:${y}px;width:${winW}px;height:${winH}px;`;
```

Setar `cssText` — mesmo sem alterar `width/height` — invalidava o estilo inline por completo, o que disparava o `ResizeObserver`. O observer lia `entry.contentRect.width`, que é a **caixa de conteúdo** (excluindo bordas). Como `.pdf-win` tem `border: 1px` de cada lado, `contentRect.width = winW − 2`. Resultado:

```
pontermove → applyGeometry (cssText) → ResizeObserver → winW -= 2 → persist
```

A cada evento de `pointermove`, `winW` encolhia 2 px. Em uma movimentação rápida com dezenas de eventos, a janela ficava visivelmente menor ao soltar.

### Bug B — `contentRect` em vez de `offsetWidth/offsetHeight`

Mesmo fora do drag, o ResizeObserver usava `entry.contentRect.width` para gravar `winW`. Como `contentRect` exclui bordas e `style.width` inclui bordas, havia divergência de 2 px entre o valor escrito e o valor lido, que se acumulava em usos sucessivos (redimensionar + fechar + reabrir + redimensionar + ...).

### Bug C (cosmético, M1 da auditoria)

`.pdf-win--min` não sobrescrevia `min-height: 180px`, deixando área vazia abaixo da barra de título ao minimizar.

---

## 2. Correções aplicadas

### `app.js` — `openPdfWindow`

**A. Nova flag `isDragging`**

```js
let isDragging = false;
```

**B. Nova função `applyPosition()` — só altera `left/top`**

```js
function applyPosition() {
  win.style.left = `${clampX(winX)}px`;
  win.style.top  = `${clampY(winY)}px`;
}
```

O `pointermove` agora chama `applyPosition()` em vez de `applyGeometry()`. Alterar apenas `left/top` não afeta o tamanho da caixa de conteúdo, portanto o `ResizeObserver` não dispara durante o drag.

**C. `applyGeometry()` reescrito para não usar `cssText` no caminho normal**

```js
// Estado normal
win.style.left   = `${clampX(winX)}px`;
win.style.top    = `${clampY(winY)}px`;
win.style.width  = `${winW}px`;
win.style.height = `${winH}px`;

// Minimizado
win.style.left   = `${clampX(winX)}px`;
win.style.top    = `${clampY(winY)}px`;
win.style.width  = `${winW}px`;
win.style.height = ""; // CSS (grid colapsado) controla altura
```

`cssText` é mantido apenas para maximizar (`left:0;top:0;width:100vw;height:100dvh`) onde a intenção é sobrescrever tudo explicitamente.

**D. `pointerdown/up` gerencia `isDragging`**

```js
// pointerdown
isDragging = true;
// pointerup
isDragging = false;
persist(); // posição final após soltar
```

**E. `ResizeObserver` corrigido**

```js
const ro = new ResizeObserver(() => {
  if (isMaximized || isMinimized || isDragging) return; // guarda completo
  winW = win.offsetWidth;   // offsetWidth inclui bordas — corresponde ao style.width
  winH = win.offsetHeight;
  persist();
});
```

`win.offsetWidth/offsetHeight` retornam o mesmo valor que foi escrito em `style.width/height`, eliminando a divergência de 2 px por borda.

### `styles.css` — `.pdf-win--min`

```css
.pdf-win--min {
  resize: none !important;
  grid-template-rows: auto 0 0;
  min-height: 0 !important;  /* colapsa ate a barra de titulo */
  height: auto !important;
}
```

---

## 3. Comportamentos verificados

| Cenário | Antes | Depois |
|---|---|---|
| Mover janela | `winW`/`winH` encolhiam por disparo do ResizeObserver | Só `winX`/`winY` mudam; tamanho intocado |
| Redimensionar (handle CSS) | Lia `contentRect` (−2 px acumulativo) | Lê `offsetWidth/offsetHeight`; estável |
| Minimizar | Área vazia de 180 px; `winW`/`winH` preservados | Colapsa para apenas a barra; dimensões preservadas |
| Maximizar | Correto | Correto (inalterado) |
| Restaurar de max/min | Correto | Correto — restaura `winW`/`winH` salvos |
| Abertura inicial | Posição/tamanho padrão ou restaurados do localStorage | Inalterado |
| Reabertura de PDF | Restaura último estado do localStorage | Inalterado |
| Após refresh da página | localStorage preserva estado; blob re-buscado do IndexedDB | Inalterado |
| Múltiplos PDFs | Apenas uma janela ativa (anterior removida) | Inalterado |

---

## 4. O que não foi alterado

- IndexedDB (`openMediaDb`, `putPdfBlob`, `getPdfBlob`, `deletePdfBlob`).
- Upload (`addDocumentLocal`).
- Firestore, `excelCalc`, permissões, `firestore.rules`.
- `openDocument`, `openDocumentInNewTab`, `openPdfInNewTab`, `loadPdfWinState`, `savePdfWinState`.

---

## 5. Verificação

- `ReadLints`: sem erros em `app.js`, `styles.css`.
- `node --input-type=module --check < app.js` → exit 0.

---

*Correção concluída.*
