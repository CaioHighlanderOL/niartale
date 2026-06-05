# Relatório de Implementação — PDF Local no Navegador

**Data:** 2026-06-05
**Base:** `docs/Especificacao_PDF_Local.md`

---

## 1. Resultado

Implementação integral da solução de PDF local: upload direto, persistência em IndexedDB, janela flutuante (móvel/redimensionável/min/max), compatibilidade total com documentos legados por URL e com fichas antigas.

---

## 2. Alterações por arquivo

### `app.js`

#### Constantes novas
```js
const MAX_PDF_LOCAL_BYTES = 25 * 1024 * 1024;
const MEDIA_DB_NAME = "niartale-media";
const MEDIA_DB_VERSION = 1;
const PDF_WIN_KEY = "niartale.pdfWindow";
```

#### Camada IndexedDB (banco `niartale-media`, store `pdfs`)
| Função | Descrição |
|---|---|
| `openMediaDb()` | Abre/cria o banco; cacheia `_mediaDb`; cria store `pdfs` com índice `characterId` na primeira abertura. |
| `putPdfBlob(record)` | Grava `{ localId, characterId, blob, name, size, mime, createdAt }`. |
| `getPdfBlob(localId)` | Retorna o registro ou `null` (falha graciosamente). |
| `deletePdfBlob(localId)` | Remove o registro; best-effort. |

#### `normalizeDocumentItem` — estendido
Garante `source` (inferido se ausente por `localId`), `localId`, `size`, `mime`. Ainda preserva campos legados (`storagePath`/`uploadedAt`) pelo spread.

#### `renderDocuments` — atualizado
- Mantém `+ PDF por URL`.
- Adiciona `<input type=file accept="application/pdf">` oculto + botão **"Enviar PDF (local)"** — chama `addDocumentLocal`.
- Ambos os botões desabilitam ao atingir limite ou sem permissão.

#### `buildDocumentCard` — reescrito
- Badge visual `pdf-badge--local` / `pdf-badge--url`.
- PDF **local**: exibe `Nome` editável + linha de meta (`size` + "salvo neste navegador").
- PDF **URL**: exibe `Nome` + `URL` editável (com `refresh:true`).
- Botões "Abrir PDF" e "Nova aba" chamam `openDocument(item)` e `openDocumentInNewTab(item)` (ambos async).

#### `formatBytes(bytes)` — reintroduzido
Removido na migração URL, reintroduzido aqui para exibir tamanho de PDFs locais.

#### `addDocumentUrl` — atualizado
Inicializa `source: "url"` explicitamente.

#### `addDocumentLocal(c, file)` — novo
Valida tipo/tamanho/limite → `putPdfBlob` → metadado em `documents[]` → `saveChar`.

#### `removeDocument` — atualizado
Para `source:"local"` e `localId` preenchido: `deletePdfBlob(item.localId)` (best-effort, não bloqueia o fluxo de remoção do metadado).

#### `duplicateCharacter` — atualizado
Após criar o documento no Firestore (obtenção do `newCharId`), itera os documentos `source:"local"`:
1. `getPdfBlob(item.localId)` — se existir, clona com `newLocalId = uid("pdf")` e `putPdfBlob`.
2. Se blob ausente, `localId` é zerado na cópia (fallback/indisponível, sem erro).
3. `updateDoc` grava os metadados com os `localId` clonados — isolamento total.

#### `openPdfPopup` — removido
Substituído por `openPdfWindow`.

#### `openPdfWindow(url, name, isObjectUrl)` — novo
Janela flutuante `position:fixed`:
- **Drag:** `pointerdown/pointermove/pointerup` na barra de título (com `setPointerCapture`).
- **Resize:** `resize:both` CSS + `ResizeObserver` para persistir novas dimensões.
- **Minimizar:** colapsa para só a barra de título (`.pdf-win--min`).
- **Maximizar:** `inset:0; 100vw; 100dvh` (`.pdf-win--max`); restaura ao clicar novamente.
- **Fechar:** remove o elemento, persiste estado, revoga object URL se `isObjectUrl`.
- **Tecla Esc:** fecha.
- **Apenas uma janela ativa** (`document.querySelector(".pdf-win")?.remove()`).
- **Estado (pos/tam/maximized):** `localStorage["niartale.pdfWindow"]`.

