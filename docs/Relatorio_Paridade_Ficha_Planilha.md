# Relatório de Paridade — Ficha do Sistema vs Planilha Original

**Data:** 2026-06-03
**Fontes:** `docs/Planilha Original.xlsx` (aba `Ficha`), `app.js` (UI/render e modelo), `docs/NiarTale_Documento_Continuidade.md`
**Natureza:** somente análise. Nenhum código foi implementado ou alterado.

> Legenda de classificação: **Essencial** (afeta regra de jogo/cálculo central), **Importante** (afeta uso/fidelidade, mas contornável), **Opcional** (cosmético/conveniência).

---

## Resumo executivo

| Categoria | Essencial | Importante | Opcional |
|-----------|:---:|:---:|:---:|
| 1. Na planilha, ausentes no sistema | 4 | 3 | 2 |
| 2. No sistema, ausentes na planilha | 0 | 1 | 4 |
| 3. Nomenclatura divergente | 0 | 3 | 3 |
| 4. Implementados parcialmente | 3 | 2 | 0 |
| 5. Recursos mecânicos não expostos | 2 | 2 | 1 |
| 6. Controles ausentes | 2 | 2 | 0 |

A base de atributos, modificadores, derivados (C.A, INI, ESQ, BLOQ, P.A, R.D.), HP/PP e raça/sub-raça está fiel à planilha. As maiores lacunas estão em **blocos de combate dinâmico** (Dano/Cura/PP), **progressão (EXP/XP/NVL)** e **controles de estado** (HATE, Inversão, Armadura) que existem no cálculo mas não têm interface.

---

## 1. Campos existentes na planilha mas ausentes no sistema

### 1.1 Bloco CalculaDANO + HP Restante (W18:X23) — **Essencial**
- **Jogabilidade:** sem registro estruturado de dano sofrido nem HP restante calculado; o HP é controlado manualmente.
- **Fidelidade:** alta divergência — a planilha tem fórmula dedicada (`X23 = K24 - SUM(W19:W23) + SUM(Y19:Y23)`).
- **Dificuldade:** Média-alta (novo bloco de UI + modelo de até 5 entradas de dano/cura).

### 1.2 Bloco CalculaPP + PP Restante (W25:X29) — **Essencial**
- **Jogabilidade:** mesma limitação do HP, agora para PP.
- **Fidelidade:** alta divergência (`X29 = K27 - SUM(W26:W30) + SUM(Y26:Y30)`).
- **Dificuldade:** Média-alta (espelha 1.1).

### 1.3 CalculaCURA (Y18:Y23) / PP. Rec (Y25:Y30) — **Essencial**
- **Jogabilidade:** sem entrada de cura/recuperação por turno.
- **Fidelidade:** divergência direta com colunas `Y`.
- **Dificuldade:** Média (parte do mesmo bloco de 1.1/1.2).

### 1.4 EXP / XP / Aplicados / LVL-NVL (F13, F14, H13, H14) — **Essencial**
- **Jogabilidade:** progressão incompleta; sem XP acumulado/disponível, sem soma de pontos aplicados (`H13 = SUM(F15:F24)`), sem nível máximo.
- **Fidelidade:** a planilha modela progressão; o sistema só tem `lv` atual.
- **Dificuldade:** Média (campos numéricos + validação de pontos).

### 1.5 CalculaHATE % (J31/J32) — **Importante**
- **Jogabilidade:** o booleano de HATE afeta cálculo, mas o percentual narrativo (`100%/100%`) não existe.
- **Fidelidade:** divergência do par `J31/J32`.
- **Dificuldade:** Média (depende de definir a fórmula percentual real).

### 1.6 CalculaHOPE % (T30/T31) — **Importante**
- **Jogabilidade:** recurso de HOPE inexistente no app.
- **Fidelidade:** divergência do par `T30/T31`.
- **Dificuldade:** Média.

### 1.7 Reduções de Dano — tabela Tipo/Quantidade/Bônus adc. (W14/X14/Y14) — **Importante**
- **Jogabilidade:** o app só tem `buffs.physicalReduction`/`magicReduction` numéricos; a planilha estrutura tipo + quantidade + bônus.
- **Fidelidade:** parcial — o resultado final de R.D. existe, mas a granularidade não.
- **Dificuldade:** Média.

### 1.8 Condição Atual (T21) distinta de STATUS (J21) — **Opcional**
- **Jogabilidade:** o app usa um único `status`; a planilha separa STATUS e Condição Atual.
- **Fidelidade:** divergência menor de granularidade.
- **Dificuldade:** Baixa (campo de texto adicional).

