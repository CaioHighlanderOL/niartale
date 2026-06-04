# Roadmap Atualizado — NiarTale

**Data:** 2026-06-03
**Base:** `docs/Roadmap.md`, `docs/NiarTale_Documento_Continuidade.md`
**Natureza:** atualização de status. Nenhuma alteração de código foi realizada.

Legenda de status:
- ✅ **Concluído**
- 🔄 **Em andamento**
- ⏳ **Pendente**

Marcos concluídos nesta linha do tempo:
- ✅ Sprint Raça/Sub-raça (2026-06-02)
- ✅ Sprint 1 — Estado de combate (HATE, Inversão, Dano/Cura/PP, HP/PP Restante)
- ✅ Sprint 2 — Progressão (EXP, XP, Aplicados, NVL) + correção Level/Nível

---

## Resumo executivo de status

| Área | Status |
|---|---|
| Raça/Sub-raça estruturadas | ✅ Concluído |
| HATE/Inversão na UI | ✅ Concluído (Sprint 1) |
| CalculaDANO/CalculaCURA/HP Restante | ✅ Concluído (Sprint 1) |
| CalculaPP/PP Recuperado/PP Restante | ✅ Concluído (Sprint 1) |
| Progressão EXP/XP/Aplicados/NVL | ✅ Concluído (Sprint 2) |
| Consolidar fonte de verdade (planilha) | 🔄 Em andamento (contínuo) |
| Trilha de validação de cálculos | ⏳ Pendente |
| Tipo de armadura explícito | ⏳ Pendente (alvo Sprint 3) |
| Total de perícia com atributo base | ⏳ Pendente (alvo Sprint 3) |
| HATE/HOPE percentuais | ⏳ Pendente |
| Condição Atual formalizada | ⏳ Pendente |
| Theme Song | ⏳ Pendente |
| HUD com CASH/derivados | ⏳ Pendente |
| UX de edição e proteções | ⏳ Pendente |
| Evolução visual | ⏳ Pendente |

---

## 1. Fundamentos (governança de regra)

### 1.1 Consolidar fonte de verdade e critérios de aceite — 🔄 Em andamento
- Planilha permanece como fonte canônica; `excelCalc()` como implementação auditada.
- Prática contínua: toda mudança de regra cita célula/fórmula/impacto.
- **Observação:** seguido nas Sprints 1 e 2 (cada entrega referenciou células `W18:X30`, `H13`, `H14`, etc.).

### 1.2 Preparar trilha de validação de cálculos — ⏳ Pendente
- Bateria mínima por raça/sub-raça e por HATE/Inversão/armadura/buffs ainda **não automatizada**.
- Validação atual é **manual** (sem suíte de testes no projeto).
- Recomendado antes de Sprint 3 (Perícias/Armadura têm acoplamento com derivados).

### 1.3 Raça e Sub-raça estruturadas — ✅ Concluído (2026-06-02)
- Detalhes em `docs/NiarTale_Relatorio_Raca_SubRaca.md`.

---

## 2. Sprints de paridade concluídas

### 2.1 Sprint 1 — Estado de combate — ✅ Concluído
- **HATE e Inversão na UI** (`U24`/`U26`): toggles em Atributos e Recursos; cálculo imediato; distinção +30 (atributos) vs +16 (R.D.); INT sem HATE/Inversão preservado.
- **CalculaDANO + HP Restante** (`W18:X23`, `K24`): bloco de 5 entradas; `HP Restante = hpMax - dano + cura`.
- **CalculaCURA** (`Y18:Y23`).
- **CalculaPP + PP Restante** (`W25:X30`, `K27`): `PP Restante = ppMax - gasto + recuperação`.
- **PP Recuperado** (`Y25:Y30`).
- Referências: `docs/Relatorio_Implementacao_Sprint1_Paridade.md`.

### 2.2 Sprint 2 — Progressão — ✅ Concluído
- **EXP** (`F13`) e **XP** (`F14`): campos manuais.
- **Aplicados** (`H13 = SUM(F15:F24)`): derivado read-only.
- **NVL** (`H14`): `nvl` manual, somado a `lv` existente.
- **Correção Level/Nível:** visor read-only `LV/NVL` removido; `LEVEL` e `NIVEL` agora editáveis e independentes.
- Referências: `docs/Especificacao_Sprint2_Progressao.md`, `docs/Relatorio_Implementacao_Sprint2_Progressao.md`, `docs/Auditoria_Sprint2_Progressao.md`, `docs/Relatorio_Correcao_Level_Nivel.md`.
- **Status de release:** GO (avaliação final aprovada; testes manuais aprovados).

---