#### `openDocument(item)` — novo
Dispatcher assíncrono:
- `source:"local"` com `localId` → `getPdfBlob` → `URL.createObjectURL` → `openPdfWindow(..., true)`.
- Blob ausente + `url` disponível → fallback URL em `openPdfWindow`.
- Blob ausente + sem URL → `openPdfUnavailableDialog`.
- `source:"url"` → `openPdfWindow(item.url, ...)`.

#### `openDocumentInNewTab(item)` — novo
- Local: `getPdfBlob` → `URL.createObjectURL` → `window.open`; revoga após 10 s.
- Fallback para URL se blob ausente.
- URL: `openPdfInNewTab` (comportamento atual).

#### `openPdfInNewTab` — inalterado

#### `openPdfUnavailableDialog(name)` — novo
`toast(...)` com instrução clara de reenvio.

#### `loadPdfWinState` / `savePdfWinState` — novos
Helpers de leitura/escrita de `localStorage[PDF_WIN_KEY]`.

---

### `styles.css`

**Removido:** `.pdf-popup-overlay`, `.pdf-popup-box`, `.pdf-popup-title`, `.pdf-popup-box iframe`.

**Adicionado:**

| Classe | Descrição |
|---|---|
| `.pdf-source-row` | Container do badge de origem. |
| `.pdf-badge` | Badge base (rótulo "Local"/"URL"). |
| `.pdf-badge--local` | Estilo azul-ciano para PDF local. |
| `.pdf-badge--url` | Estilo muted para PDF por URL. |
| `.pdf-win` | Container da janela flutuante (`position:fixed`, `resize:both`, `grid`). |
| `.pdf-win--max` | Estado maximizado (`resize:none`). |
| `.pdf-win--min` | Estado minimizado (oculta body/footer). |
| `.pdf-win-titlebar` | Barra arrastável com `cursor:grab`. |
| `.pdf-win-title` | Rótulo do nome do PDF. |
| `.pdf-win-btn` / `.pdf-win-close` | Botões min/max/fechar da janela. |
| `.pdf-win-body` | Container do iframe (grid fill). |
| `.pdf-win-footer` | Barra inferior com "Nova aba". |
| `.pdf-win-msg` | Mensagem de erro de carregamento. |

---

### `docs/NiarTale_Documento_Continuidade.md`

Seção 7.9.1 atualizada com:
- Novo modelo de dados (`source`, `localId`, `size`, `mime`).
- Descrição de ambos os fluxos (local/URL).
- Descrição da janela flutuante e persistência de estado.

---

## 3. Compatibilidade

| Cenário | Comportamento |
|---|---|
| Ficha sem `documents` | `[]` lazy |
| Ficha com PDFs por URL (legado/atual) | `source` inferido como `"url"`; comportamento inalterado |
| Ficha com `storagePath` legado | Preservado pelo spread; tratado como `source:"url"` |
| PDF local no mesmo navegador | IndexedDB → object URL → janela flutuante |
| PDF local em outro dispositivo | Metadado visível; blob ausente → fallback URL ou aviso claro |
| Duplicar ficha com PDFs locais | Blobs clonados com novos `localId`; isolamento total |

---

## 4. Restrições cumpridas

- Sem Firebase Storage. Sem `storage.rules`. Sem serviço externo.
- `excelCalc` intocado.
- `firestore.rules` intocado.
- Cálculos, combate, raça/sub-raça, progressão, armaduras, resistências: intocados.
- Sem cobrança.

---

## 5. Verificação

- `ReadLints`: sem erros em `app.js`, `styles.css`.
- `node --input-type=module --check < app.js` → exit 0.
- Nenhuma referência a `openPdfPopup`, `.pdf-popup-overlay` ou `.pdf-popup-box` remanescente.

---

*Relatório de implementação. Nenhuma melhoria adicional foi incluída.*
