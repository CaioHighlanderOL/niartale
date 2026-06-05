# Especificacao — Midia por URL (sem Firebase Storage)

**Data:** 2026-06-05
**Fontes:** `docs/NiarTale_Documento_Continuidade.md`, `docs/Especificacao_PDF_Ficha.md`, `docs/Relatorio_Implementacao_PDF_Ficha.md`, `docs/Auditoria_PDF_Ficha.md`, codigo `app.js`, `firebase.js`, `storage.rules`, `firebase.json`
**Tipo:** especificacao tecnica. **Nao implementar.**

---

## 1. Contexto e decisao

O projeto **permanecera no plano Spark** do Firebase. **Nao havera Firebase Storage.**

Portanto, o sistema atual de **upload** de PDFs (que usa Firebase Storage) deve ser **substituido por um sistema exclusivamente baseado em URLs externas**. PDFs (e, futuramente, imagens) passam a ser **referencias por URL**, persistidas apenas no Firestore.

Esta especificacao define:
1. o que remover (dependencias de Storage);
2. o sistema final de PDFs por URL;
3. compatibilidade com fichas existentes (inclusive as que ja tem PDF enviado por Storage);
4. uma arquitetura de "midia por URL" reutilizavel para imagens de habilidades, itens e equipamentos.

---

## 2. Estado atual (a ser alterado)

| Local | Estado atual | Acao |
|---|---|---|
| `firebase.js` | importa/exporta `getStorage`, `storageRef`, `uploadBytes`, `getDownloadURL`, `deleteObject`; exporta `storage` | **remover** o SDK e exports de Storage |
| `app.js` | `MAX_PDF_BYTES`, `uploadPdfDocument`, `safeStorageFileName`, `deleteObject` em `removeDocument`, inputs `type=file`, botoes "Enviar PDF"/"Substituir PDF" | **remover** upload; manter apenas URL |
| `app.js` (modelo) | `documents[]` = `{ id, name, url, storagePath, size, uploadedAt }` | **simplificar** para `{ id, name, url }` (campos de Storage viram vestigiais — ver 5) |
| `storage.rules` | regras de PDF no Storage | **remover** arquivo |
| `firebase.json` | bloco `"storage": { "rules": "storage.rules" }` | **remover** bloco |
| `duplicateCharacter()` | limpa `storagePath` na copia (correcao I1) | **simplificar/!remover** conforme modelo final (ver 5.3) |

> Observacao: imagens de habilidades/itens **ja sao por URL** (`imageUrl`), entao nao dependem de Storage. So o PDF dependia.

---

## 3. Requisitos do sistema final (PDF por URL)

1. **Sem Firebase Storage** e **sem `storage.rules`**.
2. Anexar PDF **via URL** (campo de texto).
3. Abrir PDF em **popup** (iframe), reusando `openPdfPopup`.
4. Abrir PDF em **nova aba** (`openPdfInNewTab`), fallback obrigatorio.
5. **Compatibilidade** com fichas existentes (com e sem `documents`, e com PDFs antes enviados por Storage).
6. **Persistencia apenas no Firestore** (`characters/{id}.documents`).
7. **Sem impacto em calculos** (`excelCalc` intocado).
8. **Sem impacto em permissoes da ficha** (`canEdit`, `firestore.rules` inalterados).
9. Limite de **10 PDFs por ficha** mantido.

---

## 4. Modelo de dados final

### 4.1 Estrutura simplificada

```js
documents: [
  {
    id,    // uid("doc")
    name,  // rotulo amigavel
    url    // URL externa do PDF
  }
]
```

- Campos `storagePath`, `size`, `uploadedAt` **deixam de ser usados/escritos**.
- A normalizacao **nao deve apagar** campos extras de fichas antigas (aditiva), mas tambem **nao deve depender** deles.

### 4.2 Normalizacao

- `normalizeDocumentItem(item)` passa a garantir apenas:
  - `id` (`uid("doc")` se ausente);
  - `name` string;
  - `url` string.
