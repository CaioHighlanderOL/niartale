# Especificacao Tecnica — Sprint Imagens em Habilidades e Itens

**Data:** 2026-06-05
**Fontes:** `docs/NiarTale_Documento_Continuidade.md`, codigo `app.js`, `styles.css`
**Natureza:** especificacao. **Nao implementar.**

**Objetivo:** permitir anexar uma imagem a cada Habilidade e a cada Item de Inventario, com miniatura no card e visualizacao ampliada em popup.

---

## 0. Decisao de arquitetura: **URL salva no Firestore** (Fase 1)

| Opcao | Avaliacao | Veredito |
|---|---|---|
| **URL no Firestore** | Reusa exatamente o padrao ja existente de `avatarUrl` (`app.js:982`, `<img src=...>`). Zero infraestrutura nova, zero mudanca em `firestore.rules`, sem novo vetor de seguranca. | **ESCOLHIDA** |
| Upload para Firebase Storage | Requer habilitar Storage, escrever **Storage Rules** (novas, hoje inexistentes), logica de upload/progresso, limites de tamanho/tipo, limpeza de orfaos e custo. Maior superficie de risco. | Adiar (Fase 2 opcional) |
| Ambos | Soma a complexidade do Storage. | Nao agora |

**Justificativa de seguranca/simplicidade:** o app e estatico, sem build, com Firebase direto no front. `avatarUrl` ja prova o padrao de imagem por URL e funciona dentro das `characters` rules atuais (owner/Mestre). Adotar **URL no Firestore** mantem o mesmo modelo de permissao e nao introduz Storage Rules — a opcao mais segura para o projeto **agora**.

> **Fase 2 (opcional, fora deste escopo):** upload para Storage com Storage Rules espelhando as regras de `characters` (owner/Mestre), gravando a URL resultante no mesmo campo `imageUrl`. A UI e o modelo desta sprint ja ficam compativeis com isso (o campo continua sendo uma URL).

---

## 1. Modelo de dados

Adicionar um campo **`imageUrl`** (string, default `""`) por item:

```js
// abilities[]
{ id, name, cost, effects, description, observations, imageUrl }
// inventory[]
{ id, name, description, qty, weight, observations, imageUrl }
```

- Aditivo; nenhum campo existente muda.
- Equipamentos **fora do escopo** desta sprint (pode reusar o mesmo padrao depois).

---

## 2. Como anexar imagem

- No card do item (expandido), adicionar um campo de texto **"Imagem (URL)"** que edita `item.imageUrl`, no mesmo estilo do "Avatar URL" da aba Geral (`field(..., { refresh:true })`).
- Disponivel apenas para quem tem `canEdit` (input desabilitado caso contrario, como os demais campos do item).
- Colar a URL preenche a miniatura ao sair do campo / no proximo render.
- Sem upload de arquivo nesta fase (apenas URL).

---

## 3. Como visualizar miniatura

- Quando `item.imageUrl` estiver preenchido, exibir uma **miniatura** (`<img>`) no card do item — tamanho pequeno e fixo (ex.: 48–64px), recortada por CSS (`object-fit: cover`), reusando a linguagem visual do `.sprite-frame`.
- Quando vazio, **nao** renderizar a miniatura (sem placeholder pesado; opcionalmente um icone neutro discreto).
- A miniatura no cabecalho do card colapsavel e opcional; recomendacao: manter a miniatura no **corpo** do card para nao poluir o cabecalho compacto.

---

## 4. Como abrir em popup

- Clicar na miniatura abre um **popup/lightbox** simples (overlay) com a imagem ampliada.
- Como **nao existe** modal no projeto, criar um helper leve `openImagePopup(url, alt)`:
  - cria um overlay `position:fixed` cobrindo a tela, com a imagem centralizada (`max-width/max-height` ~90vw/90vh);
  - fecha ao clicar no overlay, no botao "x" ou com tecla `Esc`;
  - acessibilidade: `role="dialog"`, foco no botao fechar, `alt` na imagem.
- O overlay e efemero (criado/destruido no DOM); nao altera estado persistido.

---

## 5. Fallback (URLs invalidas / fichas antigas)

