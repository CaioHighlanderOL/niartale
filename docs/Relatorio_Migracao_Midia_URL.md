# Relatorio de Migracao — PDF por Storage → PDF por URL

**Data:** 2026-06-05
**Base:** `docs/Especificacao_Midia_URL.md`
**Motivacao:** projeto permanece no plano Spark do Firebase; Firebase Storage nao esta disponivel.

---

## 1. Resultado

Toda dependencia funcional de Firebase Storage foi removida. O sistema de PDFs opera exclusivamente por **URL externa**, persistida no Firestore (`characters/{id}.documents[]`). Popup, fallback em nova aba e compatibilidade com fichas existentes foram preservados.

---

## 2. Alteracoes por arquivo

### `firebase.js`

- Removido import de `firebase-storage` (SDK inteiro).
- Removida const `export const storage = getStorage(app)`.
- Removidos exports: `deleteObject`, `getDownloadURL`, `storageRef`, `uploadBytes`.

### `app.js`

- **Import:** removidos `deleteObject`, `getDownloadURL`, `storage`, `storageRef`, `uploadBytes`.
- **Constante:** removida `MAX_PDF_BYTES`.
- **`normalizeDocumentItem`:** simplificado para garantir apenas `id`/`name`/`url`; chaves legadas (`storagePath`/`size`/`uploadedAt`) preservadas via spread, sem serem escritas em fichas novas.
- **`renderDocuments`:** removidos input `type=file` e botao "Enviar PDF"; hint atualizado para "X/10 PDFs.".
- **`buildDocumentCard`:** removidos input `type=file`, botao "Substituir PDF"/"Enviar arquivo", bloco de meta de Storage (`formatBytes`); campo URL sempre editavel (+ `refresh: true` — resolve menor M1); card simplificado.
- **`removeDocument`:** removido bloco `if (item.storagePath) { deleteObject(...) }`.
- **`uploadPdfDocument`:** funcao removida integralmente.
- **`duplicateCharacter`:** removido bloco I1 de limpeza de `storagePath` (era codigo morto sem Storage).
- **`safeStorageFileName`:** funcao removida.
- **`formatBytes`:** funcao removida.

### `firebase.json`

- Removido bloco `"storage": { "rules": "storage.rules" }`.

### `storage.rules`

- Arquivo **deletado**.

### Documentacao

- `docs/NiarTale_Documento_Continuidade.md`:
  - Tabela de responsabilidades por arquivo: removido `storage.rules`; `firebase.js` sem Storage.
  - Secao 6.4.1 (Storage PDFs): removida.
  - Secao 6.5 Deploy: removida etapa de habilitar Storage; adicionada nota de que Storage nao e utilizado.
  - Secao 7.9.1 Documentos PDF: modelo atualizado para `{ id, name, url }`; nota sobre campos legados; descricao atualizada.

---

## 3. Compatibilidade com fichas existentes

| Cenario | Comportamento |
|---|---|
| Ficha sem `documents` | `normalizeCharacter` injeta `[]` (lazy). OK. |
| Ficha com PDF por URL (padrao ja existente) | URL abre em popup/nova aba. OK. |
| Ficha com PDF legado de Storage (`storagePath` preenchido) | Tratado como URL externa. Se o bucket existir, a URL resolve. Se nao, popup mostra erro + "Abrir em nova aba". Campos legados preservados por spread; nao sao reescritos. OK. |
| Ficha duplicada (antes com bloco I1) | Sem o bloco I1, e sem Storage, a duplicacao simplesmente copia `url` e campos legados — nenhuma operacao destrutiva possivel. OK. |

Nenhuma migracao eager. Fichas antigas nao sao reescritas proativamente.

---

## 4. Funcionalidades preservadas

- Adicionar PDF por URL (`addDocumentUrl`)
- Abrir PDF em popup (`openPdfPopup`) com iframe + onerror + fechar por overlay/Esc/botao
- Abrir PDF em nova aba (`openPdfInNewTab`) — fallback
- Remover PDF (apenas metadado)
- Limite de 10 PDFs por ficha
- Permissoes: `canEdit` no front; `firestore.rules` inalterado

---

## 5. Funcionalidades removidas (exclusivamente de Storage)

- Upload de arquivo local
- Substituicao de arquivo
- Exclusao de binario no Storage ao remover PDF
- Visualizacao de tamanho de arquivo (`formatBytes`)
- Limpeza de `storagePath` em `duplicateCharacter` (I1 — codigo morto)

---

## 6. Reuso do padrao (midia por URL)

O padrao "midia por URL + popup + nova aba" e agora o unico modelo de midia do projeto:

| Campo | Local | Status |
|---|---|---|
| `avatarUrl` | ficha | existente |
| `imageUrl` | habilidades, inventario | existente |
| `documents[].url` | PDFs da aba Geral | consolidado nesta migracao |
| `imageUrl` em equipamentos | futuro | fora do escopo desta entrega |

---

## 7. Verificacao

- `ReadLints`: sem erros em `app.js`, `firebase.js`.
- Sintaxe ES module: `node --input-type=module --check < app.js && node --input-type=module --check < firebase.js` → exit 0.
- `storage.rules` deletado; `firebase.json` sem bloco `storage`.
- `excelCalc`, `firestore.rules`, calculos, progressao, raca/sub-raca: intocados.

---

*Migracao concluida. Nenhuma melhoria adicional foi implementada.*
