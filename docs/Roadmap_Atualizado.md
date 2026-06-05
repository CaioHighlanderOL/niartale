# Roadmap Atualizado — NiarTale

**Data:** 2026-06-05
**Base:** `docs/Roadmap.md`, `docs/Estado_Atualizado.md`, `docs/NiarTale_Documento_Continuidade.md`
**Legenda:** ✅ concluído · 🔄 em andamento · ⏳ pendente · 🆕 novo (sem especificação) · 📝 especificado

> Sincronizado com o estado real. Marcos: Sprints 1–4 (paridade), Raça/Sub-raça, UX-1 (colapso por seção **e por item**) e Boneco Mágico concluídos. **P1 encerrado por fidelidade.** Restam fidelidade fina, usabilidade, personalização e uma decisão de produto (EN).

---

## ✅ Concluído

| Item | Entrega | Planilha / Origem | Referência |
|---|---|---|---|
| Raça e Sub-raça estruturadas | 2026-06-02 | E8, G8, `SUB_RACE_SR` | `NiarTale_Relatorio_Raca_SubRaca.md` |
| HATE e Inversão na ficha | Sprint 1 | U24, U26 | `Relatorio_Implementacao_Sprint1_Paridade.md` |
| CalculaDANO / CalculaCURA / HP Restante | Sprint 1 | W18:X23, Y18:Y23, K24 | idem |
| CalculaPP / PP Recuperado / PP Restante | Sprint 1 | W25:X30, Y25:Y30, K27 | idem |
| Progressão: EXP, XP, Aplicados, LV/NVL | Sprint 2 | F13, F14, H13, H14 | `Relatorio_Implementacao_Sprint2_Progressao.md` |
| Aba Equipamentos + equipar/desequipar | Sprint 3 | inventário/armadura | `Relatorio_Implementacao_Sprint3_Equipamentos.md` |
| Tipo de armadura explícito (Leve/Média/Pesada) | Sprint 3 | R21, R23, R25 | idem |
| `RD FIS` / `RD MAG` editáveis | Sprint 4 | Y15, Y16 | `Relatorio_Implementacao_Sprint4_RD.md` |
| Seções colapsáveis (por seção) | UX-1 | — | `Relatorio_Implementacao_Sprint_UX1.md` |
| **Cards colapsáveis por item + nome/renomeação** | UX-1 (cards) | — | `Auditoria_Sprint_UX1.md` (**GO**) |
| **Sub-raça Boneco Mágico** (nominal) | — | adição do sistema | `Relatorio_Implementacao_Boneco_Magico.md` |
| **D1 — EN/Energia (depreciação de UI)** | 2026-06-05 | decisão de produto | `Decisao_EN.md`, `Relatorio_EN.md` |
| Correção de Campos Extras (Almas/ id / "Sub-raca") | — | — | `Relatorio_Correcao_Campos_Extras.md` |
| Bateria de testes de regressão (ex-P8) | — | múltiplas células | `Testes_Regressao.md` |
| **P1 — Perícia com atributo base** | **Encerrado por fidelidade** | M6:M18, T6:T18 | `Especificacao_Sprint5_Pericias.md` |

---

## 🔄 Em andamento (governança contínua)

### G1. Consolidar fonte de verdade e critérios de aceite
**Prioridade:** transversal (fidelidade à planilha)

- Planilha = fonte canônica; `excelCalc()` = implementação auditada dos derivados.
- Preservar correções D1-D18; não reabrir sem evidência por célula.
- Toda mudança de regra registra: célula, fórmula original, comportamento atual e impacto.

**Critério de pronto:** qualquer tarefa que afete cálculo cita célula/área da planilha.

---

## 🆕 Feedbacks recentes a tratar

### F-A. Fontes personalizadas por ficha 📝
**Status:** especificado; **não implementado** · **Referência:** `Especificacao_Sprint_Personalizacao.md`
- Escopo: Padrão/Serif/Fantasia/Manuscrita via `theme.font` + `--char-font`. Sem impacto mecânico. Pronto para implementar.

### F-B. Imagens em habilidades/itens 🆕
**Status:** novo; **sem especificação** · **Risco:** baixo-médio
- Permitir imagem (URL) por habilidade/item de inventário. Decidir: campo `imageUrl` por item, exibição no card, limites e performance (lazy-load).
- **Próximo passo:** criar especificação técnica antes de implementar.

### F-C. PDF na ficha 🆕
**Status:** implementado · **Referência:** `Especificacao_PDF_Ficha.md`, `Relatorio_Implementacao_PDF_Ficha.md`
- Escopo definido como **anexar/visualizar PDFs** na ficha: múltiplos documentos por ficha, URL externa e upload via Firebase Storage, popup com fallback em nova aba.

---

## ⏳ Pendente — Prioridade Alta

### P2. Modelar HATE e HOPE percentuais
**Status:** ⏳ pendente · **Planilha:** C3, J31:J32, AA3, T30:T31
**Pré-requisito:** definir a regra (origem, limites, efeito) antes de codar.
- HATE hoje é booleano; HOPE não existe como recurso. Decidir se `hateBoost` continua manual ou vira derivado de um limiar.
**Risco:** alto se acoplado ao boost de +30; baixo se entrar como visor manual desacoplado.

---

## ⏳ Pendente — Prioridade Média/Baixa (Opcional)

### P3. Separar/formalizar Condição Atual
**Planilha:** T21 · **Risco:** muito baixo — campo dedicado de condição de combate, separado de `status`.

### P4. Theme Song como campo padrão
**Planilha:** M47 · **Risco:** muito baixo — campo de texto na aba Geral/História.

### P5. CASH na HUD
**Planilha:** G30/H30 · **Risco:** muito baixo — expor CASH no HUD sem redesign.

### P6. Reduções de Dano como tabela (Tipo/Quantidade)
**Planilha:** W12/W14/X14/Y14 · **Risco:** baixo — estrutura tabular granular; aditivo.

### P7. Validação/orçamento de pontos aplicados
**Planilha:** H13 vs EXP/XP · **Risco:** baixo — trava/feedback de orçamento (decisão de design).

### P9. Refinar UX de edição e proteções contra erro
**Risco:** baixo-médio — validar ranges; toasts; destacar HP/PP acima do máximo; avisar fallback por nome.

---

## ⏳ Pendente — Por último

### P10. Evoluir visual após estabilizar regra e dados
**Risco:** médio se feito cedo — preservar identidade retro-pixel; melhorar legibilidade só onde houver problema comprovado.

---

## Decisão de produto aplicada

### D1. EN/Energia — **DEPRECADO na UI**
- Extra do app **sem equivalente** na planilha.
- Decisão aplicada: remover EN da UI (barras e edição) e parar de criar EN em fichas novas.
- Compatibilidade legada preservada: fichas antigas com `resources.energy` continuam válidas, sem migração eager.

---

## Sequência recomendada

1. **F-A** (fontes personalizadas) → já especificado, baixo risco, ganho de personalização.
2. **F-B / F-C** (imagens em itens; PDF) → **especificar** antes de implementar.
3. **P2** (HATE/HOPE %) → após definir a regra.
4. **P3, P4, P5** (Condição Atual, Theme Song, CASH HUD) → ganhos rápidos de UX.
5. **P6, P7** (tabela R.D., validação de pontos) → modelos/regra novos.
6. **P9, P10** (UX e visual) → fechamento.

*Itens concluídos desde a versão anterior: UX-1 cards por item, Boneco Mágico, correção de Campos Extras, bateria de testes (ex-P8) e encerramento do P1. Nenhuma alteração de código foi realizada nesta sincronização.*
