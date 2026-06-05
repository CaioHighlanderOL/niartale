# Paridade Atual — O que ainda falta (pós-Sprint 4)

**Data:** 2026-06-03
**Fontes:** `app.js`, `docs/NiarTale_Documento_Continuidade.md`, `docs/Planilha Original.xlsx` (aba `Ficha`)
**Natureza:** comparação de paridade. Lista **apenas o que ainda está ausente**. Tudo já implementado foi omitido.

> **Já entregue (omitido):** Raça/Sub-raça (select + tabela de bônus); Sprint 1 (HATE/Inversão, CalculaDANO/CURA/PP, HP/PP Restante); Sprint 2 (EXP, XP, Aplicados, LV/NVL); Sprint 3 (aba Equipamentos, equipar/desequipar, `armorType` explícito Leve/Média/Pesada com fallback por nome); Sprint 4 (`RD FIS`/`RD MAG` editáveis).

---

## Resumo

| Classe | Itens |
|---|---|
| Essencial | 0 |
| Importante | 2 |
| Opcional | 5 |

**Boa notícia:** após a Sprint 3 (armadura explícita), **nenhum item Essencial permanece** — não há mais lacuna que afete cálculo mecânico de forma silenciosa. O que resta é fidelidade/usabilidade.

---

## Importante

### I1. Bônus de perícia com atributo base
- **Planilha:** coluna "Bônus" por perícia (`M6:M18` / `T6:T18`) **inclui o modificador do atributo base**; consumida em `F28`/`F30`.
- **Estado atual:** `skillBonus()` soma apenas `Treinado(+5) + Mestre(+10) + Extra`. O `+N` exibido na lista **não** inclui o mod do atributo.
- **Impacto na jogabilidade:** o total de rolagem visível fica abaixo do real; o jogador soma o atributo na mão a cada teste.
- **Impacto nos cálculos:** o número **exibido** diverge da planilha. Atenção: `skillBonus` alimenta `initiative` (Reflexo) e `pa` (Percepção); INI/ESQ/P.A já embutem o atributo por outra via, então mudar `skillBonus` cru causaria dupla contagem.
- **Impacto na experiência do usuário:** confusão recorrente ao comparar com a planilha.
- **Dificuldade:** Média. Exige separar "bônus de treino" (cru, usado nos derivados) do "total exibido" (com atributo) — alterar **só a apresentação**.
- **Risco de regressão:** Médio. Mexer em `skillBonus` sem isolar a exibição quebra INI/ESQ/P.A.

### I2. HATE % / HOPE %
- **Planilha:** percentuais de HATE (`C3`, `J31/J32`) e HOPE (`AA3`, `T30/T31`) exibidos no topo da ficha; HOPE é um recurso próprio.
- **Estado atual:** HATE existe só como **booleano** mecânico; **HOPE não existe** (nem visor, nem controle, nem campo).
- **Impacto na jogabilidade:** HOPE como recurso de mesa está totalmente ausente; HATE perde a leitura percentual.
- **Impacto nos cálculos:** indefinido — a regra dos percentuais e a relação de HOPE com o resto **não está especificada**; pode tocar a origem do maior modificador do sistema (boost de +30).
- **Impacto na experiência do usuário:** falta de um medidor que o jogador acompanha na planilha.
- **Dificuldade:** Média/Alta. Exige **primeiro definir a regra** (origem, limites, efeito) antes de codar.
- **Risco de regressão:** Alto se for ligado ao cálculo de HATE; Baixo se entrar apenas como visor/recurso manual desacoplado.

---

## Opcional

### O1. Condição Atual (separada do Status)
- **Planilha:** `T21` "Condição Atual", distinta de `J21` "STATUS".
- **Estado atual:** existe só um `status` único (HUD + Geral); sem campo dedicado de condição de combate.
- **Jogabilidade:** baixa; estados (atordoado, sangrando) ficam sem lugar próprio.
- **Cálculos:** nenhum (texto livre).
- **UX:** mistura identidade/estado com condição efêmera.
- **Dificuldade:** Baixa. Novo campo + default/normalização.
- **Risco de regressão:** Muito baixo.

### O2. Reduções de Dano como tabela (Tipo / Quantidade)
- **Planilha:** `W12`/`W14`/`X14`/`Y14` — estrutura Tipo/Quantidade/`Bônus adc.`.
- **Estado atual:** o **bônus somado** já é editável (`RD FIS`/`RD MAG`, Sprint 4) e o resultado final aparece; falta apenas a **estrutura tabular** granular.
- **Jogabilidade:** baixa; o valor final já é alcançável.
- **Cálculos:** nenhum impacto novo (a soma já existe).
- **UX:** perde-se o detalhamento por tipo, mas não o resultado.
- **Dificuldade:** Média (modelo tabular novo).
- **Risco de regressão:** Baixo (aditivo).

### O3. Theme Song
- **Planilha:** `M47`.
- **Estado atual:** ausente como campo padrão (só via "Campos extras" manual).
- **Jogabilidade:** nenhuma.
- **Cálculos:** nenhum.
- **UX:** fidelidade cosmética/imersiva.
- **Dificuldade:** Baixa (um campo de texto na aba Geral).
- **Risco de regressão:** Muito baixo.

### O4. CASH na HUD
- **Planilha:** `G30/H30`, CASH junto dos derivados, sempre à vista.
- **Estado atual:** `resources.cash` é editável/visível na aba Recursos, mas **não** no HUD principal (HUD mostra LV/HP/MP/STATUS).
- **Jogabilidade:** baixa; o dado existe.
- **Cálculos:** nenhum.
- **UX:** escaneabilidade — exigiria trocar de aba para ver o dinheiro.
- **Dificuldade:** Baixa.
- **Risco de regressão:** Muito baixo.

### O5. Validação/orçamento de pontos aplicados
- **Planilha:** relação implícita entre `H13` (Aplicados = `SUM(F15:F24)`) e EXP/XP.
- **Estado atual:** "Aplicados" é exibido (read-only); **não há trava/validação** de orçamento de atributos contra EXP/XP.
- **Jogabilidade:** média para mesas que controlam progressão por pontos.
- **Cálculos:** nenhum (seria validação, não fórmula nova).
- **UX:** ausência de feedback ao exceder orçamento.
- **Dificuldade:** Média (definir regra de orçamento).
- **Risco de regressão:** Baixo; mas decisão de design (MVP deliberadamente sem bloqueio para não travar fichas legadas).

---

## Notas de fronteira (não contam como ausência)

- **EN/Energia:** é **extra do app sem equivalente na planilha** (adição, não lacuna). Decisão manter/deprecar/remover segue em avaliação própria.
- **Nomenclatura** MP↔PP / PV↔HP / R.FIS↔R.D. Fís.: divergência de rótulo, não de funcionalidade; o dado/cálculo existe.
- **`N28 IMAGE(M46,2)`**: coberto pelo avatar/sprite via `avatarUrl`.

---

## Priorização sugerida (somente do que falta)

1. **I1 — Bônus de perícia com atributo base** (maior impacto de fidelidade; exige cuidado com INI/ESQ/P.A).
2. **I2 — HATE/HOPE %** (depende de definição de regra antes de implementar).
3. **O1, O3, O4** — Condição Atual, Theme Song, CASH no HUD (baixo custo, baixo risco; ganhos rápidos de UX).
4. **O2, O5** — tabela de R.D. e validação de pontos (modelos/regra novos; menor urgência).

*Fim do relatório. Nenhuma alteração de código foi realizada.*