- **Campo ausente** (fichas antigas sem `imageUrl`): tratado como `""` → nenhuma miniatura. Sem erro.
- **URL quebrada/invalida:** o `<img>` recebe handler `onerror` que **oculta** a miniatura (ex.: `img.onerror = () => img.remove()` ou esconde o container), evitando icone de imagem quebrada.
- **URL nao-imagem:** mesmo tratamento de `onerror`.
- Sem bloqueio de tipos no front alem do fallback visual (URL livre, como `avatarUrl`).

---

## 6. Persistencia
- `item.imageUrl` persiste dentro de `abilities[]`/`inventory[]` no documento `characters/{id}`, via o fluxo atual (`updateArrayItem`/`scheduleCharSave`/`saveChar`).
- `normalizeCharacter`/`sanitizeCharacterForPersist`: garantir `imageUrl` como string (default `""`) ao normalizar itens (aditivo, idempotente). Opcional: helper de normalizacao de item.
- **Sem** mudanca em `firestore.rules` (campo dentro de `characters`, ja coberto por owner/Mestre).
- Nenhuma migracao eager.

---

## 7. Permissoes
- **Editar `imageUrl`:** apenas `canEdit` (owner/Mestre) — herdado do padrao dos campos de item (`input.disabled` quando sem permissao).
- **Ver miniatura/popup:** qualquer um que ja visualiza a ficha.
- Rules inalteradas: a permissao real continua na regra de `characters`.

---

## 8. Restricoes atendidas
- **Sem alteracao de calculos / regras / `excelCalc`:** imagem e puramente apresentacao; nenhum derivado depende de `imageUrl`.
- Compatibilidade total: campo aditivo, fallback para ausente/quebrado, sem migracao eager.

---

## 9. Arquivos afetados (quando implementado)

| Arquivo | Mudanca |
|---|---|
| `app.js` | `defaultCharacter` (itens de exemplo podem ganhar `imageUrl:""`); normalizacao de itens para garantir `imageUrl` string; `buildItemCard` (Habilidades/Inventario) → campo "Imagem (URL)" + miniatura com `onerror`; helper `openImagePopup`. |
| `styles.css` | Estilo da miniatura (reuso de `.sprite-frame`/novo `.item-thumb`) e do overlay/lightbox. |

**Nao alterar:** `excelCalc`, `armorState`, derivados, progressao, `firestore.rules`.

---

## 10. Riscos

| Risco | Severidade | Mitigacao |
|---|---|---|
| URL externa quebrada/lenta | Baixa | `onerror` oculta; `loading="lazy"` na miniatura |
| Conteudo impróprio via URL livre | Baixa | Mesmo modelo do `avatarUrl` atual; moderacao do Mestre |
| Popup sem fechar (foco preso) | Baixa | Fechar por overlay/Esc/botao; foco gerenciado |
| Peso de muitas imagens externas | Baixa | `loading="lazy"`; miniatura pequena; popup carrega full so ao abrir |

---

## 11. Testes necessarios

1. **Anexar:** colar URL valida em uma habilidade/item → miniatura aparece.
2. **Miniatura:** item sem `imageUrl` não mostra miniatura; com URL, mostra recortada.
3. **Popup:** clicar na miniatura abre overlay ampliado; fecha por clique/Esc/botao.
4. **Fallback:** URL quebrada → miniatura some (sem icone de imagem quebrada); ficha antiga sem campo abre normal.
5. **Persistencia:** salvar, recarregar → `imageUrl` mantido.
6. **Permissoes:** sem `canEdit`, campo de URL desabilitado; visualizacao de miniatura/popup permitida.
7. **Sem regressao mecanica:** nenhum derivado muda (cruzar com `Testes_Regressao.md`).

---

## 12. Fora de escopo
- Upload para Firebase Storage (Fase 2 opcional).
- Imagens em Equipamentos/Campos Extras (pode reusar o padrao depois).
- Edicao de imagem (crop/resize), multiplas imagens por item, galeria.
- Qualquer alteracao de calculo, regra ou `excelCalc`.

*Fim da especificacao. Nenhuma alteracao de codigo foi realizada.*
