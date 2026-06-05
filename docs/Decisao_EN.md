# Decisao — Recurso EN / Energia

**Data:** 2026-06-05
**Fontes:** `docs/NiarTale_Documento_Continuidade.md`, `docs/Roadmap_Atualizado.md`, `docs/Planilha Original.xlsx` (via documento de continuidade), codigo `app.js`
**Natureza:** decisao de produto. **Nao implementar.**

---

## 1. Pergunta

Manter, deprecar ou remover o recurso **EN / Energia** da ficha, com base na planilha original e na utilidade real.

---

## 2. Evidencia de uso atual (codigo)

| Local | Trecho | Observacao |
|---|---|---|
| `defaultCharacter()` | `energy: { label:"EN", current:5, max:5, color:"#80ff72" }` (`app.js:455`) | Recurso embutido no padrao. |
| `resourceBars()` | `["hp","mp","energy","cash"]` (`app.js:1591`) | EN tem barra; `max` vem de `r.max` (fixo 5), **nao** de `excelCalc`. |
| `renderResources()` "Editar atuais" | `Object.entries(c.resources).map(...)` (`app.js:1338`) | Edicao **generica**: EN aparece porque esta no objeto, nao por codigo dedicado. |
| `normalizeCharacter()` | `resources: { ...base.resources, ...(data.resources||{}) }` (`app.js:489`) | EN e injetado/preservado no merge. |
| HUD topo | `hudStat("HP"...)`, `hudStat("MP"...)`, `hudStat("STATUS"...)` (`app.js:930-932`) | EN **nao** aparece no HUD. |
| `excelCalc()` | — | **EN nao e lido em nenhum calculo.** Zero acoplamento mecanico. |

**Conclusao tecnica:** acoplamento minimo. EN e um par `current/max` manual, exibido como barra e editavel pela tela generica de recursos. Nao alimenta nem e alimentado por nenhum derivado.

---

## 3. Analise da planilha original

- A planilha (aba `Ficha`) modela como recursos: **HP** (K24), **PP/MP** (K27) e **CASH** (G30/H30). Tambem dano/cura/PP (W18:Y30).
- **Nao ha celula de "EN" / "Energia"** na planilha. O recurso e uma **adicao do app**, sem equivalente canonico (confirmado no documento de continuidade e no Roadmap, item D1).

**Conclusao de fidelidade:** EN nao tem respaldo na fonte de verdade.

---

## 4. Utilidade real

- Nao tem efeito mecanico (nao entra em HP, PP, C.A., iniciativa, esquiva, bloqueio, P.A., reducoes, progressao).
- Nao tem finalidade documentada nem regra de consumo/recuperacao (diferente de PP, que tem fluxo proprio na Sprint 1).
- Sobrepoe-se conceitualmente a recursos que ja existem: PP (recurso de gasto), CASH (recurso numerico) e **Campos Extras** (contadores livres definidos pelo jogador).
- Max fixo em 5, sem origem de regra; comportamento de barra puramente cosmetico.

**Conclusao de utilidade:** baixa/nula no estado atual.

---

## 5. Decisao

### DEPRECAR (remocao gradual da UI, com preservacao de dados legados)

Justificativa:
- **Sem base na planilha** (secao 3) e **sem utilidade real** (secao 4) → nao se justifica manter como recurso de primeira classe.
- **Remocao imediata e destrutiva e desnecessaria**: o acoplamento e minimo, mas fichas legadas ja carregam `resources.energy`. Deprecar preserva esses dados e mantem a porta aberta caso surja uma regra futura.
- Deprecar (em vez de remover) e **reversivel** e respeita a diretriz de compatibilidade e de nao alterar calculos.

> Observacao: se em algum momento o produto quiser um recurso de "energia/stamina" com regra propria, o caminho recomendado **nao** e reativar este EN orfao, e sim especifica-lo do zero (origem, limites, consumo, recuperacao) — ou usar **Campos Extras**, que ja cobrem contadores livres sem custo mecanico.

