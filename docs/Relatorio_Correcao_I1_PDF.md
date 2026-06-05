# Relatorio de Correcao — I1 (Duplicar ficha compartilha binario do Storage)

**Data:** 2026-06-05
**Base:** `docs/Auditoria_PDF_Ficha.md` item I1
**Escopo:** correcao cirurgica em `duplicateCharacter()`. Nenhuma outra alteracao.

---

## 1. Problema

`duplicateCharacter()` copiava `documents[]` integralmente, incluindo `storagePath` apontando para `characters/{ID_ORIGINAL}/documents/...`.

Consequencias:

- `removeDocument` na copia chamava `deleteObject(storagePath)` no arquivo fisico da ficha **original** (destruicao de dado).
- `uploadPdfDocument` (substituicao) na copia apagava o arquivo original antes de enviar o novo.
- A regra de Storage (`storage.rules`) teria comportamento imprevisivel: o path permanece associado ao `characterId` original, que pode ter dono diferente da copia.

## 2. Estrategia adotada

**Limpar `storagePath` na copia, preservar `url`.**

- A `url` (download URL do Storage) e mantida → o PDF continua acessivel como referencia somente leitura na copia.
- `storagePath: ""` elimina a referencia destrutiva → nenhuma operacao na copia pode atingir o arquivo original.
- Efeito para o usuario da copia: o documento aparece como "URL externa" (meta exibida em `buildDocumentCard`), podendo abrir/visualizar normalmente, e nao pode substituir sem reenviar o arquivo.
- Nenhuma alteracao em `firestore.rules`, `storage.rules`, calculos ou permissoes.

## 3. Alteracao realizada

**Arquivo:** `app.js` — funcao `duplicateCharacter()`.

Trecho inserido apos `sanitizeCharacterForPersist(copy)` e antes do `addDoc`:

```js
// I1: limpar storagePath dos documentos copiados para que remover/substituir
// PDF na copia nunca apague o arquivo fisico da ficha original. A url e
// preservada para que o PDF continue acessivel como referencia somente leitura.
if (Array.isArray(copy.documents)) {
  copy.documents = copy.documents.map((docItem) => ({
    ...docItem,
    storagePath: "",
  }));
}
```

## 4. Comportamento antes e depois

| Acao na copia | Antes (com bug) | Depois (corrigido) |
|---|---|---|
| Visualizar PDF | funciona | funciona |
| Abrir em nova aba | funciona | funciona |
| Remover PDF | **apagava binario do original** | remove apenas metadado da copia; nenhum arquivo e deletado do Storage |
| Substituir PDF | **apagava binario do original** antes de enviar novo | envia novo arquivo no path da copia sem tocar no original |
| `meta` exibida | "arquivo enviado" | "URL externa" |

## 5. Compatibilidade

- Fichas existentes (nao copiadas): sem impacto.
- Fichas copiadas antes da correcao: ainda carregam com `storagePath` do original; o risco persiste para copias antigas, mas nao ha migracao retroativa (sem eager). Recomendacao: identificar e editar manualmente se necessario.
- Duplicacao futura: isolamento garantido.

## 6. Verificacao

- Linter: sem erros em `app.js`.
- Sintaxe ES module: `node --input-type=module --check < app.js` → exit 0.
- Calculos: `excelCalc` intocado.
- Regras: `firestore.rules`, `storage.rules` nao alterados.

---

*Correcao minima e cirurgica. Nenhuma outra alteracao foi realizada.*
