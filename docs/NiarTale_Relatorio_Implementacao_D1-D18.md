# NiarTale — Relatório de Implementação: D1–D18
**Data:** Junho 2026  
**Arquivo modificado:** `app.js`  
**Função:** `excelCalc` (linhas 993–1048 após a aplicação)  
**Escopo:** exclusivamente os cálculos de `excelCalc` — nenhum outro arquivo tocado  
**Status:** Implementado ✅

---

## Resumo executivo

18 divergências corrigidas em 8 expressões dentro de `excelCalc`. Uma variável auxiliar adicionada (`hateBoost`). Nenhuma outra função, nenhum arquivo de interface, CSS, Firebase ou permissões foi alterado.

---

## D1 — FOR mod: Réptil +4→+6 com buf.for excluído

**Linha:** 1006  

**Antes:**
```js
for: base("for") + raceBase + boost + (subRace==="anfibio"?2:0) + (subRace==="reptil"?4:0) + Number(buf.for||0),
```

**Depois:**
```js
for: base("for") + raceBase + boost + (subRace==="anfibio"?2:0) + (subRace==="alcadethes"?6:0) + (subRace==="reptil" ? 6 : Number(buf.for||0)),
```

**Impacto esperado:** FOR mod de Réptil sobe +2 (de +4 para +6). Buf Físico de Réptil passa a ser corretamente ignorado — conforme a planilha, onde Réptil recebe um valor fixo em vez do buff manual.

**Possíveis regressões:** Répteis que tiveram `buf.for` preenchido manualmente verão esse valor ignorado no cálculo de FOR mod — comportamento correto segundo a planilha. Nenhum derivado usa `mods.for` diretamente.

---

## D2 — FOR mod: Alcadethes +6 ausente

**Linha:** 1006 (mesma expressão de D1)  

**Antes:** nenhuma condição para Alcadethes em `mods.for`  

**Depois:**
```js
+ (subRace==="alcadethes"?6:0)   // inserido antes do ternário de Réptil
```

**Impacto esperado:** FOR mod de Alcadethes sobe +6 — corrige subavaliação existente.

**Possíveis regressões:** Nenhuma. `mods.for` não alimenta derivados de cascata. Alcadethes já recebia +6 em MAG mod (correto desde antes) — esta é a correção paralela de FOR.

---

## D3 — AGI mod: Esqueleto +4→+5

**Linha:** 1009  

**Antes:**
```js
(subRace==="esqueleto"?4:0)
```

**Depois:**
```js
(subRace==="esqueleto"?5:0)
```

**Impacto esperado:** `mods.agi` de Esqueleto sobe +1, propagando para `ca` (+1), `initiative` (+1) e `dodge` (+1 via initiative).

**Possíveis regressões:** Nenhuma de dados. Fichas de Esqueleto existentes terão C.A., INI e ESQ +1 mais altos — correção desejada.

---

## D4 — AGI mod: Parasita +4→+6

**Linha:** 1009  

**Antes:**
```js
(subRace==="parasita"?4:0)
```

**Depois:**
```js
(subRace==="parasita"?6:0)
```

**Impacto esperado:** `mods.agi` de Parasita sobe +2, propagando para `ca` (+2), `initiative` (+2), `dodge` (+2).

**Possíveis regressões:** Cumulativo com D11 (C.A. de Parasita também recebe +1 direto). O efeito total em C.A. de Parasita é +3 em relação ao código anterior.

---

## D5 — AGI mod: Aranha +6→+4 (par invertido com Parasita)

**Linha:** 1009  

**Antes:**
```js
(subRace==="aranha"?6:0)
```

**Depois:**
```js
(subRace==="aranha"?4:0)
```

**Impacto esperado:** `mods.agi` de Aranha cai -2, propagando para `ca` (-2), `initiative` (-2), `dodge` (-2). Os valores de Aranha (+4) e Parasita (+6) estavam literalmente trocados — ambos corrigidos juntos.

**Possíveis regressões:** Fichas de Aranha existentes perdem 2 pontos em C.A., INI e ESQ. Está correto segundo a planilha.

