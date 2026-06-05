# Estado Atualizado do Projeto — NiarTale

**Data:** 2026-06-05
**Base:** `docs/NiarTale_Documento_Continuidade.md`, `docs/Roadmap.md`, `docs/Roadmap_Atualizado.md`, relatorios de sprint e auditorias.
**Proposito:** retrato fiel do estado real do projeto (implementado, especificado e pendente), sincronizado com os feedbacks recentes. **Nenhuma alteracao de codigo.**

---

## 1. Resumo executivo

- Nucleo mecanico estavel: `excelCalc` auditado; **nenhuma lacuna Essencial em aberto** afeta calculo de forma silenciosa.
- Sprints 1–4 (paridade com a planilha) concluidas; Raca/Sub-raca estruturadas; UX-1 (colapso por secao e por item) implementada.
- O que resta e majoritariamente **fidelidade fina, usabilidade e personalizacao** — alem de uma **decisao de produto pendente (EN)**.

---

## 2. Implementado (em producao)

| Area | Entrega | Referencia |
|---|---|---|
| Raca e Sub-raca estruturadas | `race`/`subRace` canonicos + `SUB_RACE_SR` | `NiarTale_Relatorio_Raca_SubRaca.md` |
| HATE e Inversao na ficha | controles na UI | `Relatorio_Implementacao_Sprint1_Paridade.md` |
| CalculaDANO/CURA + HP Restante | fluxo de combate (5 entradas) | idem |
| CalculaPP/PP Recuperado + PP Restante | fluxo de combate | idem |
| Progressao EXP/XP/Aplicados/LV-NVL | campos + derivado `Aplicados` | `Relatorio_Implementacao_Sprint2_Progressao.md`, `Relatorio_Correcao_Level_Nivel.md` |
| Aba Equipamentos + equipar/desequipar | `renderEquipment` | `Relatorio_Implementacao_Sprint3_Equipamentos.md` |
| Tipo de armadura explicito (Leve/Media/Pesada) | `armorType` + fallback por nome | idem |
| RD FIS / RD MAG editaveis | `buffs.physicalReduction`/`magicReduction` | `Relatorio_Implementacao_Sprint4_RD.md` |
| Secoes colapsaveis (por secao) | `collapsibleCard`/`collapsedSections` | `Relatorio_Implementacao_Sprint_UX1.md` (secoes) |
| **Cards colapsaveis por item** | `collapsibleItemCard`/`expandedItems` (Habilidades, Inventario, Equipamentos, Campos Extras) + nome no cabecalho/renomeacao | `Relatorio_Implementacao_Sprint_UX1.md`, `Auditoria_Sprint_UX1.md` (**GO**) |
| **Sub-raca Boneco Magico** | nominal, sem efeito mecanico (`SUB_RACE_KEYS`/`LABELS`, fora de `SUB_RACE_SR`) | `Relatorio_Implementacao_Boneco_Magico.md` |
| Correcao de Campos Extras (I1/I2/I3) | Almas deletavel; backfill de `id`; "Sub-raca" preservado | `Relatorio_Correcao_Campos_Extras.md` |
| Bateria de testes de regressao | casos por atributo/derivado/raca/combate/equip. | `Testes_Regressao.md` |

---

## 3. Especificado (pronto para implementar, ainda nao implementado)

| Item | Estado | Referencia |
|---|---|---|
| **Fontes personalizadas por ficha** (Padrao/Serif/Fantasia/Manuscrita) | Especificacao concluida; **nao implementado** | `Especificacao_Sprint_Personalizacao.md` |
| Sprint 5 — Pericias com atributo base | Especificacao concluida → **encerrada por fidelidade** (ver §5) | `Especificacao_Sprint5_Pericias.md` |

---

## 4. Feedbacks recentes (registrados)

| # | Feedback | Situacao | Proximo passo |
|---|---|---|---|
| FB1 | **Cards colapsaveis por item** | ✅ Implementado e auditado (GO) | — |
| FB2 | **Fontes personalizadas** | 📝 Especificado; aguarda implementacao | Implementar Sprint Personalizacao |
| FB3 | **Imagens em habilidades/itens** | 🆕 Novo; sem especificacao | Criar especificacao (modelo de URL/imagem por item, persistencia, performance) |
| FB4 | **Boneco Magico** | ✅ Implementado (nominal) | — |
| FB5 | **PDF na ficha** (exportar/anexar/visualizar) | 🆕 Novo; sem especificacao | Definir escopo (exportar ficha em PDF vs anexar PDF) e criar especificacao |

> FB3 e FB5 ainda precisam de definicao de escopo antes de especificacao tecnica.

---

## 5. P1 — Pericia com atributo base: **ENCERRADO**

- **Decisao:** encerrado **sem acao**, por fidelidade.
- **Motivo (evidencia da planilha):** a coluna "Bonus" por pericia (`M6:M18`, `T6:T18`) e `IF(Treinado,5,0)+IF(Mestre,10,0)+Extra` — **nao soma modificador de atributo**. O atributo so entra nos derivados (INI=`AGI+Reflexo`, P.A.=`INT+Percepcao`, ESQ), que o app **ja** reproduz. Logo, `skillBonus()` ja e fiel.
- **Implicacao:** "perícia com atributo base" seria uma *house rule* (display opcional), nao correcao de fidelidade. So avancar mediante decisao de produto explicita.
- Detalhes em `Especificacao_Sprint5_Pericias.md`.

---

## 6. Decisao pendente

- **EN/Energia (D1):** recurso extra do app **sem equivalente** na planilha. **Mantido como decisao de produto pendente** (manter / deprecar / remover). Baixo acoplamento tecnico. Resolver antes do polimento final (P9/P10).

---

## 7. Pendencias remanescentes (fidelidade/UX)

- P2 HATE/HOPE percentuais (requer definicao de regra).
- P3 Condicao Atual dedicada; P4 Theme Song; P5 CASH na HUD.
- P6 Reducoes de Dano como tabela; P7 validacao de pontos aplicados.
- P9 refino de UX/validacoes; P10 evolucao visual (por ultimo).

*(Detalhe e priorizacao em `Roadmap_Atualizado.md`.)*

---

## 8. Invariantes a preservar

- Planilha = fonte canonica; `excelCalc` intocado salvo evidencia por celula.
- Compatibilidade total com fichas antigas; sem migracao eager.
- Identidade visual retro-pixel; numeros/HUD em monospace.
- Permissoes em duas camadas (UI + `firestore.rules`).

*Fim do estado atualizado. Nenhuma alteracao de codigo foi realizada.*