### 1.9 Theme Song (M47) — **Opcional**
- **Jogabilidade:** nenhum impacto mecânico.
- **Fidelidade:** campo presente na planilha, ausente no modelo.
- **Dificuldade:** Baixa (campo de URL/texto).

---

## 2. Campos existentes no sistema mas ausentes na planilha

### 2.1 Recurso EN / Energia (`resources.energy`) — **Importante**
- **Jogabilidade:** recurso adicional usado na HUD/barras sem correspondente na planilha.
- **Fidelidade:** adiciona conceito fora da fonte canônica.
- **Dificuldade:** N/A (já existe; decisão é manter/documentar ou remover).

### 2.2 Tema visual (cores/gradiente/ângulo) — **Opcional**
- **Jogabilidade:** cosmético.
- **Fidelidade:** extensão de UI, sem equivalente na planilha.
- **Dificuldade:** N/A.

### 2.3 Frase/flavor — **Opcional**
- **Jogabilidade:** narrativa; sem efeito mecânico.
- **Fidelidade:** extensão.
- **Dificuldade:** N/A.

### 2.4 Grupo / Campanha (metadados) — **Opcional**
- **Jogabilidade:** organização multi-ficha; a planilha é monoficha.
- **Fidelidade:** extensão natural do contexto web.
- **Dificuldade:** N/A.

### 2.5 Campos extras genéricos (`customFields`) — **Opcional**
- **Jogabilidade:** flexibilidade livre.
- **Fidelidade:** sem correspondência direta (exceto Almas).
- **Dificuldade:** N/A.

---

## 3. Campos com nomenclatura divergente

### 3.1 MP vs PP — **Importante**
- **Detalhe:** a planilha usa **Pp/PP**; a UI exibe **MP** na HUD e em recursos (`resources.mp`), embora o cálculo seja `ppMax`.
- **Jogabilidade:** confusão potencial entre MP e PP.
- **Fidelidade:** divergência de rótulo, não de cálculo.
- **Dificuldade:** Baixa (rótulo), mas há decisão explícita de não renomear (Continuidade/Spec).

### 3.2 PV vs HP — **Importante**
- **Detalhe:** planilha usa **Pv**; UI mistura **HP** (HUD/recurso) e **PV** (painel calculado).
- **Jogabilidade:** inconsistência interna de termo.
- **Fidelidade:** divergência de rótulo.
- **Dificuldade:** Baixa.

### 3.3 R.FIS / R.MAG vs R.D. Fís. / R.D. Mag. — **Importante**
- **Detalhe:** abreviações diferentes para a mesma métrica.
- **Jogabilidade:** baixa.
- **Fidelidade:** divergência de rótulo.
- **Dificuldade:** Baixa.

### 3.4 Rótulos de Buff — **Opcional**
- **Detalhe:** a UI usa `FOR/AGI/INT/MAG/CON/HP/PP`; a planilha usa nomes temáticos (`Buff Físico`, `Buff Rapidinho`, `Buff Ixpertinho`, `Buff Mágico`, `Buff Const`, `Buff Hp`, `Buff de PP`).
- **Jogabilidade:** baixa.
- **Fidelidade:** divergência de nome.
- **Dificuldade:** Baixa.

### 3.5 "Sub-raca" vs "SUB-RAÇA" — **Opcional**
- **Detalhe:** diferença de acento/caixa (puramente de exibição; chave canônica resolve).
- **Dificuldade:** Baixa.

### 3.6 Avatar URL vs "Seu Link de Imagem" (M46) — **Opcional**
- **Detalhe:** mesmo conceito, rótulo diferente.
- **Dificuldade:** Baixa.

---

## 4. Campos implementados parcialmente

### 4.1 LVL/NVL (H14) — **Essencial**
- **Estado:** só `lv` atual; sem nível máximo da campanha (par `atual/máximo`).
- **Jogabilidade:** limita controle de progressão/limites.
- **Fidelidade:** parcial.
- **Dificuldade:** Baixa.

### 4.2 Bônus de perícia com atributo base (coluna N/`Bônus`) — **Essencial**
- **Estado:** a UI mostra Treinado/Mestre/Extra e soma `+5/+10/extra`, mas **não** soma o modificador do atributo base na lista, como a coluna `Bônus` da planilha sugere.
- **Jogabilidade:** total exibido da perícia pode ficar abaixo do esperado pela planilha.
- **Fidelidade:** parcial — depende de confirmar a fórmula exata da coluna `Bônus`.
- **Dificuldade:** Média (precisa mapear perícia → atributo).

### 4.3 Reduções de Dano (X15/X16) — **Essencial**
- **Estado:** resultado final de R.D. Fís/Mag é calculado (armadura + HATE + sub-raça + buff), mas sem a estrutura de tabela Tipo/Quantidade.
- **Jogabilidade:** suficiente para o número final; perde detalhamento.
- **Fidelidade:** parcial.
- **Dificuldade:** Média.

