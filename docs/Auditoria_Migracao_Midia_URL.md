# Auditoria — Migração Firebase Storage → Mídia por URL

**Data:** 2026-06-05
**Tipo:** auditoria de verificação (read-only). **Nenhum arquivo de código foi modificado.**
**Base:** `docs/Especificacao_Midia_URL.md`, `docs/Relatorio_Migracao_Midia_URL.md`, `docs/NiarTale_Documento_Continuidade.md`, código `firebase.js`, `app.js`, `firebase.json`, `firestore.rules`, `index.html`, `styles.css`.

---

## Sumário executivo

A migração está **completa**. Não há nenhuma dependência funcional residual de Firebase Storage no código operacional do projeto (`firebase.js`, `app.js`, `firebase.json`). O arquivo `storage.rules` foi removido. O sistema de PDFs opera exclusivamente por URL externa persistida no Firestore. Fichas legadas (com ou sem `documents`, e com campos legados de Storage) carregam sem erro.

**Veredito final: GO.**

---

## 1. Remoção de Storage

### 1.1 Símbolos do SDK Storage

Varredura em `*.js`, `*.json`, `*.rules`, `*.html`, `*.css`:

| Símbolo | Ocorrências funcionais | Status |
|---|---|---|
| `getStorage` | 0 | Removido |
| `storageRef` | 0 | Removido |
| `uploadBytes` | 0 | Removido |
| `getDownloadURL` | 0 | Removido |
| `deleteObject` | 0 | Removido |
| `firebase-storage` (import) | 0 | Removido |
| `const storage` (export) | 0 | Removido |
| `uploadPdfDocument` | 0 | Removido |
| `safeStorageFileName` | 0 | Removido |
| `formatBytes` | 0 | Removido |
| `MAX_PDF_BYTES` | 0 | Removido |
| `<input type="file">` (PDF) | 0 | Removido |
| `storagePath` (uso lógico) | 0 | Removido (só citado em comentário) |

### 1.2 Únicas ocorrências do texto "storage" remanescentes

- `app.js:442` — **comentário** em `normalizeDocumentItem` explicando que chaves legadas são preservadas. Sem efeito funcional. **Aceitável.**
- `index.html:42` e `styles.css:252-263` — classe CSS `.storage-note`, painel de UI rotulado "Persistência" (texto: "Persistencia via Firebase Auth + Firestore"). **Não tem relação com Firebase Storage.** É nomenclatura de layout. **Sem regressão.**

### 1.3 `firebase.js`

- Import de `firebase-storage`: **ausente**.
- `export const storage = getStorage(app)`: **ausente**.
- Bloco de re-export: `deleteObject`/`getDownloadURL`/`storageRef`/`uploadBytes` **ausentes**.
- `app.js` importa apenas símbolos existentes em `firebase.js` (verificado: nenhum import morto).

### 1.4 `firebase.json`

- Bloco `"storage"`: **ausente**. Mantém apenas `firestore` + `hosting`.

### 1.5 `storage.rules`

- Arquivo **deletado** (confirmado: não existe no projeto).

**Resultado seção 1: sem dependências, imports mortos, helpers mortos, constantes não utilizadas ou referências indiretas.**

---

## 2. PDFs por URL

| Funcionalidade | Implementação | Status |
|---|---|---|
| Criação por URL | `addDocumentUrl` cria item `{ id, name:"Novo PDF", url:"" }`, respeita limite, salva e expande | OK |
| Edição de URL | `buildDocumentCard` → `field("URL", … { refresh:true, disabled:!canE })` | OK |
| Edição de Nome | `field("Nome", … { disabled:!canE })` | OK |
| Remoção | `removeDocument` apenas filtra `c.documents` (sem `deleteObject`) | OK |
| Persistência | `saveChar` grava `documents[]` no Firestore | OK |
| Carregamento | `normalizeCharacter` → `normalizeDocuments(data.documents ?? [])` | OK |
| Limite de quantidade | `MAX_PDFS_PER_CHARACTER = 10`; botão "+ PDF por URL" e `addDocumentUrl` bloqueiam ao atingir | OK |
| Popup | `openPdfPopup` (iframe + onerror → fallback nova aba + fechar por overlay/Esc/botão) | OK |
| Nova aba | `openPdfInNewTab` (`window.open(_blank, noopener)` + `opener=null`) | OK |
| Botões desabilitam sem URL | `if (!hasUrl) { openBtn.disabled = true; tabBtn.disabled = true; }` | OK |

Observação positiva: o `refresh:true` no campo URL (menor M1 da auditoria de PDF) foi aplicado — "Abrir PDF"/"Nova aba" reabilitam imediatamente após colar a URL.

---

## 3. Compatibilidade

| Cenário | Comportamento verificado | Status |
|---|---|---|
| Ficha sem `documents` | `normalizeDocuments(undefined)` → `[]` (`!Array.isArray` → `[]`); `defaultCharacter().documents = []` | OK |
| Ficha com PDFs por URL | `url` renderizada, aberta em popup/nova aba | OK |
| Ficha com `storagePath` legado | `normalizeDocumentItem` faz `{ ...src, id, name, url }` — spread **preserva** `storagePath`/`size`/`uploadedAt`; nenhuma lógica os lê | OK |
| Ficha com `size`/`uploadedAt` legados | Preservados pelo spread; ignorados pela UI | OK |
| URL legada do Storage que não resolve | `openPdfPopup` dispara `onerror` → mensagem + "Abrir em nova aba" | OK (degradação graciosa) |