- Pode **preservar** chaves legadas (`storagePath`/`size`/`uploadedAt`) por compatibilidade, mas nenhuma logica deve usa-las. Alternativa aceitavel: descartar silenciosamente na proxima gravacao (limpeza lazy). **Recomendado: preservar**, para nao reescrever fichas sem necessidade.
- `normalizeDocuments(list)`: `Array.isArray` → map; senao `[]`.
- Chamado em `normalizeCharacter()` (carga) e `sanitizeCharacterForPersist()` (save), como hoje.

---

## 5. Compatibilidade

### 5.1 Fichas sem `documents`
- `normalizeCharacter` injeta `[]` (lazy). Sem mudanca.

### 5.2 Fichas com PDFs por URL (ja suportado)
- Continuam funcionando: `url` aberta em popup/nova aba.

### 5.3 Fichas com PDFs enviados por Storage (legado)
- Esses itens tem `url` = download URL tokenizada do Storage **e** `storagePath` preenchido.
- Como o plano Spark mantem arquivos ja existentes no Storage apenas se o bucket existir; **se o Storage for desativado/inexistente, essas URLs podem parar de resolver**. Tratamento:
  - O sistema passa a tratar **todo** documento como "URL externa": exibe, abre em popup e em nova aba normalmente.
  - **Nao** havera mais botao de exclusao de binario; `removeDocument` apenas remove o metadado do array (sem `deleteObject`).
  - Se a URL legada nao resolver, o popup mostra erro + "Abrir em nova aba" (fallback ja existente).
- `duplicateCharacter()`: com o modelo so-URL, a copia naturalmente **nao** tem referencia destrutiva (nao ha `deleteObject`). A limpeza de `storagePath` da correcao I1 torna-se **inofensiva/desnecessaria**; pode ser mantida (sem efeito) ou removida junto com o restante do codigo de Storage. **Recomendado remover** ao retirar o Storage, para evitar codigo morto.

### 5.4 Resumo de compatibilidade
- Nenhuma migracao **eager**. Tudo lazy/aditivo.
- Nenhuma ficha quebra; no pior caso, uma URL legada de Storage fica inacessivel (mesmo comportamento de qualquer URL quebrada), com fallback claro.

---

## 6. UI final (PDF)

Card "Documentos (PDF)" na aba Geral:

- **Adicionar**: botao "+ PDF por URL" (cria item com `url` vazia para colar).
- **Editar**: campos `Nome` e `URL` (somente `canEdit`).
- **Abrir**: botao "Abrir PDF" (popup) e "Nova aba".
- **Remover**: remove o item do array (sem tocar em Storage).
- **Remover da UI**: input `type=file`, botoes "Enviar PDF"/"Substituir PDF", e o texto de limite "ate 10 MB cada" (limite de tamanho era do upload).
- **Manter**: limite de 10 itens; hint "X/10 PDFs".
- Correcao do menor **M1** (recomendada, opcional): tornar o campo `URL` com `refresh` para habilitar "Abrir PDF"/"Nova aba" imediatamente apos colar.

---

## 7. Remocao de dependencias (checklist)

1. `firebase.js`: remover import e export de `getStorage`/`storageRef`/`uploadBytes`/`getDownloadURL`/`deleteObject` e a const `storage`.
2. `app.js`: remover `uploadPdfDocument`, `safeStorageFileName`, `MAX_PDF_BYTES`, `formatBytes` (se so usado por PDF), inputs de arquivo e botoes de upload/substituir; ajustar `removeDocument` para nao chamar `deleteObject`; ajustar `buildDocumentCard`/`renderDocuments`.
3. `storage.rules`: remover arquivo.
4. `firebase.json`: remover bloco `storage`.
5. `duplicateCharacter()`: remover bloco de limpeza de `storagePath` (codigo morto sem Storage).
6. Documentacao: atualizar `NiarTale_Documento_Continuidade.md` (remover Storage, `storage.rules`, deploy de Storage; ajustar secao 7.9.1 e modelo `documents`).

> Nota: nada em `excelCalc`, `firestore.rules`, atributos, pericias ou permissoes muda.

---

## 8. Arquitetura reutilizavel: "Midia por URL"

O padrao PDF-por-URL e o mesmo ja usado por `imageUrl` em habilidades/itens. Propoe-se consolidar um **padrao unico de campo de midia por URL** reutilizavel.

### 8.1 Conceito

