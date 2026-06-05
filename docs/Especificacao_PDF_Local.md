# Especificação Técnica — PDF Local no Navegador (IndexedDB)

**Data:** 2026-06-05
**Tipo:** especificação técnica. **Não implementar.**
**Fontes:** `docs/NiarTale_Documento_Continuidade.md`, `docs/Especificacao_Midia_URL.md`, `docs/Auditoria_Migracao_Midia_URL.md`, código `app.js`, `firebase.js`.

---

## 1. Contexto e objetivo

O projeto permanece no plano **Spark** (sem Firebase Storage, sem Blaze). Hoje os PDFs são apenas **referências por URL externa** (`documents[].url`), o que exige hospedar o arquivo em algum serviço de terceiros.

**Objetivo:** permitir **upload direto de PDF dentro da ficha**, sem Firebase Storage, sem Blaze e **sem depender de link externo**, armazenando o **binário localmente no navegador** (IndexedDB) e mantendo no Firestore **apenas metadados leves**.

### 1.1 Princípios

1. O **binário** do PDF vive **somente no navegador** do usuário (IndexedDB), nunca no Firestore.
2. O **Firestore** guarda apenas **metadados e referências leves** (`id`, `name`, `source`, `localId`, `size`, `mime`).
3. A ficha continua funcionando **mesmo sem sincronização entre dispositivos** (o binário simplesmente não estará disponível em outro device; metadado sim).
4. A persistência dura **enquanto os dados locais do navegador não forem apagados**.
5. **Convivência total** com o modelo atual de **PDF por URL** (legado e externo).

### 1.2 Restrições (herdadas e obrigatórias)

- **Não** usar Firebase Storage.
- **Não** usar `storage.rules`.
- **Não** introduzir cobrança / **não** exigir upload em serviço externo.
- **Não** alterar `excelCalc`, cálculos, permissões, `firestore.rules`.
- **Não** alterar combate, raça/sub-raça, equipamentos, armaduras, progressão, resistências.
- PDFs são **metadados visuais**: nenhum impacto mecânico.

---