## 3. Sprint 3 (próxima) — Correções de fidelidade

### 3.1 Tipo de armadura explícito — ⏳ Pendente
- Planilha: `R21`, `R23`, `R25`, `F26`, `H28`, `X15`.
- Hoje `armorState()` infere por texto do nome/slot.
- Plano: campo `armorType` (nenhuma/leve/média/pesada) + **fallback por nome** (retrocompatível); atualizar doc de `equipment`; migração suave em `normalizeCharacter()`.
- **Risco:** alto se adiado (C.A./Esquiva/RD físicas erradas sem aviso). Alimenta derivados de `excelCalc` → exige teste de não-regressão.

### 3.2 Total de perícia com atributo base — ⏳ Pendente
- Planilha: `M6:M18`, `T6:T18`, `F28`, `F30`.
- Hoje a lista mostra Treinado/Mestre/Extra, sem somar o modificador do atributo base.
- Plano: confirmar mapa perícia→atributo; exibir total **sem** quebrar INI/ESQ (Reflexo) e P.A (Percepção).
- **Risco:** 🔴 — `skillBonus` é reutilizado em `excelCalc`; isolar "total exibido" do "bônus consumido nos derivados".

### 3.3 Decisão de produto pendente da Sprint 2 (carregada p/ Sprint 3) — ⏳ Pendente
- Definir se **NIVEL (`nvl`)** deve ter edição exclusiva de Mestre (item M2 da auditoria), já que Sprint 3 mexe em campos/permissões de ficha.

---

## 4. Backlog posterior (Depois)

### 4.1 CalculaDANO/CalculaCURA/HP Restante — ✅ Concluído (antecipado na Sprint 1)
- Item originalmente listado em "Depois" do roadmap antigo; entregue na Sprint 1.

### 4.2 CalculaPP/PP Recuperado/PP Restante — ✅ Concluído (antecipado na Sprint 1)
- Idem; entregue na Sprint 1.

### 4.3 Progressão EXP/XP/Aplicados/LVL-NVL — ✅ Concluído (Sprint 2)
- Pendência menor de produto: significado canônico de "Nível" (teto de campanha vs. nota livre).

### 4.4 HATE e HOPE percentuais — ⏳ Pendente
- Planilha: `C3`, `J31:J32`, `AA3`, `T30:T31`.
- HATE existe como booleano mecânico; HOPE não existe como recurso estruturado.
- **Risco:** alto (pode mudar a origem do maior modificador mecânico). Confirmar semântica antes.

### 4.5 Formalizar Condição Atual — ⏳ Pendente
- Planilha: `T21`. Decidir se `status` basta ou se cria `conditionText`.

---

## 5. Futuro (UX/visual, após estabilizar regra e dados)

### 5.1 Theme Song como campo padrão — ⏳ Pendente (`M47`)
### 5.2 HUD com CASH e derivados — ⏳ Pendente (`G30/H30`)
### 5.3 UX de edição e proteções contra erro — ⏳ Pendente
- Validar ranges; melhorar toasts; destacar HP/PP acima do máximo; avisar fichas migradas/fallback.
### 5.4 Evolução visual — ⏳ Pendente
- Preservar identidade retro-pixel; só após correções mecânicas e de dados.

---

## 6. Pendências técnicas transversais (registradas)

| Item | Origem | Status |
|---|---|---|
| Materialização lazy de `exp/xp/nvl` no doc cru (I2) | Auditoria Sprint 2 | ⏳ Pendente (documentado; sem impacto no app) |
| Clamp `>= 0` de EXP/XP sem equivalente na planilha (M1) | Auditoria Sprint 2 | ⏳ Aceito/registrar |
| `nvl` editável por qualquer dono (M2) | Auditoria Sprint 2 | ⏳ Decisão de produto (Sprint 3) |
| Atualização não-imediata de métricas durante digitação (M3) | Auditoria Sprint 2 | ⏳ Aceito (padrão do app) |
| Recurso EN sem equivalente na planilha | Análise EN | ⏳ Pendente (decisão: manter/deprecar/remover) |
| Trilha de testes automatizados | Roadmap 1.2 | ⏳ Pendente |

---

## 7. Sequência recomendada

1. **Sprint 3** — Armadura explícita (3.1) e Total de perícia (3.2), com teste de não-regressão de derivados; decidir M2.
2. **Validação de cálculos (1.2)** — idealmente antes/junto da Sprint 3.
3. **HATE/HOPE percentuais (4.4)** e **Condição Atual (4.5)**.
4. **Futuro UX/visual (5.x)** apenas após estabilização mecânica.

*Fim do roadmap atualizado. Nenhuma alteração de código foi realizada.*
