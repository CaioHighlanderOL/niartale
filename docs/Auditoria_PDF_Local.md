# Auditoria — PDF Local no Navegador (IndexedDB)

**Data:** 2026-06-05
**Tipo:** auditoria de verificação (read-only). **Nenhum arquivo foi modificado.**
**Base:** `docs/Especificacao_PDF_Local.md`, `docs/Relatorio_Implementacao_PDF_Local.md`, código `app.js`, `styles.css`, `firebase.js`, `firestore.rules`.

---

## Sumário executivo

A implementação de PDF local está **funcional e completa** conforme a especificação. Upload direto grava o binário em IndexedDB dedicado (`niartale-media`), o Firestore recebe apenas metadados, e a janela flutuante suporta mover/redimensionar/minimizar/maximizar/fechar/nova aba. Compatibilidade com PDFs por URL e fichas legadas preservada. Nenhuma dependência de Firebase Storage. Sem regressões em cálculos, permissões ou regras.

**Veredito final: GO.**

Achados: **0 Críticos, 0 Importantes, 6 Menores** (todos cosméticos/informativos).

---

## 1. Upload direto

| Item | Verificação | Status |
|---|---|---|
| Seleção de arquivo | `<input type="file" accept="application/pdf">` oculto + botão "Enviar PDF (local)" em `renderDocuments` | OK |
| Validação de tipo | `addDocumentLocal`: `file.type === "application/pdf"` ou extensão `.pdf` | OK |
| Validação de tamanho | `file.size > MAX_PDF_LOCAL_BYTES` (25 MB) → toast e aborta | OK |
| Limite de quantidade | `MAX_PDFS_PER_CHARACTER = 10` checado antes de gravar | OK |
| Gravação local | `putPdfBlob({ localId, characterId, blob, name, size, mime, createdAt })` em IndexedDB | OK |
| Metadado | `documents[]` recebe `{ id, name, source:"local", localId, size, mime }`; binário **nunca** vai ao Firestore | OK |
| Persistência mesmo navegador | IndexedDB (`niartale-media`/`pdfs`, keyPath `localId`) | OK |
| Arquivos grandes dentro do limite | Aceita até 25 MB (limite da spec); `Blob`/`File` preservado por structured clone do IndexedDB | OK |
| Guarda de permissão | `canEdit(c)` no início | OK |
| Ficha salva exigida | `if (!c?.id || c.id === "new")` aborta com aviso | OK |

---

## 2. Janela/popup (`openPdfWindow`)

| Recurso | Implementação | Status |
|---|---|---|
| Abertura | Cria `.pdf-win` `position:fixed`; remove janela anterior (uma por vez) | OK |
| Movimento | `pointerdown/move/up` na barra de título + `setPointerCapture`; ignora botões e estado maximizado | OK |
| Redimensionamento | `resize: both` (CSS) + `ResizeObserver` persistindo `w/h` | OK |
| Minimizar | `toggleMinimize` → `.pdf-win--min` (oculta body/footer) | OK (ver M1) |
| Maximizar | `toggleMaximize` → `.pdf-win--max` (`100vw/100dvh`); alterna restaurando geometria | OK |
| Fechamento | Botão ✕, `Esc`, e remoção; revoga object URL se local; desconecta `ResizeObserver` | OK |
| Fallback nova aba | Botão "Nova aba" no rodapé + erro de `iframe` mostra mensagem + botão | OK |
| Persistência de estado | `localStorage["niartale.pdfWindow"]` (x/y/w/h/maximized) | OK |
| Acessibilidade | `role="dialog"`, `aria-label`, foco no fechar, fecha por `Esc` | OK |
| Erro de carregamento | `frame.onerror` → mensagem + "Nova aba" | OK |

---

## 3. Compatibilidade

| Cenário | Verificação | Status |
|---|---|---|
| Ficha sem `documents` | `normalizeDocuments(undefined)` → `[]`; `defaultCharacter().documents = []` | OK |
| PDFs antigos por URL | `source` inferido como `"url"` quando ausente; abre em janela/nova aba | OK |
| Documentos legados no Firestore (`storagePath`/`uploadedAt`) | Preservados pelo spread em `normalizeDocumentItem`, ignorados pela lógica | OK |
| Itens sem `source` mas com `localId` | Inferidos como `"local"` | OK |
| Ausência de quebra em fichas salvas | Normalização aditiva/lazy; nenhuma migração eager | OK |
| PDF local em outro dispositivo | Metadado visível; `getPdfBlob` → `null` → fallback URL ou `openPdfUnavailableDialog` | OK |

---

## 4. Persistência