## 2. Visão geral da arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│ Navegador do usuário                                          │
│                                                              │
│  IndexedDB (dedicado: "niartale-media")                      │
│  └─ store "pdfs": { localId → { blob, name, size, mime, ... }}│
│                       ▲              │                        │
│            putPdfBlob │              │ getPdfBlob             │
│                       │              ▼                        │
│  app.js  ── upload ───┘     URL.createObjectURL(blob)        │
│     │                              │                          │
│     │ metadados                    ▼                          │
│     ▼                       popup móvel/redimensionável       │
│  Firestore characters/{id}.documents[]                       │
│  (id, name, source, localId, size, mime, url?)               │
└──────────────────────────────────────────────────────────────┘
```

- **Binário:** IndexedDB local (não sincroniza, não conta no Firestore).
- **Metadado:** Firestore (sincroniza entre dispositivos do mesmo dono/Mestre).
- **Abertura:** `Blob` → object URL → `iframe` em janela flutuante; ou URL externa direta (legado).

> Nota: o IndexedDB usado aqui é um **banco próprio do app**, separado do IndexedDB interno do Firestore (`enableIndexedDbPersistence`). Não há acoplamento entre os dois.

---

## 3. Modelo de dados

### 3.1 Metadado no Firestore (`documents[]`)

Cada item de `documents` passa a ter um campo discriminador **`source`**:

```js
documents: [
  {
    id,            // uid("doc") — já existente
    name,          // rótulo amigável — já existente
    source,        // "local" | "url"   (default "url" p/ compatibilidade)

    // quando source === "local":
    localId,       // chave no IndexedDB (uid("pdf"))
    size,          // bytes (metadado informativo)
    mime,          // "application/pdf"

    // quando source === "url":
    url            // URL externa (legado e novos por URL)
  }
]
```

Regras de discriminação (sem migração eager):
- Item **sem** `source` e **com** `url` → tratado como `source: "url"` (legado).
- Item **sem** `source` e **com** `localId` → tratado como `source: "local"`.
- Campos legados `storagePath`/`size`/`uploadedAt` (de fichas Storage antigas) continuam **preservados pelo spread** e **ignorados** pela lógica, como já ocorre hoje.

> O Firestore **nunca** armazena o binário nem base64 do PDF (limite de 1 MB por documento e custo de banda). Apenas a referência `localId`.

### 3.2 Registro no IndexedDB (binário)

- **Banco:** `niartale-media` (versão 1).
- **Object store:** `pdfs`, `keyPath: "localId"`.
- **Índice opcional:** `characterId` (para limpeza/GC por ficha).

```js
// registro em store "pdfs"
{
  localId,        // uid("pdf") — igual ao documents[].localId
  characterId,    // id da ficha dona (para GC e isolamento lógico)
  blob,           // Blob (application/pdf) — o binário
  name,           // nome original/amigável
  size,           // bytes
  mime,           // "application/pdf"
  createdAt       // ISO string
}
```

### 3.3 Estado de UI do popup (opcional, local)

Persistido em **`localStorage`** (não no Firestore), chave global:

```js
// localStorage["niartale.pdfWindow"]
{
  x, y,          // posição
  w, h,          // dimensões
  maximized,     // bool
  minimized      // bool (opcional)
}
```

Decisão recomendada: **um único estado de janela global** (última posição/tamanho usados), não por documento, para simplicidade. É puramente cosmético e local.

---

## 4. Normalização (compatibilidade lazy/aditiva)

`normalizeDocumentItem(item)` passa a garantir:

```js
function normalizeDocumentItem(item) {
  const src = item && typeof item === "object" ? item : {};
  const hasLocal = Boolean(src.localId);
  const source = src.source || (hasLocal ? "local" : "url");
  return {
    ...src,                       // preserva campos legados (storagePath, uploadedAt...)
    id: src.id || uid("doc"),
    name: String(src.name ?? ""),
    source,                       // "local" | "url"
    url: String(src.url ?? ""),   // mantido p/ url e p/ fallback
    localId: String(src.localId ?? ""),
    size: Math.max(0, Number(src.size || 0)),
    mime: String(src.mime || (source === "local" ? "application/pdf" : "")),
  };
}
```

- **Aditivo:** não apaga nada de fichas antigas.
- **Sem migração eager:** fichas só ganham `source`/`localId` ao serem salvas naturalmente.
- `normalizeDocuments(list)`, chamada em `normalizeCharacter()` (carga) e `sanitizeCharacterForPersist()` (save), permanece igual em estrutura.

---

## 5. Camada de acesso ao IndexedDB (proposta de helpers)

Helpers novos em `app.js` (ou módulo `mediaDb.js`), **sem dependência externa** (IndexedDB nativo):

| Helper | Responsabilidade |
|---|---|
| `openMediaDb()` | Abre/cria `niartale-media` v1, store `pdfs` (keyPath `localId`, índice `characterId`). Retorna Promise<IDBDatabase>. Cacheia a conexão. |
| `putPdfBlob(record)` | Grava `{ localId, characterId, blob, name, size, mime, createdAt }`. |
| `getPdfBlob(localId)` | Retorna o registro (ou `null` se inexistente). |
| `deletePdfBlob(localId)` | Remove o registro. Best-effort (não falha o fluxo se ausente). |
| `listPdfBlobs(characterId)` | (Opcional) lista `localId`s de uma ficha — útil para GC. |

Comportamento de erro: se IndexedDB estiver indisponível (janela privada/bloqueado), os helpers devem **falhar graciosamente** com `toast` e **não** quebrar a ficha (PDFs locais ficam indisponíveis; URL externa continua funcionando).

---

## 6. Fluxos

### 6.1 Fluxo de upload (PDF local)

1. UI: card "Documentos (PDF)" passa a ter **dois** botões de adicionar:
   - `+ PDF por URL` (já existente);
   - `Enviar PDF (local)` → dispara `<input type="file" accept="application/pdf">`.
2. Ao escolher arquivo:
   - validar `canEdit(c)` e limite de quantidade (`MAX_PDFS_PER_CHARACTER = 10`);
   - validar tipo (`file.type === "application/pdf"` ou extensão `.pdf`);
   - validar tamanho contra limite client-side (ver §9, ex.: `MAX_PDF_LOCAL_BYTES = 25 MB`);
3. gerar `localId = uid("pdf")`;
4. `putPdfBlob({ localId, characterId: c.id, blob: file, name, size: file.size, mime: "application/pdf", createdAt })`;
5. adicionar metadado a `documents[]`:
   `{ id: uid("doc"), name: <nome do arquivo sem .pdf>, source: "local", localId, size, mime: "application/pdf" }`;
6. `saveChar(c, "PDF enviado")` → Firestore grava **somente o metadado**;
7. `render()`.

> Importante: o upload local **não** exige que a ficha já exista no servidor para gravar o blob (IndexedDB é local). Porém, como o metadado precisa ser salvo, manter a exigência atual de ficha salva é aceitável; alternativamente, o blob pode ser gravado e o metadado persistido no próximo save. **Recomendado:** exigir ficha salva (id válido) para manter `characterId` consistente no IndexedDB.

### 6.2 Fluxo de abertura

Função única `openDocument(item)`:

- **`source === "local"`:**
  1. `rec = await getPdfBlob(item.localId)`;
  2. se `rec?.blob`: `objectUrl = URL.createObjectURL(rec.blob)` → abrir **janela flutuante** (§7) com `iframe.src = objectUrl`; **revogar** o object URL ao fechar a janela;
  3. se **não** encontrado (outro dispositivo / dados apagados / janela privada):
     - se houver `item.url` → oferecer fallback URL (popup/nova aba);
     - senão → mensagem clara: *"PDF local não disponível neste navegador. Reenvie o arquivo neste dispositivo."*
- **`source === "url"`:** comportamento atual — `openPdfPopup(item.url, item.name)` e `openPdfInNewTab(item.url)`.

A "Nova aba" para PDF local usa o object URL (`window.open(objectUrl)`), com revogação adiada (o navegador detém a aba). Para simplicidade e robustez, recomenda-se que "Nova aba" do PDF local **gere um object URL próprio** sob demanda.

### 6.3 Fluxo de persistência

| Dado | Onde persiste | Sincroniza entre dispositivos? |
|---|---|---|
| Binário do PDF | IndexedDB local (`niartale-media`) | **Não** |
| Metadado (`documents[]`) | Firestore (`characters/{id}`) | **Sim** |
| Estado da janela (pos/tam) | `localStorage` | **Não** |

- Ao **remover** um documento local (`removeDocument`): remover metadado de `documents[]` **e** chamar `deletePdfBlob(localId)` (best-effort). Sem `deleteObject` de Storage (não existe).
- Ao **duplicar ficha** (`duplicateCharacter`): ver §8.

### 6.4 Fallback para URLs legadas

- Itens legados (`source: "url"`, ou sem `source` mas com `url`) seguem **exatamente** o comportamento atual: popup `iframe` + "Abrir em nova aba".
- Itens legados de Storage (com `storagePath`/`url` tokenizada) são tratados como `source: "url"`; se a URL não resolver, o popup mostra erro + nova aba (comportamento já existente).
- Nenhuma reescrita de fichas antigas.

---

## 7. Janela/popup do PDF (móvel, redimensionável, min/max)

Evolução do `openPdfPopup` atual para uma **janela flutuante** (não modal bloqueante):

| Recurso | Implementação proposta |
|---|---|
| **Mover** | Barra de título arrastável (pointer events; atualiza `transform`/`left`/`top`). |
| **Redimensionar** | `resize: both` em CSS no container **ou** handle inferior-direito custom; min-width/min-height definidos. |
| **Minimizar** | Colapsa para apenas a barra de título (esconde `iframe`); botão restaurar. |
| **Maximizar** | Expande para viewport (`position: fixed; inset: 0`); botão restaurar volta ao tamanho anterior. |
| **Fechar** | Remove a janela e **revoga** object URL (se local). |
| **Nova aba** | `openPdfInNewTab` (URL) ou object URL (local) — fallback sempre disponível. |
| **Persistir estado** | Salva `x/y/w/h/maximized` em `localStorage` ao mover/redimensionar/fechar; restaura na próxima abertura. |

Acessibilidade: `role="dialog"`, fechar por `Esc`, foco inicial no botão fechar (manter padrão atual). Diferença em relação ao atual: **não** é modal com overlay bloqueante (para permitir mover/usar a ficha atrás, se desejado) — decisão de produto; aceitável manter overlay leve não bloqueante.

> Reuso: o mesmo container de janela pode futuramente servir imagens (mesma arquitetura "mídia local/URL"). Fora de escopo aqui.

---

## 8. Duplicação de ficha (`duplicateCharacter`)

Problema: dois `documents[]` apontando para o **mesmo** `localId` fariam a remoção em uma cópia apagar o blob da outra (mesmo risco do antigo I1, agora em IndexedDB).

**Estratégia recomendada (clonagem do binário):**
1. Para cada item `source: "local"` da cópia:
   - `rec = await getPdfBlob(item.localId)`;
   - se existir: gerar `newLocalId = uid("pdf")`, `putPdfBlob({ ...rec, localId: newLocalId, characterId: <novo id da cópia> })`, e ajustar `item.localId = newLocalId`;
   - se não existir (binário ausente): manter metadado com `localId` apontando para nada → abertura cairá no fallback ("não disponível").
2. Itens `source: "url"` são copiados como hoje (apenas `url`).

**Alternativa mais simples (aceitável):** na cópia, **descartar** os PDFs locais (converter para entradas vazias/avisar) — porém perde o conteúdo. **Recomendado:** clonar o blob para garantir isolamento total e preservação, sem referência destrutiva compartilhada.

> Observação: como `duplicateCharacter` cria o doc com `addDoc` (id gerado pelo servidor), o `characterId` do novo blob só é conhecido após a criação. Ajuste de ordem: criar a ficha, obter o id, então clonar blobs e atualizar `documents[].localId` num segundo `updateDoc`. (Detalhe de implementação; registrado aqui para evitar referência destrutiva.)

---

## 9. Limites e validação

| Limite | Valor proposto | Onde |
|---|---|---|
| PDFs por ficha | 10 (`MAX_PDFS_PER_CHARACTER`, já existe) | UI desabilita adicionar |
| Tamanho por PDF local | ~25 MB (`MAX_PDF_LOCAL_BYTES`, configurável) | validação no upload |
| Tipo | `application/pdf` | validação no upload |
| Tamanho de `name` | ~120 chars | validação leve |
| Tamanho de `url` (legado/externo) | ~2 KB | validação leve |

- O limite de 25 MB é **client-side** e protege a cota do IndexedDB; ajustável.
- Não há limite de banda (binário nunca trafega para o Firebase).

---

## 10. Segurança e permissões

- **Sem mudança** em `firestore.rules`, `canEdit`, ownership ou compartilhamento.
- O binário local **não** está sujeito a regras de servidor (é local ao navegador). Risco aceitável: quem tem acesso físico ao navegador acessa os blobs — mesmo modelo de confiança de qualquer dado local.
- `documents[]` continua coberto pelas regras existentes da coleção `characters`.
- Object URLs devem ser **revogados** ao fechar a janela para evitar vazamento de memória.

---

## 11. Riscos

| Risco | Severidade | Mitigação |
|---|---|---|
| Binário **não sincroniza** entre dispositivos | Esperado (por design) | Fallback claro: "PDF local não disponível neste navegador"; metadado continua visível |
| Dados locais apagados (limpar navegador, modo privado, troca de máquina) | Médio | Mensagem de fallback; opção de reenviar; documentar comportamento |
| Cota de IndexedDB excedida | Médio | Limite de 25 MB/arquivo + 10 arquivos; tratar erro de quota com `toast` |
| IndexedDB indisponível (janela privada/bloqueado) | Baixo | Degradação graciosa; URL externa continua funcionando |
| Metadado referencia `localId` inexistente | Baixo | Abertura cai no fallback; sem crash |
| Duplicação compartilhar blob (novo "I1") | Médio | Clonagem de blob na cópia (§8) |
| Vazamento de memória por object URL não revogado | Baixo | Revogar no `close()` da janela |
| `characterId` indefinido em ficha não salva | Baixo | Exigir ficha salva para upload local |

---

## 12. Limitações conhecidas

- **Sem sincronização** do conteúdo entre dispositivos/navegadores (apenas metadado sincroniza).
- Conteúdo é **efêmero** em relação à durabilidade do armazenamento local (sujeito a limpeza do usuário/navegador).
- Não há backup automático do binário; perda local = perda do arquivo (a menos que também exista `url`).
- Modo privado/anônimo pode limitar ou impedir IndexedDB.

---

## 13. Compatibilidade (resumo)

| Cenário | Comportamento |
|---|---|
| Ficha sem `documents` | `normalizeDocuments` → `[]` (lazy) |
| Ficha com PDF por URL | `source:"url"`; popup/nova aba como hoje |
| Ficha com PDF legado de Storage | tratado como `source:"url"`; campos legados preservados/ignorados |
| Ficha aberta em **outro** dispositivo | metadados aparecem; PDF local → fallback "não disponível" |
| Ficha duplicada | blobs locais clonados com novo `localId` (isolamento total) |

Nenhuma migração eager. Tudo lazy/aditivo.

---

## 14. Impactos

- **Cálculos:** nenhum (`excelCalc`, HP, PP, combate, raça/sub-raça, equipamentos, armaduras, progressão, resistências, campos extras intocados).
- **Permissões:** inalteradas.
- **Persistência:** Firestore (metadado) + IndexedDB local (binário) + localStorage (estado de janela).
- **Custo:** zero (Spark-friendly; nenhum tráfego de binário para o Firebase).

---

## 15. Critérios de aceite

1. Upload direto de PDF grava o **binário em IndexedDB** e apenas **metadado no Firestore** (nenhum binário/base64 no Firestore).
2. Lista de PDFs da ficha exibe itens **locais** e **por URL**, distinguíveis.
3. Abertura de PDF local em **janela móvel**, **redimensionável**, com **minimizar/maximizar**, **fechar** e **nova aba**.
4. Estado da janela (posição/tamanho/maximizado) **persiste no mesmo navegador** (localStorage) entre aberturas.
5. PDFs antigos por **URL** continuam abrindo (popup + nova aba) sem regressão.
6. Fichas antigas **sem `documents`** carregam sem erro (`[]`).
7. Fichas legadas com `storagePath`/`size`/`uploadedAt` carregam sem erro (campos preservados/ignorados).
8. PDF local **não disponível** (outro dispositivo/dados apagados) exibe **fallback** claro; ficha não quebra.
9. **Remover** PDF local apaga metadado **e** blob local (best-effort); remover PDF por URL apaga só o metadado.
10. **Duplicar** ficha **não** compartilha referência destrutiva ao mesmo blob (clonagem com novo `localId`).
11. `excelCalc`, `firestore.rules`, permissões, combate, raça/sub-raça, progressão **inalterados**.
12. **Sem** Firebase Storage, **sem** `storage.rules`, **sem** dependência de serviço externo, **sem** cobrança.

---

## 16. Plano de implementação (resumo, quando aprovado)

1. Módulo IndexedDB (`openMediaDb`/`putPdfBlob`/`getPdfBlob`/`deletePdfBlob`).
2. Estender `normalizeDocumentItem` com `source`/`localId`/`mime`/`size` (aditivo).
3. UI: botão "Enviar PDF (local)" + input file; manter "+ PDF por URL".
4. `openDocument(item)` despachando local vs url; janela flutuante (mover/resize/min/max) com persistência em localStorage.
5. `removeDocument`: apagar blob local quando `source:"local"`.
6. `duplicateCharacter`: clonar blobs locais com novo `localId` (segundo `updateDoc` após obter o id).
7. Limites: `MAX_PDF_LOCAL_BYTES`; reaproveitar `MAX_PDFS_PER_CHARACTER`.
8. Atualizar documentação (`NiarTale_Documento_Continuidade.md`, seção 7.9.1).

---

*Documento de especificação. Nenhuma alteração de código foi realizada.*
