# Especificacao — Anexar PDFs a ficha

**Data:** 2026-06-05
**Fontes:** `docs/NiarTale_Documento_Continuidade.md`, codigo `app.js`, `firebase.js`, `firestore.rules`
**Tipo:** especificacao tecnica. **Nao implementar.**

---

## 1. Objetivo

Permitir associar documento(s) PDF a uma ficha (ex.: ficha impressa, anexos de regras, mapas, contrato de campanha), com visualizacao em popup, respeitando permissoes, compatibilidade com fichas antigas e a arquitetura sem build do projeto.

---

## 2. Contexto tecnico relevante (estado atual)

| Aspecto | Estado |
|---|---|
| Firebase Storage | **Nao usado.** `firebase.js` importa apenas Auth + Firestore. `storageBucket` esta configurado (`niartale-rpg-core.firebasestorage.app`) mas o SDK de Storage **nao** e carregado. |
| `storage.rules` | **Inexistente.** So existe `firestore.rules`. |
| Padrao de midia atual | **URL em Firestore** (`avatarUrl`, `imageUrl` por item) — sem upload de arquivo. |
| Popup existente | `openImagePopup(url, alt)` (`app.js:1900-1937`): overlay `role="dialog"`, fecha por overlay/Esc/botao, com fallback de erro. Reaproveitavel como base para PDF. |
| Permissoes | `canEdit(c)` = dono ou Mestre; leitura por dono/Mestre em `firestore.rules`. |

---

## 3. Decisoes de design

### 3.1 Um PDF por ficha ou multiplos → **Multiplos**

- Recomendado: **lista de PDFs** (`documents[]`), coerente com o padrao de listas ja existente (habilidades, inventario, equipamentos) e com `buildStableListEditor`/`collapsibleItemCard`.
- Vantagem: cobre o caso de 1 documento (lista de tamanho 1) e tambem multiplos anexos, sem remodelar depois.
- **Limite recomendado:** ate **10** PDFs por ficha (ver secao 7).

### 3.2 Armazenamento → **Fase 1 por URL; Fase 2 com Firebase Storage (upload)**

A pergunta pede preferencia por Firebase Storage **se houver upload**. Como o projeto hoje **nao** carrega o SDK de Storage nem possui `storage.rules`, propoe-se abordagem faseada:

- **Fase 1 (MVP) — PDF por URL** (sem upload):
  - campo `url` por documento, identico em filosofia a `avatarUrl`/`imageUrl`;
  - **zero infraestrutura nova**; persistencia em `characters/{id}.documents`;
  - cobre PDFs ja hospedados (Drive publico, repositorio, CDN).

- **Fase 2 (quando houver upload de arquivo) — Firebase Storage**:
  - carregar SDK `firebase-storage` em `firebase.js`;
  - upload para caminho previsivel por ficha (ver 4.3);
  - guardar `url` (download URL) **e** `storagePath` no documento;
  - criar `storage.rules` espelhando a posse da ficha (ver 6.2).

> Recomendacao de corte: entregar **Fase 1** primeiro (rapida, sem risco de infra). Avancar para **Fase 2** apenas se o requisito for anexar arquivos locais de fato.

### 3.3 Como abrir o PDF em popup → **`openPdfPopup` (novo helper, espelhando `openImagePopup`)**

- Novo helper `openPdfPopup(url, name)` analogo a `openImagePopup`:
  - overlay `role="dialog"` / `aria-modal="true"`, fecha por clique no overlay, botao "Fechar" e `Esc`;
  - corpo com `<iframe src=url>` (ou `<embed type="application/pdf">`) ocupando a caixa;
  - **fallback obrigatorio:** botao/link "Abrir em nova aba" (`target="_blank" rel="noopener"`), pois alguns navegadores bloqueiam PDF em iframe;
  - handler de erro: se o iframe falhar, exibir mensagem + link de download.
- Reuso de CSS: criar `.pdf-popup-overlay`/`.pdf-popup-box` analogos a `.image-popup-*`.

### 3.4 Onde sera exibido

- Card **"Documentos (PDF)"** na aba **Geral** (ou em uma secao colapsavel via `collapsibleCard`), abaixo de Campos extras.
- Cada item: nome + botao "Abrir PDF" (popup) + botao "Abrir em nova aba" + (se `canEdit`) campos de edicao e botao remover, no padrao `collapsibleItemCard`.

---

## 4. Modelo de dados

### 4.1 Estrutura por documento

```js
documents: [
  {
    id: "doc_xxx",        // uid("doc")
    name: "",             // rotulo amigavel (ex.: "Ficha impressa")
    url: "",              // download URL (Fase 1: colada; Fase 2: retornada pelo Storage)
    storagePath: "",      // Fase 2: caminho no Storage; "" quando for so URL externa
    size: 0,              // Fase 2: bytes (informativo); 0 quando desconhecido
    uploadedAt: null      // Fase 2: timestamp; null em URL externa
  }
]
```

- **Fase 1** usa apenas `id`, `name`, `url` (demais campos default/vazios).
- `documents` ausente ou invalido → normalizado para `[]`.

### 4.2 Normalizacao (espelhando abilities/inventory)

- `normalizeDocumentItem(item)`: garante `id` (`uid("doc")`), `name`/`url`/`storagePath` string, `size` numero `>= 0`, `uploadedAt` ou null.
- `normalizeDocuments(list)`: `Array.isArray` → map; senao `[]`.
- Chamado em `normalizeCharacter()` (carga) e `sanitizeCharacterForPersist()` (save), padrao lazy/aditivo identico a `normalizeAbilities`/`normalizeInventory`.

### 4.3 Caminho no Storage (Fase 2)