### 4.4 Armadura (R21/R23/R25) — **Importante**
- **Estado:** `armorState()` infere Leve/Média/Pesada pelo **nome** do equipamento, sem checkboxes explícitos.
- **Jogabilidade:** risco de classificação incorreta/silenciosa.
- **Fidelidade:** parcial (resultado certo só se o nome contiver a palavra-chave).
- **Dificuldade:** Média (campo `armorType` explícito + UI).

### 4.5 CASH (G30) — **Importante**
- **Estado:** existe em `resources.cash`, presente em Recursos, mas não na HUD principal.
- **Jogabilidade:** baixa.
- **Fidelidade:** presente, mas com exposição reduzida.
- **Dificuldade:** Baixa.

---

## 5. Recursos mecânicos não expostos na interface

### 5.1 HATE (U26) — **Essencial**
- **Estado:** `conditions.hateBoost` afeta `excelCalc` (+30 mods, +16 R.D.), mas **não há controle na UI**; só editável via Firestore.
- **Jogabilidade:** alta — um modificador de combate central fica inacessível ao jogador.
- **Fidelidade:** o cálculo existe; falta a exposição.
- **Dificuldade:** Baixa (um checkbox/toggle).

### 5.2 Inversão (U24) — **Essencial**
- **Estado:** `conditions.inversion` afeta cálculo (+14 mods), sem UI.
- **Jogabilidade:** alta, mesma natureza do HATE.
- **Fidelidade:** cálculo presente, controle ausente.
- **Dificuldade:** Baixa.

### 5.3 Classificação de armadura — **Importante**
- **Estado:** inferida por nome, sem controle explícito (ver 4.4).
- **Jogabilidade:** média.
- **Fidelidade:** média.
- **Dificuldade:** Média.

### 5.4 HATE/HOPE percentuais (J31/J32, T30/T31) — **Importante**
- **Estado:** inexistentes no modelo.
- **Jogabilidade:** média (recurso narrativo/mecânico da planilha).
- **Fidelidade:** divergência.
- **Dificuldade:** Média.

### 5.5 Sub-raças sem regra mecânica (Fantasma/Flor/Variados) — **Opcional**
- **Estado:** selecionáveis, bônus zero, com tooltip; coerente com a planilha (sem `IF`).
- **Jogabilidade:** baixa.
- **Fidelidade:** alinhado.
- **Dificuldade:** N/A.

---

## 6. Controles ausentes (toggles, checkboxes, selects)

### 6.1 Toggle HATE — **Essencial**
- **Impacto:** sem ele, o jogador não ativa/desativa o maior modificador de combate.
- **Dificuldade:** Baixa (`checkField` já existe no projeto).

### 6.2 Toggle Inversão — **Essencial**
- **Impacto:** mesmo caso do HATE.
- **Dificuldade:** Baixa.

### 6.3 Checkboxes de Armadura (Leve/Média/Pesada) — **Importante**
- **Impacto:** remove a fragilidade da inferência por nome (R21/R23/R25).
- **Dificuldade:** Média (modelo + UI + ajuste em `armorState`).

### 6.4 Atribuição/validação de pontos aplicados (H13) — **Importante**
- **Impacto:** sem soma/limite de pontos de atributo (`SUM(F15:F24)`), não há trava de criação de ficha.
- **Dificuldade:** Média.

---

## Observações de fidelidade já corretas (não são lacunas)

- Atributos FOR/CON/AGI/INT/MAG e modificadores `ROUNDDOWN(F/4)` + base racial + HATE/Inversão: fiéis (com INT sem HATE/Inversão, como na planilha).
- Derivados C.A, INI, ESQ, BLOQ, P.A, HP/PP máx: alinhados a `F26/E28/G28/H26/E30/K24/K27`.
- Sub-raças com regra (`SUB_RACE_SR`): conferem com `H15`–`X16`.
- Raça/Sub-raça como select de chaves canônicas: estruturalmente superior à string livre da planilha, sem perda de regra.

---

## Recomendação de priorização (sem implementar)

1. **Essenciais primeiro:** toggles de HATE e Inversão (baixo custo, alto impacto), seguidos de EXP/XP/NVL e dos blocos Dano/Cura/PP.
2. **Importantes:** checkboxes de armadura, bônus de perícia com atributo base, padronização de rótulos PV/PP/R.D., CASH na HUD.
3. **Opcionais:** Theme Song, Condição Atual separada, alinhamento cosmético de nomes de buff.

*Fim do relatório. Nenhuma alteração de código foi realizada.*