Nenhuma migração **eager**: campos legados não são apagados nem reescritos proativamente; tratamento é lazy/aditivo.

---

## 4. Persistência

| Função | Verificação | Status |
|---|---|---|
| `saveChar` | Persiste via Firestore; sem chamada a Storage | OK |
| `normalizeCharacter` (load) | `documents: normalizeDocuments(data.documents ?? base.documents)` | OK |
| `sanitizeCharacterForPersist` (save) | `c.documents = normalizeDocuments(c.documents)`; sem lógica de Storage | OK |
| `duplicateCharacter` | Bloco I1 de limpeza de `storagePath` **removido**; cópia apenas replica metadados (`url` + legados inertes); **impossível** operação destrutiva sem `deleteObject` | OK |

**Não existe mais nenhuma lógica dependente de Storage no caminho de persistência.**

---

## 5. Reuso futuro (mídia por URL)

A arquitetura atual é reutilizável **sem Firebase Storage**:

| Alvo | Estado | Observação |
|---|---|---|
| Imagens em habilidades | Já existe (`imageUrl` + `openImagePopup` em `buildItemCard`) | Sem Storage |
| Imagens em itens | Já existe (`imageUrl`) | Sem Storage |
| Imagens em equipamentos | Não implementado | Reuso natural do mesmo padrão (`imageUrl` em `normalizeEquipmentItem` + `buildEquipmentCard`); escopo futuro, fora desta migração |
| PDFs | Migrado para URL nesta entrega | Consolidado |

O padrão "campo de URL + popup + nova aba" é agora o único modelo de mídia. **Confirmado: nenhuma necessidade de Firebase Storage para reuso futuro.**

---

## 6. Segurança

| Item | Verificação | Status |
|---|---|---|
| `firestore.rules` | **Não modificado** nesta migração | Sem regressão |
| Permissões de edição | `addDocumentUrl`/`removeDocument` mantêm guarda `canEdit(c)`; campos com `disabled: !canE` | Sem regressão |
| Ownership | Inalterado (`duplicateCharacter` mantém atribuição de `ownerId`/`ownerName`/`player`) | Sem regressão |
| Compartilhamento | Lógica de Mestre/dono inalterada | Sem regressão |
| Superfície de ataque | Reduzida (sem binários, sem `storage.rules`); conteúdo externo via URL — mesmo trade-off já aceito de `avatarUrl`/`imageUrl` | Melhoria |

---

## 7. Impacto sistêmico

Nenhuma alteração nas áreas abaixo (confirmado por ausência de edições e por `documents`/PDF serem metadados puros):

| Área | Status |
|---|---|
| `excelCalc` | Intocado |
| HP | Intocado |
| PP | Intocado |
| Combate | Intocado |
| Raça/Sub-raça | Intocado |
| Equipamentos | Intocado |
| Armaduras (`armorState`/`armorType`) | Intocado |
| Progressão (`exp`/`xp`/`lv`/`nvl`) | Intocado |
| Resistências (`buffs.physicalReduction`/`magicReduction`) | Intocado |
| Campos extras (`customFields`) | Intocado |

---

## 8. Qualidade do código

### Verificações automáticas
- `ReadLints` (`app.js`, `firebase.js`): **sem erros**.
- Sintaxe ES module: `node --input-type=module --check` em ambos → **exit 0**.

### Achados classificados

Nenhum **Crítico**. Nenhum **Importante**.

**Menores:**

- **M1 (cosmético):** Duas linhas em branco duplicadas após `addDocumentUrl`/`removeDocument` (`app.js:1647-1648`) e após `openPdfInNewTab` (`app.js:2073-2074`), resíduo das remoções. Sem impacto funcional.
- **M2 (informativo):** Comentário em `normalizeDocumentItem` (`app.js:442`) cita `storagePath`. É documentação intencional da preservação legada; não é dependência.
- **M3 (informativo):** Existe uma cópia paralela do projeto em `work/repo/` (com `index.html`/`styles.css`). A varredura confirmou que ela **não** contém referências a Firebase Storage. Não faz parte do deploy (`firebase.json` hosting `public: "."` na raiz). Recomenda-se apenas garantir que cópias auxiliares não sejam confundidas com a fonte; sem ação obrigatória.
- **M4 (informativo):** Nomenclatura `.storage-note` em `index.html`/`styles.css` pode induzir a achar que há relação com Firebase Storage, mas é apenas o painel de "Persistência". Renomear é opcional e puramente cosmético.

Nenhuma duplicação funcional, helper morto ou constante não utilizada remanescente. `MAX_PDFS_PER_CHARACTER` continua em uso legítimo (3 pontos).

### Riscos futuros
- URLs legadas de Storage param de resolver se o bucket for desativado — comportamento esperado e tratado por fallback. Não é regressão da migração.
- Conteúdo de PDF/imagem depende de hosts externos (disponibilidade/CORS para iframe). Trade-off já aceito pelo modelo de URL.

---

## 9. Conclusão

- **Migração completa:** SIM.
- **Projeto 100% livre de dependência operacional de Firebase Storage:** SIM. Compatível com o plano Spark.
- Compatibilidade legada preservada (lazy/aditiva); persistência apenas no Firestore; popup e nova aba mantidos; segurança e cálculos inalterados.

## Veredito

**GO**

*Auditoria concluída. Nenhum arquivo de código foi modificado; gerado apenas este relatório.*