---

## D6 — HP máximo: Esqueleto -7→-10

**Linha:** 1016–1021  

**Antes:**
```js
const hpMax = Math.trunc(...) - (subRace==="esqueleto"?7:0) - ...
```

**Depois:**
```js
- (subRace==="esqueleto"?10:0)
```

**Impacto esperado:** HP máximo de Esqueleto cai -3 em relação ao valor anterior incorreto.

**Possíveis regressões:** Fichas de Esqueleto com `hp.current` entre `hpMax_novo` e `hpMax_antigo` ficam temporariamente com HP atual > máximo. O guard de L983 previne divisão por zero; a barra de progresso mostra >100% até ajuste manual pelo Mestre.

---

## D7 — HP máximo: Parasita -8→-10

**Linha:** 1016–1021  

**Antes:**
```js
- (subRace==="parasita"?8:0)
```

**Depois:**
```js
- (subRace==="parasita"?10:0)
```

**Impacto esperado:** HP máximo de Parasita cai -2 em relação ao valor anterior incorreto.

**Possíveis regressões:** Mesmo de D6 — `hp.current` pode ultrapassar o novo máximo. Guard em L983 previne crash.

---

## D8 — HP máximo: Elemental não tratado → retorna 0

**Linha:** 1015–1021  

**Antes:**
```js
const hpMax = Math.trunc(isMonster ? 10+mods.mag/2 : 20+mods.con) - ...
// Elemental calculava normalmente (sem guard)
```

**Depois:**
```js
const hpMax = subRace==="elemental" ? 0
  : Math.trunc(isMonster ? 10+mods.mag/2 : 20+mods.con) - ...
```

**Impacto esperado:** Elemental passa a ter `hpMax = 0` conforme a planilha. `buf.hp` é corretamente ignorado (a expressão retorna 0 diretamente, sem alcançar o `+ Number(buf.hp||0)`).

**Possíveis regressões:** A exibição textual mostrará `[current]/0` para Elementais — visualmente incomum. O guard `max ? (current/max*100) : 0` em L983 evita crash e divisão por zero. Fichas de Elemental com `hp.current > 0` ficarão com barra transbordando — requer ajuste manual de `hp.current` pelo Mestre.

---

## D9 — PP máximo: Elemental sem multiplicador ×2

**Linha:** 1023  

**Antes:**
```js
const ppMax = Math.trunc(isMonster ? 15+mods.mag : 7+mods.mag/2) + Number(buf.pp||0);
```

**Depois:**
```js
const ppMax = Math.trunc(isMonster ? 15+mods.mag : 7+mods.mag/2) * (subRace==="elemental"?2:1) + Number(buf.pp||0);
```

**Impacto esperado:** PP máximo de Elemental dobra (somente a base — `buf.pp` é somado depois do `×2`, não dobrado, conforme a planilha).

**Possíveis regressões:** Nenhuma. `pp.current` de Elementais existentes ficará abaixo do novo máximo — sem problema de overflow.

---

## D10 — C.A.: Réptil faltava −6 (líquido +2→−4)

**Linha:** 1025  

**Antes:**
```js
const ca = 10 + mods.agi + ... + (subRace==="reptil"?2:0) + (subRace==="parasita"?6:0);
```

**Depois:**
```js
const ca = 10 + mods.agi + ... + (subRace==="reptil"?2:0) - (subRace==="reptil"?6:0) + (subRace==="parasita"?7:0);
```

**Impacto esperado:** C.A. de Réptil cai -6 (de líquido +2 para líquido -4). Os dois ternários de Réptil são mantidos separados para espelhar a estrutura da planilha (dois IFs distintos).

**Possíveis regressões:** Répteis existentes perdem 6 pontos de C.A. — correção de sobrevalorização significativa.

---

## D11 — C.A.: Parasita +6→+7

**Linha:** 1025 (mesma expressão de D10)  

**Antes:**
```js
(subRace==="parasita"?6:0)
```

**Depois:**
```js
(subRace==="parasita"?7:0)
```

