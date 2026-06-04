# Paridade Atual — O que ainda falta (pós-Sprint 2)

**Data:** 2026-06-03
**Fontes:** `app.js`, `docs/Planilha Original.xlsx` (aba `Ficha`)
**Natureza:** comparação de paridade. Lista **apenas o que ainda está ausente**. Itens já implementados foram omitidos.

> Já implementado (omitido desta lista): raça/sub-raça, atributos e modificadores, derivados (C.A, INI, ESQ, BLOQ, P.A, R.D.), HP/PP máximos, HATE/Inversão (toggles), CalculaDANO/CalculaCURA/HP Restante, CalculaPP/PP Recuperado/PP Restante, EXP, XP, Aplicados, LV/NVL, avatar (`M46`), Almas.

---

## Resumo

| Classe | Itens |
|---|---|
| Essencial | 1 |
| Importante | 3 |
| Opcional | 4 |

---

## Essencial

### E1. Tipo de armadura explícito (Leve/Média/Pesada)
- **Planilha:** `R21`, `R23`, `R25` (alimentam `F26`/C.A, `H28`/Esquiva, `X15`/R.D. Física).
- **Estado atual:** `armorState()` **infere** o tipo pelo texto do nome/slot do equipamento; não há controle explícito.
- **Por que Essencial:** sem palavra-chave no nome, a armadura é ignorada silenciosamente e C.A./Esquiva/R.D. ficam **erradas sem aviso**. É o único item ausente que afeta diretamente cálculo mecânico.
- **Observação:** já é o alvo da Sprint 3.

---

## Importante

### I1. Bônus de perícia com atributo base
- **Planilha:** coluna "Bônus" das perícias (`M6:M18`, `T6:T18`); consumido em `F28`/`F30`.
- **Estado atual:** `skillBonus()` soma apenas `Treinado(+5) + Mestre(+10) + Extra`; **não** soma o modificador do atributo base no total exibido na lista.
- **Impacto:** total de rolagem exibido fica abaixo do esperado pela planilha; jogador calcula à mão.
- **Observação:** alvo da Sprint 3 (cuidado: `skillBonus` alimenta INI/ESQ/P.A).

### I2. HATE e HOPE percentuais
- **Planilha:** `J31/J32` e `C3` (HATE %), `T30/T31` e `AA3` (HOPE %).
- **Estado atual:** HATE existe apenas como **booleano** mecânico; **HOPE não existe** como recurso (nem booleano, nem percentual).
- **Impacto:** recurso narrativo/mecânico da planilha ausente; HOPE é lacuna completa.
- **Risco de implementação:** alto (pode mudar a origem do maior modificador do sistema) — exige confirmação de semântica.

### I3. Reduções de Dano como tabela (Tipo/Quantidade/Bônus adc.)
- **Planilha:** `W12`/`W14`/`X14`/`Y14`, com `R.D. Fís.` (`Y15`) e `R.D. Mag.` (`Y16`).
- **Estado atual:** o app calcula o **número final** de R.D. (armadura + HATE + sub-raça + buff), mas não expõe a **estrutura** de tipo/quantidade/bônus adicional.
- **Impacto:** resultado final existe; perde-se o detalhamento e a entrada granular da planilha.

---

## Opcional

### O1. Condição Atual separada do Status
- **Planilha:** `T21` ("Condição Atual"), distinta de `J21` ("STATUS").
- **Estado atual:** o app usa um único `status` (HUD + Geral). Não há campo dedicado de condição de combate.
- **Impacto:** baixo; pode ser coberto por texto livre, mas a separação semântica não existe.

### O2. Theme Song
- **Planilha:** `M47`.
- **Estado atual:** ausente como campo padrão (só seria possível via campo customizado manual).
- **Impacto:** nenhum mecânico; fidelidade cosmética.

### O3. CASH na HUD
- **Planilha:** `G30/H30`.
- **Estado atual:** `resources.cash` existe e aparece na aba Recursos, mas **não** na HUD principal.
- **Impacto:** baixo; é exposição/escaneabilidade, não ausência de dado.

### O4. Validação/orçamento de pontos aplicados
- **Planilha:** relação implícita entre `H13` (Aplicados = `SUM(F15:F24)`) e EXP/XP.
- **Estado atual:** "Aplicados" é exibido (read-only), mas **não há trava/validação** de orçamento de atributos contra EXP/XP.
- **Impacto:** baixo; decisão de design (MVP deliberadamente sem bloqueio para não travar fichas legadas).

---

## Notas de fronteira (não contam como ausência)

- **Recurso EN/Energia:** é um **extra do app sem equivalente na planilha** (não é ausência da planilha; é adição). Tratado separadamente (decisão manter/deprecar/remover na Sprint 4).
- **Nomenclatura MP↔PP / PV↔HP / R.FIS↔R.D. Fís.:** divergência de rótulo, não de funcionalidade; o dado/cálculo existe.

---

## Priorização sugerida (somente do que falta)

1. **E1 — Armadura explícita** (único item de cálculo; Sprint 3).
2. **I1 — Bônus de perícia com atributo base** (Sprint 3).
3. **I3 — Tabela de Reduções de Dano** e **I2 — HATE/HOPE percentuais** (pós-Sprint 3; I2 exige definição de regra).
4. **O1–O4** — cosméticos/conveniência, após estabilizar mecânica.

*Fim do relatório. Nenhuma alteração de código foi realizada.*
