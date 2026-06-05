# Relatorio de Implementacao — PDFs na Ficha

**Data:** 2026-06-05  
**Base:** `docs/Especificacao_PDF_Ficha.md`  
**Escopo:** anexar/visualizar multiplos PDFs por ficha, com URL externa e upload via Firebase Storage.

---

## 1. Resultado

Sistema de PDFs implementado na aba **Geral**, no card **Documentos (PDF)**:

- ate 10 PDFs por ficha;
- adicionar PDF por URL externa;
- enviar arquivo PDF local para Firebase Storage;
- substituir arquivo PDF de um documento existente;
- abrir PDF em popup;
- abrir PDF em nova aba como fallback;
- persistir metadados em `characters/{id}.documents`;
- preservar fichas antigas sem `documents` via normalizacao lazy;
- restringir edicao/upload/remocao a `canEdit` (dono ou Mestre);
- restringir Storage por rules a dono da ficha ou Mestre;
- sem alteracao em `excelCalc` ou formulas.

---

## 2. Modelo de dados

Novo campo por ficha:

```js
documents: [
  {
    id,
    name,
    url,
    storagePath,
    size,
    uploadedAt
  }
]
```

- URL externa: `storagePath: ""`, `size: 0`, `uploadedAt: null`.
- Upload Storage: `url` recebe download URL; `storagePath` guarda o caminho do arquivo.
- Fichas antigas: `documents` ausente normaliza para `[]`.

---

## 3. Implementacao por arquivo

### `app.js`

- Adicionados limites:
  - `MAX_PDFS_PER_CHARACTER = 10`
  - `MAX_PDF_BYTES = 10 * 1024 * 1024`
- Adicionados normalizadores:
  - `normalizeDocumentItem`
  - `normalizeDocuments`
- `defaultCharacter()` agora inclui `documents: []`.
- `normalizeCharacter()` e `sanitizeCharacterForPersist()` normalizam `documents`.
- Aba Geral ganhou `renderDocuments(c)` com:
  - lista colapsavel de documentos;
  - botao `+ PDF por URL`;
  - botao `Enviar PDF`;
  - edicao de nome/URL quando permitido;
  - upload/substituicao por item;
  - remocao com limpeza de Storage quando ha `storagePath`.
- Adicionados:
  - `addDocumentUrl`
  - `uploadPdfDocument`
  - `removeDocument`
  - `openPdfPopup`
  - `openPdfInNewTab`
  - `safeStorageFileName`
  - `formatBytes`

### `firebase.js`

- Adicionado SDK de Firebase Storage:
  - `getStorage`
  - `storageRef`
  - `uploadBytes`
  - `getDownloadURL`
  - `deleteObject`
- Exportado `storage` e funcoes usadas por `app.js`.

### `storage.rules`

Novo arquivo de regras:

- PDFs ficam em `characters/{characterId}/documents/{fileName}`.
- Leitura/delete permitidos apenas se usuario logado pode acessar a ficha:
  - dono (`ownerId == request.auth.uid`) ou Mestre.
- Create/update exigem:
  - acesso a ficha;
  - `contentType == "application/pdf"`;
  - tamanho ate 10 MB.

### `firebase.json`

- Adicionada configuracao:

```json
"storage": {
  "rules": "storage.rules"
}
```

### `styles.css`

- Adicionado CSS para:
  - `.pdf-actions`
  - `.pdf-meta`
  - `.pdf-popup-overlay`
  - `.pdf-popup-box`
  - `.pdf-popup-title`
  - iframe do popup.

### Documentacao

- `docs/NiarTale_Documento_Continuidade.md` atualizado com:
  - Firebase Storage;
  - `storage.rules`;
  - modelo `documents[]`;
  - deploy com Storage;
  - compatibilidade e ausencia de impacto em calculos.
- `docs/Roadmap_Atualizado.md` atualizado em F-C.

---

## 4. Permissoes

### Frontend

- Visualizacao: qualquer usuario que consegue ler a ficha.
- Adicionar/editar/upload/remover: apenas `canEdit(c)` (dono ou Mestre).

### Storage

- `storage.rules` consulta:
  - `characters/{characterId}.ownerId`;
  - `users/{uid}.role` para Mestre.
- Arquivos fora do caminho esperado nao possuem regra permissiva.

---

## 5. Compatibilidade

- Fichas antigas sem `documents`: carregam como `[]`.
- Fichas com URLs externas futuras/legadas: funcionam sem `storagePath`.
- Remover documento com `storagePath` tenta deletar o binario; falha de limpeza nao bloqueia remocao do metadado.
- Sem migracao eager.

---

## 6. Ausencia de impacto mecanico

`documents` e metadado documental. Nenhum trecho de `excelCalc`, `armorState`, `skillBonus`, progressao, HP/PP, armaduras ou reducoes foi alterado para depender de PDFs.

---

## 7. Validacao realizada

- `ReadLints`: sem erros em `app.js`, `firebase.js`, `styles.css`.
- Sintaxe ES module:
  - `node --input-type=module --check < app.js`
  - `node --input-type=module --check < firebase.js`
- Nao foi feito teste real de upload contra Firebase nesta sessao; depende de Storage habilitado no projeto e deploy de `storage.rules`.

---

## 8. Pendencia operacional

Antes de usar upload em producao:

1. habilitar Firebase Storage no projeto `niartale-rpg-core`, se ainda nao estiver habilitado;
2. publicar regras com `firebase deploy` (ou deploy de Storage/Firestore/Hosting conforme fluxo do projeto);
3. testar upload como dono, como Mestre e como usuario sem permissao.

---

## 9. Conclusao

O sistema de PDFs da ficha foi implementado conforme os requisitos: upload/anexo, popup, persistencia, permissoes e compatibilidade com fichas antigas, sem alteracoes de calculo.