**Impacto esperado:** C.A. de Parasita sobe +1 pelo bônus direto, além do +2 em cascata de D4 via `mods.agi`. Efeito total: C.A. de Parasita +3 em relação ao código anterior.

**Possíveis regressões:** Nenhuma negativa — correto segundo a planilha.

---

## D12 — Esquiva: Réptil sem penalidade −6

**Linha:** 1028  

**Antes:**
```js
const dodge = initiative - (armor.heavy?6:0) - (armor.medium?3:0);
```

**Depois:**
```js
const dodge = initiative - (armor.heavy?6:0) - (armor.medium?3:0) - (subRace==="reptil"?6:0);
```

**Impacto esperado:** Esquiva de Réptil cai -6 (correção de sobrevalorização). `initiative` de Réptil não é afetada — as penalidades de `dodge` são aplicadas sobre `initiative` e independentes.

**Possíveis regressões:** Répteis existentes perdem 6 pontos de ESQ.

---

## D13 — RD Física: HateBoost +16 ausente

**Linha:** 1031–1038  
**Pré-requisito aplicado:** `const hateBoost = c.conditions?.hateBoost ?? false;` (linha 1002)  

**Antes:**
```js
const physicalReduction = Math.round((armor.light?5:0)+(armor.medium?10:0)+(armor.heavy?20:0)+Number(buf.physicalReduction||0));
```

**Depois:**
```js
const physicalReduction = Math.round(
  (armor.light?5:0) + (armor.medium?10:0) + (armor.heavy?20:0)
  + (hateBoost?16:0)
  + (subRace==="reptil"?22:0)
  + (subRace==="anfibio"?6:0)
  + Number(buf.physicalReduction||0)
);
```

**Impacto esperado:** Qualquer personagem com `conditions.hateBoost = true` passa a receber +16 em RD Física enquanto HATE estiver ativo.

**Possíveis regressões:** Nenhuma. O campo `hateBoost` só é `true` quando explicitamente ativado. A variável `hateBoost` é um alias de `c.conditions?.hateBoost` — não introduz nova leitura, apenas legibilidade.

---

## D14 — RD Física: Réptil +22 ausente

**Linha:** 1031–1038 (mesma expressão de D13)  

**Antes:** sem condição para Réptil em `physicalReduction`  

**Depois:**
```js
+ (subRace==="reptil"?22:0)
```

**Impacto esperado:** RD Física de Réptil sobe +22.

**Possíveis regressões:** Nenhuma — correto segundo a planilha.

---

## D15 — RD Física: Anfíbio +6 ausente

**Linha:** 1031–1038 (mesma expressão de D13)  

**Antes:** sem condição para Anfíbio em `physicalReduction`  

**Depois:**
```js
+ (subRace==="anfibio"?6:0)
```

**Impacto esperado:** RD Física de Anfíbio sobe +6.

**Possíveis regressões:** Nenhuma.

---

## D16 — RD Mágica: Réptil +5→+22

**Linha:** 1039–1045  

**Antes:**
```js
const magicReduction = Math.round(Number(buf.magicReduction||0)+(subRace==="reptil"?5:0));
```

**Depois:**
```js
const magicReduction = Math.round(
  (subRace==="reptil"?22:0)
  + (hateBoost?16:0)
  + (subRace==="anfibio"?6:0)
  + Number(buf.magicReduction||0)
);
```

**Impacto esperado:** RD Mágica de Réptil sobe +17 (de +5 para +22).

**Possíveis regressões:** Nenhuma — correto segundo a planilha. Maior delta numérico desta sessão (+17).

---

## D17 — RD Mágica: HateBoost +16 ausente

**Linha:** 1039–1045 (mesma expressão de D16)  

**Antes:** sem condição para `hateBoost` em `magicReduction`  

**Depois:**
```js
+ (hateBoost?16:0)
```

**Impacto esperado:** Personagens com HATE ativo ganham +16 RD Mágica — simétrico ao D13 em RD Física.

**Possíveis regressões:** Nenhuma.

---