---

## 6. Plano de remocao gradual da UI

Faseado, aditivo e sem tocar em calculo. Cada fase e independente e reversivel.

### Fase 0 — Marcar como legado (documental)
- Registrar no Roadmap/continuidade que EN esta **deprecado** e nao deve ganhar novas dependencias.
- Nenhuma mudanca de codigo.

### Fase 1 — Remover EN da exibicao de barras
- Em `resourceBars()` (`app.js:1591`), trocar a lista fixa `["hp","mp","energy","cash"]` por `["hp","mp","cash"]`.
- Efeito: EN deixa de aparecer como barra; HP/MP/CASH inalterados.
- Compatibilidade: dado `resources.energy` continua no objeto; apenas nao e renderizado.

### Fase 2 — Remover EN da edicao generica
- Em `renderResources()` "Editar atuais" (`app.js:1338`), filtrar a chave `energy` do `Object.entries(c.resources)` (ex.: `.filter(([k]) => k !== "energy")`).
- Efeito: EN some da tela de edicao. CASH/HP/MP seguem editaveis.
- Alternativa de transicao: manter EN editavel por 1 ciclo sob um rotulo "(legado)" antes de ocultar, se quiser aviso ao usuario.

### Fase 3 — Parar de criar EN em fichas novas
- Em `defaultCharacter()` (`app.js:455`), remover a entrada `energy` do objeto `resources`.
- Efeito: fichas novas nascem sem EN. Fichas antigas continuam com o campo ate eventual limpeza.
- Compatibilidade: como EN nao e lido em calculo, sua ausencia nao quebra nada.

### Fase 4 (opcional, tardia) — Limpeza de dados
- **Nao** fazer migracao eager. Se desejado, deixar `sanitizeCharacterForPersist()` **parar de reescrever** `energy` (omissao no save), de modo que a chave saia naturalmente do documento na proxima gravacao (limpeza **lazy**).
- Nunca apagar `resources.energy` em massa por script; deixar o decaimento ocorrer por uso.

> Recomendacao de corte: implementar **Fases 1–3** quando o item entrar em sprint. Fase 4 e opcional e so apos as anteriores estarem estaveis.

---

## 7. Compatibilidade com fichas legadas

- Fichas antigas com `resources.energy` **continuam validas**: o campo permanece no objeto; deixa apenas de ser exibido/editado.
- `normalizeCharacter()` faz merge de `resources`; remover a chave do default (Fase 3) **nao** apaga a existente — o merge so injeta defaults ausentes.
- **Sem migracao eager** e sem delecao em massa. Qualquer limpeza e **lazy** (Fase 4, opcional).
- Exportacao JSON continua incluindo o que existir no estado; nada quebra.

---

## 8. Garantia de nao alteracao de calculos

- EN **nao** e referenciado em `excelCalc()` nem em `armorState`, `skillBonus`, fluxo de combate, HP/PP max, etc.
- Todas as fases acima sao de **UI/modelo de exibicao**; **nenhuma** toca formula ou derivado.
- `clampResourcesToCalc()` so atua sobre `hp`/`mp` (`app.js:233-240`); EN nunca foi clampado por calculo.

---

## 9. Resumo executivo

| Criterio | Resultado |
|---|---|
| Existe na planilha? | Nao |
| Tem efeito mecanico? | Nao |
| Tem finalidade/regra propria? | Nao |
| Sobrepoe outros recursos? | Sim (PP, CASH, Campos Extras) |
| Acoplamento tecnico | Minimo |
| **Decisao** | **Deprecar** (remocao gradual da UI) |
| Compatibilidade legada | Preservada (sem eager, sem delecao) |
| Impacto em calculo | Nenhum |

**Decisao final: DEPRECAR.** Remover gradualmente da UI (Fases 1–3), preservando dados legados e sem alterar calculos. Reabrir como recurso novo e especificado apenas se surgir regra concreta.

*Documento de decisao. Nenhuma alteracao de codigo foi realizada.*