| Fluxo | Verificação | Status |
|---|---|---|
| Load | `normalizeCharacter` → `documents: normalizeDocuments(data.documents ?? [])` (linha 587) | OK |
| Save | `saveChar` → `sanitizeCharacterForPersist` → `c.documents = normalizeDocuments(...)` (linha 335); só metadados em `updateDoc` | OK |
| Duplicação | `duplicateCharacter` clona cada blob local (`getPdfBlob` → `putPdfBlob` com novo `localId`) e regrava via `updateDoc` | OK (ver M2) |
| Normalização | `normalizeDocumentItem` garante `id/name/source/url/localId/size/mime` | OK |
| Sanitização | `normalizeDocuments` aplicado no caminho de persistência | OK |
| Após recarregar a página | Binário persiste no IndexedDB; metadado recarrega do Firestore; `openDocument` re-busca o blob por `localId` | OK |
| Blob nunca em Firestore | `documents[]` contém apenas metadados; binário isolado no IndexedDB | OK |

---

## 5. Segurança e isolamento

| Item | Verificação | Status |
|---|---|---|
| Sem Firebase Storage | `firebase.js` sem SDK Storage; nenhum `getStorage`/`storageRef`/`uploadBytes`/`deleteObject` | OK |
| Sem `storage.rules` | Arquivo inexistente | OK |
| `firestore.rules` | Não modificado | Sem regressão |
| Permissões | `addDocumentLocal`/`addDocumentUrl`/`removeDocument` mantêm `canEdit`; botões com `disabled` | Sem regressão |
| Ownership/compartilhamento | `duplicateCharacter` mantém atribuição de owner; sem alteração de regras | Sem regressão |
| `excelCalc` | Intocado | Sem regressão |
| Raça/sub-raça, combate, progressão, armaduras, resistências | Intocados (PDF é metadado visual) | Sem regressão |
| Isolamento de duplicata | Clonagem de blob com novo `localId` evita referência destrutiva compartilhada | OK |
| Revogação de object URL | `close()` revoga (janela); nova aba revoga após 10 s | OK (ver M3) |

---

## 6. Qualidade do código

### Verificações automáticas
- `ReadLints` (`app.js`, `styles.css`): **sem erros**.
- `node --input-type=module --check < app.js` → **exit 0**.
- Sem referências residuais a `openPdfPopup`, `MAX_PDF_BYTES`, `safeStorageFileName`, `uploadPdfDocument`, `.pdf-popup-*`.
- `formatBytes`: definido 1x (linha 1199), usado 1x (linha 1178) — sem duplicação.

### Achados

Nenhum **Crítico**. Nenhum **Importante**.

**Menores:**

- **M1 (cosmético — UI):** `.pdf-win` define `min-height: 180px`, mas `.pdf-win--min` não sobrescreve. Ao minimizar, a janela colapsa body/footer (`grid-template-rows: auto 0 0`) porém mantém ~180px de altura mínima, deixando uma área vazia abaixo da barra de título em vez de reduzir só ao cabeçalho. Funcional, mas a minimização não é visualmente completa. (Correção trivial: adicionar `min-height:auto`/`height:auto` em `.pdf-win--min`.)
- **M2 (informativo — persistência):** Em `duplicateCharacter`, o `addDoc` inicial grava `documents` com os `localId` originais e, em seguida, um `updateDoc` regrava com os `localId` clonados. Há uma janela de milissegundos em que a cópia referencia o mesmo `localId` do original. **Não é destrutivo**, pois a duplicação nunca chama `deletePdfBlob`; o estado final é totalmente isolado. Otimização opcional: montar `documents` clonados antes do `addDoc`.
- **M3 (baixo risco):** Em `openDocumentInNewTab`, o object URL local é revogado por `setTimeout(..., 10000)`. Para PDFs locais grandes em dispositivos lentos, 10 s pode (raramente) ser insuficiente antes do carregamento na nova aba. Risco baixo (blob local carrega rápido).
- **M4 (informativo):** Falhas de cota do IndexedDB caem no `catch` genérico de `putPdfBlob` → toast "Falha ao salvar PDF local". Não há mensagem específica de cota excedida. Aceitável.
- **M5 (informativo):** Existe cópia paralela em `work/repo/` desatualizada (sem o código de PDF local). Não faz parte do deploy (`firebase.json` hosting `public: "."` na raiz). Sem ação obrigatória.
- **M6 (trivial):** `toggleMinimize` não chama `persist()` (posição não muda ao minimizar). Por design; sem impacto.

### Riscos remanescentes (esperados por design)
- Binário **não sincroniza** entre dispositivos/navegadores (apenas metadado). Tratado com fallback claro.
- Conteúdo local é efêmero quanto à durabilidade do armazenamento (limpeza do navegador/modo privado). Documentado.

---

## 7. Conclusão

- **Upload direto, gravação local e persistência no mesmo navegador:** funcionais.
- **Janela flutuante (mover/redimensionar/min/max/fechar/nova aba):** funcional (1 ajuste cosmético em minimizar — M1).
- **Compatibilidade** com fichas antigas, PDFs por URL e documentos legados: preservada.
- **Persistência** (load/save/duplicação/normalização/sanitização/reload): correta.
- **Sem** dependência de Firebase Storage; **sem** regressão em permissões, cálculos, raça/sub-raça, combate, progressão ou resistências.

## Veredito

**GO**

*Auditoria concluída. Nenhum arquivo de código foi modificado; gerado apenas este relatório.*