## D18 — RD Mágica: Anfíbio +6 ausente

**Linha:** 1039–1045 (mesma expressão de D16)  

**Antes:** sem condição para Anfíbio em `magicReduction`  

**Depois:**
```js
+ (subRace==="anfibio"?6:0)
```

**Impacto esperado:** RD Mágica de Anfíbio sobe +6 — simétrico ao D15 em RD Física.

**Possíveis regressões:** Nenhuma.

---

## Tabela consolidada de impactos por sub-raça

| Sub-raça / Condição | Stat | Δ vs. código anterior | Direção |
|---|---|---|---|
| Réptil | FOR mod | +2 | ↑ corrige |
| Alcadethes | FOR mod | +6 | ↑ corrige |
| Esqueleto | AGI mod | +1 | ↑ corrige |
| Esqueleto | C.A. | +1 (cascata agi) | ↑ corrige |
| Esqueleto | INI | +1 (cascata agi) | ↑ corrige |
| Esqueleto | ESQ | +1 (cascata agi) | ↑ corrige |
| Esqueleto | HP máximo | −3 | ↓ corrige |
| Parasita | AGI mod | +2 | ↑ corrige |
| Parasita | C.A. | +3 (+2 cascata agi + +1 direto) | ↑ corrige |
| Parasita | INI | +2 (cascata agi) | ↑ corrige |
| Parasita | ESQ | +2 (cascata agi) | ↑ corrige |
| Parasita | HP máximo | −2 | ↓ corrige |
| Aranha | AGI mod | −2 | ↓ corrige |
| Aranha | C.A. | −2 (cascata agi) | ↓ corrige |
| Aranha | INI | −2 (cascata agi) | ↓ corrige |
| Aranha | ESQ | −2 (cascata agi) | ↓ corrige |
| Elemental | HP máximo | 0 fixo (era 20+CON) | ↓ corrige |
| Elemental | PP máximo | ×2 na base | ↑ corrige |
| Réptil | C.A. | −6 (líquido +2→−4) | ↓ corrige |
| Réptil | ESQ | −6 | ↓ corrige |
| Réptil | RD Física | +22 | ↑ corrige |
| Réptil | RD Mágica | +17 (+5→+22) | ↑ corrige |
| Anfíbio | RD Física | +6 | ↑ corrige |
| Anfíbio | RD Mágica | +6 | ↑ corrige |
| Qualquer (HATE ativo) | RD Física | +16 | ↑ corrige |
| Qualquer (HATE ativo) | RD Mágica | +16 | ↑ corrige |
| Humano / Monstro sem sub-raça | todos | 0 | — sem alteração |

---

## Regressões que requerem atenção do Mestre

Três sub-raças podem ter `hp.current > hpMax` após a correção:

| Sub-raça | Causa | HP máximo muda | Ação recomendada |
|---|---|---|---|
| Esqueleto | D6: penalidade −7→−10 | −3 | Revisar `hp.current` de fichas existentes |
| Parasita | D7: penalidade −8→−10 | −2 | Revisar `hp.current` de fichas existentes |
| Elemental | D8: HP fixo em 0 | de 20+ para 0 | Zerar ou ajustar `hp.current` manualmente |

**Comportamento em caso de overflow:** o guard `max ? (current/max*100) : 0` em L983 previne divisão por zero e crash. A barra de progresso exibirá >100% até o ajuste manual. Nenhuma perda de dados ocorre.

---

## Verificação de escopo

| Arquivo | Alterado? |
|---|---|
| `app.js` | ✅ somente `excelCalc` (L1001–L1045) |
| `styles.css` | ✗ não tocado |
| `index.html` | ✗ não tocado |
| `firebase.js` | ✗ não tocado |
| `firestore.rules` | ✗ não tocado |
| `firebase.json` | ✗ não tocado |

Funções em `app.js` fora de `excelCalc` não foram alteradas: `skillBonus`, `armorState`, `customFieldVal`, `norm`, `renderStats`, `calculatedPanel`, `updateChar`, `saveChar` e todas as demais permanecem intactas.
