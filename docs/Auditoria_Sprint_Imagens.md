# Auditoria — Sprint Imagens em Habilidades e Itens

**Data:** 2026-06-05
**Fontes:** `docs/Especificacao_Sprint_Imagens.md`, `docs/Relatorio_Implementacao_Sprint_Imagens.md`, codigo `app.js`, `styles.css`
**Natureza:** auditoria independente. **Nao implementar.**

---

## 1. Upload / anexo

- Decisao da spec = **URL no Firestore** (sem Storage). Implementado conforme: campo `field("Imagem (URL)", ...)` por item em `buildItemCard` (`app.js:1224-1227`), atualizando `imageUrl` por `id` via `updateArrayItem`.
- `addListItem` para abilities/inventory inclui `imageUrl:""` nos defaults (`app.js:1149,1163`).
- **Sem upload de arquivo / sem Firebase Storage** (coerente com o escopo Fase 1). **OK.**

## 2. Visualizacao (miniatura + popup)

- Miniatura condicional quando `imageUrl` preenchido: `<img loading="lazy">` com `onerror` removendo a imagem (`app.js:1229-1243`).
- Dois gatilhos de popup: clique na miniatura (`item-thumb-btn`) e botao "Abrir imagem" — ambos chamam `openImagePopup`.
- `openImagePopup(url, alt)` (`app.js:1901`): overlay `role="dialog"`/`aria-modal`, fecha por clique no overlay, botao "Fechar" e `Esc`; foco no botao fechar; fallback de erro com mensagem. **OK.**
- CSS: `.item-thumb-btn`, `.item-image-preview`, `.image-popup-overlay`, `.image-popup-box` presentes. **OK.**

## 3. Persistencia

- `imageUrl` persiste dentro de `abilities[]`/`inventory[]` no documento `characters/{id}` via `updateArrayItem`/`scheduleCharSave`/`saveChar`.
- Normalizacao garante `imageUrl` string no carregamento (`normalizeCharacter` → `normalizeAbilities`/`normalizeInventory`, `app.js:492-493`) e no salvamento (`sanitizeCharacterForPersist`, `app.js:263-264`). **OK.**

## 4. Compatibilidade com fichas antigas

- `normalizeAbilityItem`/`normalizeInventoryItem` aplicam `imageUrl: src.imageUrl ?? ""` (`app.js:410,423`), preservando demais campos.
- Migracao **lazy/aditiva**; sem eager; `firestore.rules` inalterado. Fichas sem o campo abrem normalmente. **OK.**

## 5. Permissoes

- Campo de URL: `field(..., { refresh:true, disabled: !canE })` (`app.js:1227`) → desabilitado sem `canEdit`. `updateArrayItem` tambem tem guarda `canEdit`.
- Miniatura/popup: visualizacao disponivel a qualquer um que ve a ficha (correto). `firestore.rules` inalterado mantem o bloqueio real. **OK.**

## 6. Ausencia de regressoes

- **Calculos/`excelCalc`:** `imageUrl` e metadado visual; nenhum derivado o consulta. `armorState`/`excelCalc` intocados. **Sem regressao.**
- **Normalizacao de inventario:** `normalizeInventoryItem` converte `qty`/`weight` com `Number(... ?? 0)`; itens default usam `qty:1`. Itens existentes preservam valores. Sem impacto em calculo (inventario nao alimenta `excelCalc`). **OK.**
- **Identidade visual:** miniatura pequena e popup reusam tokens; nenhum seletor existente alterado. **Sem regressao.**
- Sem erros de lint.

---

## 7. Achados classificados

### Criticos
- Nenhum.

### Importantes
- Nenhum.

### Menores
- **M1 — Input "Imagem (URL)" herda `--char-font`.** Por ser `.field input` (Sprint Fontes), o campo de URL pode exibir fonte decorativa. Cosmetico; nao afeta funcao. Impacto muito baixo.
- **M2 — URL livre sem validacao de tipo.** Igual ao `avatarUrl` atual; mitigado por `onerror`. Aceito.
- **M3 — Equipamentos/Campos Extras sem imagem.** Fora do escopo declarado da spec; nao e defeito.
- **M4 — Dependencia de host externo.** Imagem indisponivel cai no fallback (miniatura some / popup mostra erro). Aceito.

---

## 8. Conformidade com requisitos

| Requisito | Status |
|---|---|
| Anexo (URL) em Habilidades/Itens | ✓ |
| Visualizacao (miniatura + popup) | ✓ |
| Persistencia segura | ✓ |
| Compatibilidade com fichas antigas | ✓ |
| Permissoes preservadas | ✓ |
| Sem regressao em calculos/`excelCalc` | ✓ |
| Sem erros de lint | ✓ |

---

## 9. Conclusao

Anexo por URL, miniatura, popup, persistencia, compatibilidade e permissoes funcionam conforme a especificacao; o recurso e puramente visual e nao toca calculos, regras ou `excelCalc`. Nenhum achado Critico ou Importante; apenas Menores aceitos ou fora de escopo.

## GO

A Sprint Imagens esta aprovada para producao.

*Fim da auditoria. Nenhuma alteracao de codigo foi realizada.*