```
characters/{characterId}/documents/{docId}-{filename}.pdf
```

- Previsivel, vinculado a `characterId` (permite regra de posse no Storage).
- Guardar `storagePath` para permitir exclusao do arquivo ao remover o item.

---

## 5. Persistencia

- **Fase 1:** `documents[]` salvo dentro de `characters/{id}` via `updateArrayItem`/`scheduleCharSave`/`saveChar` (mesmo fluxo de inventario). Sem campo novo de colecao.
- **Fase 2:** o **binario** vai para o Storage; o **metadado** (`url`, `storagePath`, `size`, `uploadedAt`) vai para `characters/{id}.documents`. Firestore nunca guarda o binario.
- `sanitizeCharacterForPersist()` normaliza `documents` antes de gravar.

---

## 6. Permissoes

### 6.1 Frontend

- **Visualizar/abrir PDF:** qualquer usuario que ja tem acesso a ficha (a leitura da ficha e governada por `firestore.rules`).
- **Adicionar/editar/remover/upload:** somente `canEdit(c)` (dono ou Mestre). Botoes de edicao recebem `data-master-only`/`disabled` no padrao atual.

### 6.2 Firestore / Storage

- **Fase 1:** sem mudanca em `firestore.rules` — `documents` e apenas mais um campo do doc `characters/{id}`, ja coberto pelas regras de owner/Mestre.
- **Fase 2 (`storage.rules` novo):** espelhar a posse. Esboco:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /characters/{characterId}/documents/{file} {
      // Leitura/escrita exige estar logado; idealmente validar posse da ficha.
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.size < 10 * 1024 * 1024
        && request.resource.contentType == "application/pdf";
    }
  }
}
```

> Observacao: o Storage rules **nao** consegue ler o Firestore para checar `ownerId` de forma trivial. Para posse estrita, considerar: (a) prefixar o caminho com o `uid` do dono (`characters/{uid}/{characterId}/...`) e validar `request.auth.uid` no path; ou (b) aceitar leitura por qualquer logado (modelo atual de `diceLog`) assumindo que o link nao e publicamente indexado. Decidir na Fase 2.

---

## 7. Limites

| Limite | Valor recomendado | Onde aplicar |
|---|---|---|
| PDFs por ficha | 10 | UI (bloquear "+ PDF" acima do limite) + nota |
| Tamanho por arquivo (upload) | 10 MB | `storage.rules` + validacao no upload (Fase 2) |
| Tipo aceito | `application/pdf` | `accept="application/pdf"` no input + `storage.rules` |
| Tamanho de `url`/`name` | `url` ate ~2 KB; `name` ate ~120 chars | validacao leve no front |
| Performance | iframe carregado **sob demanda** (so ao abrir o popup), nunca embutido na lista | `openPdfPopup` |

---

## 8. Fallback para fichas antigas

- Ficha sem `documents` → `normalizeCharacter` injeta `[]` (lazy); nenhuma migracao eager.
- Documento com `url` quebrada / Storage indisponivel → popup mostra mensagem de erro + "Abrir em nova aba" (link direto).
- Navegador que bloqueia PDF em iframe → o botao "Abrir em nova aba" garante acesso.
- Fase 1 → Fase 2: itens antigos (so `url`) continuam validos; `storagePath` vazio significa "URL externa, nao gerenciada pelo Storage" (nao tentar deletar binario ao remover).

---

## 9. Impacto em calculos

**Nenhum.** `documents` e metadado puramente documental. Nao e lido por `excelCalc`, `armorState`, `skillBonus`, progressao ou qualquer derivado. Sem alteracao de formula.

---

## 10. Criterios de aceitacao

1. Card "Documentos (PDF)" na aba Geral lista os PDFs da ficha.
2. Com `canEdit`: adicionar (URL na Fase 1; upload na Fase 2), renomear e remover.
3. Sem `canEdit`: apenas abrir/visualizar.
4. "Abrir PDF" exibe o documento em popup; "Abrir em nova aba" funciona como fallback.
5. `documents` persiste e reidrata; fichas antigas abrem com lista vazia.
6. Nenhum derivado de `excelCalc` muda.
7. Fase 2: arquivo nao-PDF ou acima do limite e rejeitado (UI + `storage.rules`).

---

## 11. Plano de implementacao (resumo, faseado)

**Fase 1 — PDF por URL (MVP):**
1. `defaultCharacter()`: `documents: []`.
2. `normalizeDocumentItem`/`normalizeDocuments`; chamar em `normalizeCharacter` e `sanitizeCharacterForPersist`.
3. UI: card "Documentos (PDF)" com lista editavel (URL + nome) no padrao `collapsibleItemCard`.
4. `openPdfPopup(url, name)` (iframe + fallback nova aba) + CSS `.pdf-popup-*`.

**Fase 2 — Upload via Storage (se necessario):**
5. Importar `firebase-storage` em `firebase.js`.
6. Upload para `characters/{id}/documents/...`; salvar `url`/`storagePath`/`size`/`uploadedAt`.
7. Criar `storage.rules` (tipo/size/posse) e publicar.
8. Excluir binario no Storage ao remover item com `storagePath`.

---

## 12. Riscos

- **Storage rules de posse** sao mais fracas que as de Firestore (nao leem o doc). Mitigar com path por `uid` (secao 6.2).
- **iframe de PDF** pode ser bloqueado por alguns navegadores/extensoes → fallback "nova aba" e obrigatorio.
- **Custo/limpeza:** remover item deve remover o binario (Fase 2) para evitar arquivos orfaos.

*Documento de especificacao. Nenhuma alteracao de codigo foi realizada.*
