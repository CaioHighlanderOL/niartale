# Auditoria — PDFs na Ficha

**Data:** 2026-06-05
**Fontes:** `docs/Especificacao_PDF_Ficha.md`, `docs/Relatorio_Implementacao_PDF_Ficha.md`, codigo `app.js`, `firebase.js`, `storage.rules`, `firebase.json`
**Natureza:** auditoria independente. **Nao implementar.**

---

## 1. Upload

- Validacao de tipo (`application/pdf` ou extensao `.pdf`) e tamanho (`MAX_PDF_BYTES = 10 MB`) em `uploadPdfDocument` (`app.js:1686-1688`). **OK.**
- Guarda contra ficha nao salva (`c.id === "new"`) (`app.js:1684`). **OK.**
- Limite de 10 respeitado em adicao (URL e upload) e refletido na UI (botoes desabilitados) (`app.js:1062,1075,1689`). **OK.**
- Caminho previsivel `characters/{id}/documents/{docId}-{arquivo}.pdf` com `safeStorageFileName` (sanitiza acentos/caracteres/`/`). **OK.**
- Substituicao: ao reenviar, apaga o binario anterior se `storagePath` mudou (`app.js:1717-1719`). **OK.**
- `contentType: "application/pdf"` enviado no `uploadBytes`. **OK.**
- Erros de upload sao capturados com toast e log (`app.js:1724-1727`). **OK.**

## 2. Persistencia

- `documents[]` em `characters/{id}` (metadado), binario no Storage — separacao conforme spec. **OK.**
- `defaultCharacter()` inclui `documents: []`; `normalizeCharacter()` e `sanitizeCharacterForPersist()` chamam `normalizeDocuments` (lazy/aditivo). **OK.**
- `normalizeDocumentItem` garante `id`, strings, `size >= 0`, `uploadedAt|null`. **OK.**
- Save via `saveChar`/`updateArrayItem`/`scheduleCharSave` (mesmo fluxo das demais listas). **OK.**

## 3. Abertura em popup

- `openPdfPopup` (`app.js:2115+`): overlay `role="dialog"`/`aria-modal`, fecha por overlay/Esc/botao, `iframe` sob demanda, `onerror` com fallback + "Abrir em nova aba". **OK.**
- `openPdfInNewTab` usa `window.open(..., "noopener")` e zera `opener`. **OK.**
- Botoes "Abrir PDF"/"Nova aba" desabilitados quando `url` vazio (`app.js:1108-1111`). **OK.**

## 4. Permissoes

- Frontend: adicionar/editar/upload/remover exigem `canEdit` (`app.js:1670,1683,1731`, botoes `disabled`); visualizar liberado a quem ve a ficha. **OK.**
- `storage.rules`: leitura/escrita/delete restritas a dono da ficha (`characters/{id}.ownerId`) ou Mestre; create/update exigem `application/pdf` e `<= 10 MB`. **OK.**
- Sintaxe cross-service `firestore.get(/databases/(default)/documents/...)` correta para regras de Storage. **OK.**

## 5. Compatibilidade

- Fichas antigas sem `documents` → `[]` (lazy, sem eager). **OK.**
- Documentos por URL externa (sem `storagePath`) coexistem com enviados; remover URL externa nao tenta apagar binario. **OK.**
- `firestore.rules` inalterado (campo novo ja coberto). **OK.**

## 6. Riscos / achados classificados

### Criticos
- Nenhum.

### Importantes
- **I1 — Duplicar ficha compartilha o binario do Storage — CORRIGIDO** (`docs/Relatorio_Correcao_I1_PDF.md`). `duplicateCharacter()` agora limpa `storagePath` de todos os documentos da copia antes do `addDoc`. A `url` e preservada (PDF continua acessivel como referencia somente leitura). Remover/substituir PDF na copia nunca toca o arquivo fisico da ficha original.

### Menores
- **M1 — Campo URL sem `refresh`.** Apos colar a URL em um PDF novo, "Abrir PDF"/"Nova aba" so habilitam no proximo render (o estado `disabled` foi calculado com `url` vazio). Funcional, mas exige recolher/expandir para liberar os botoes. (`app.js:1108-1121`)
- **M2 — Download URL tokenizada e acessivel por link.** `getDownloadURL` gera URL com token que **ignora** a regra `allow read` para quem ja possui o link. A distribuicao do link e protegida pelo Firestore (so dono/Mestre leem `documents[].url`), mas a regra de leitura do Storage da uma falsa sensacao de bloqueio estrito. Comportamento padrao do Firebase; documentar.
- **M3 — Sem teste real de upload nesta entrega.** Depende de Storage habilitado no projeto e deploy de `storage.rules`. Pendencia operacional ja registrada no relatorio.
- **M4 — Possivel save concorrente.** `uploadPdfDocument`/`removeDocument` chamam `saveChar` enquanto pode haver debounce pendente de edicao de nome/URL; baixo impacto (ultimo save vence). 

## 7. Impacto em calculos

**Nenhum.** `documents` nao e lido por `excelCalc`, `armorState`, `skillBonus` ou progressao. `node --input-type=module --check` e linter sem erros.

---

## 8. Conformidade com requisitos

| Requisito | Status |
|---|---|
| Upload/anexo | ✓ (URL + Storage) |
| Abertura em popup | ✓ (+ fallback nova aba) |
| Persistencia | ✓ |
| Permissoes (front + Storage) | ✓ |
| Compatibilidade com fichas antigas | ✓ |
| Sem impacto em calculos | ✓ |
| Duplicacao sem efeitos colaterais | ✓ (I1 corrigido) |

---

## 9. Conclusao

Upload, persistencia, popup, permissoes e compatibilidade funcionam conforme a especificacao, sem impacto em calculos. Nao ha achado Critico. Ha **um achado Importante (I1)** de potencial perda de dados ao duplicar fichas com PDFs enviados, alem de itens Menores.

## GO

I1 corrigido. Aprovado para producao apos habilitar o Storage e publicar `storage.rules`. Copias antigas criadas antes da correcao ainda carregam `storagePath` do original; identificar e editar manualmente se necessario (nao ha migracao retroativa).

*Fim da auditoria. Nenhuma alteracao de codigo foi realizada.*