Um "campo de midia" = `{ url, name? }` + dois comportamentos:
- **visualizar inline/popup** (imagem: thumb + `openImagePopup`; pdf: `openPdfPopup`);
- **abrir em nova aba** (fallback).

### 8.2 Helpers comuns (proposta)

- `mediaUrlField(label, value, onInput, opts)` — campo de texto de URL com `refresh` para habilitar acoes.
- `openImagePopup(url, alt)` — **ja existe**.
- `openPdfPopup(url, name)` / `openPdfInNewTab(url)` — **ja existem**.
- Opcional: `openMediaPopup(url, kind, name)` que despacha para imagem/pdf por `kind`.

### 8.3 Aplicacao a imagens de habilidades e itens
- **Ja implementado** via `imageUrl` (`buildItemCard`): campo URL + thumb + popup. Nenhuma dependencia de Storage. Apenas alinhar nomenclatura/“helper” se desejado. **Sem mudanca funcional necessaria.**

### 8.4 Aplicacao a imagens de equipamentos (nao implementado hoje)
- Equipamento (`equipment[]`) **nao** tem `imageUrl`. Para paridade:
  - adicionar `imageUrl` ao modelo de equipamento (default `""`), com `normalizeEquipmentItem` garantindo string;
  - em `buildEquipmentCard`, adicionar `mediaUrlField` + thumb + `openImagePopup` (mesmo padrao de `buildItemCard`);
  - lazy/aditivo; sem impacto em `armorState`/`excelCalc` (imagem e metadado visual).
- **Escopo futuro** — fora desta especificacao de PDFs; aqui apenas registrado como reuso natural do mesmo padrao.

### 8.5 Beneficios da consolidacao
- Zero infraestrutura (Spark-friendly): tudo URL + Firestore.
- Seguranca simples: sem binarios, sem rules de Storage; acesso controlado pelo `firestore.rules` da ficha.
- Consistencia de UX: mesmo comportamento de popup/nova aba para imagem e PDF.

---

## 9. Limites e validacao (sistema so-URL)

| Limite | Valor | Onde |
|---|---|---|
| PDFs por ficha | 10 | UI (desabilita "+ PDF") |
| Tamanho de `url` | ~2 KB | validacao leve no front |
| Tamanho de `name` | ~120 chars | validacao leve no front |
| Tipo | qualquer URL; PDF esperado | `iframe` + fallback nova aba; sem validacao de binario |

- **Sem** limite de tamanho de arquivo (nao ha upload).
- URL quebrada → popup mostra erro + "Abrir em nova aba".

---

## 10. Impactos

- **Calculos:** nenhum. `documents`/`imageUrl` sao metadados.
- **Permissoes:** inalteradas (`canEdit`, `firestore.rules`).
- **Persistencia:** apenas Firestore.
- **Seguranca:** simplificada (sem binarios/Storage). Conteudo depende de hosts externos (mesmo trade-off de `avatarUrl`/`imageUrl` ja aceito).

---

## 11. Criterios de aceitacao

1. Nenhuma referencia a Firebase Storage em `firebase.js`/`app.js`; `storage.rules` removido; `firebase.json` sem bloco `storage`.
2. Anexar PDF por URL, abrir em popup e em nova aba.
3. Remover PDF remove apenas o metadado (sem `deleteObject`).
4. Fichas antigas (sem `documents`, com URL, ou com PDF legado de Storage) abrem sem erro.
5. `excelCalc`, `firestore.rules` e permissoes inalterados.
6. (Reuso) Padrao de midia por URL documentado para imagens de habilidades/itens (ja existente) e equipamentos (futuro).

---

## 12. Plano de implementacao (resumo, quando aprovado)

1. Remover Storage de `firebase.js` e `firebase.json`; apagar `storage.rules`.
2. Simplificar `documents[]` e `normalizeDocumentItem` para `{ id, name, url }` (preservando chaves legadas).
3. Remover upload/substituir/`deleteObject`/limites de tamanho da UI e de `removeDocument`.
4. Remover bloco I1 de `duplicateCharacter` (codigo morto).
5. (Opcional) `refresh` no campo URL (M1).
6. Atualizar documentacao.
7. (Futuro, separado) `imageUrl` em equipamentos via mesmo padrao.

*Documento de especificacao. Nenhuma alteracao de codigo foi realizada.*
