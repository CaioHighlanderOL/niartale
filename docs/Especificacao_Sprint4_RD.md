# Especificação Técnica — Sprint 4: Exposição de Bônus de Redução de Dano

**Data:** 2026-06-03
**Fontes:** `docs/NiarTale_Documento_Continuidade.md`, `docs/Planilha Original.xlsx` (aba `Ficha`), `docs/Auditoria_Paridade_UI_Planilha.md`
**Escopo:** expor na interface os campos `buffs.physicalReduction` e `buffs.magicReduction`, permitindo ajuste manual dos bônus de R.D. Física e Mágica como na planilha.
**Origem:** item **I1** da auditoria de paridade de UI.
**Natureza:** especificação. **Não implementar.**

---

## 0. Contexto e descoberta principal

Os dois campos **já existem no modelo, na normalização e no cálculo** — falta apenas a **exposição na UI**. Esta sprint é, portanto, de baixo risco: não cria modelo novo nem altera fórmula; apenas adiciona dois inputs.

Evidências no código atual (`app.js`):

```245:245:app.js
    physicalReduction: 0, magicReduction: 0,
```

```360:360:app.js
    buffs: { for:0, agi:0, int:0, mag:0, con:0, hp:0, pp:0, physicalReduction:0, magicReduction:0 },
```

```1534:1535:app.js
  const physicalReduction = Math.round(armorRD + hateRD + (sr.rdFis ?? 0) + Number(buf.physicalReduction||0));
  const magicReduction    = Math.round(          hateRD + (sr.rdMag ?? 0) + Number(buf.magicReduction||0));
```

A UI do card "Buffs" itera apenas sobre 7 chaves, deixando `physicalReduction`/`magicReduction` de fora:

```982:984:app.js
        ["for","agi","int","mag","con","hp","pp"].map((k) =>
          field(k.toUpperCase(), c.buffs[k], (v) => updateNested(c, ["buffs",k], Number(v||0)), { type:"number", refresh:true })
        )
```

### Equivalência na planilha
| Célula | Significado | Consumo |
|---|---|---|
| `Y15` | Bônus adicional de R.D. Física ("Bônus adc.") | soma em `X15` (R.D. Fís.) |
| `Y16` | Bônus adicional de R.D. Mágica | soma em `X16` (R.D. Mag.) |

A planilha trata esses bônus como **entrada manual** somada às demais fontes (armadura, HATE, sub-raça). O app já reproduz a soma; só não oferece o campo de entrada.

---

## 1. Item — Expor `buffs.physicalReduction`

### Comportamento atual
- Valor existe (default `0`), é persistido e somado em `calc.physicalReduction`, mas **não há input**. O usuário vê o resultado em "R.FIS" (read-only) e não consegue ajustar o bônus manual.

### Comportamento esperado
- Um campo numérico editável no card "Buffs" (aba Atributos), rotulado de forma clara como bônus de R.D. Física (sugestão: `R.FIS` ou `RD FIS`).
- Editar o valor recalcula imediatamente `R.FIS` (mesma mecânica de `refresh` dos demais buffs).

### Impacto nos cálculos
- **Nenhuma alteração de fórmula.** `excelCalc` já consome `Number(buf.physicalReduction||0)` em `physicalReduction` (L1534).
- Efeito: `R.FIS = round(armorRD + hateRD + sr.rdFis + buffs.physicalReduction)`.
- Não afeta C.A., Esquiva, HP, PP, INI, BLOQ, P.A nem R.D. Mágica.

### Persistência
- Já coberta: `normalizeCharacter()` faz `buffs: { ...base.buffs, ...(data.buffs||{}) }`, garantindo `physicalReduction:0` em fichas antigas. Salvamento via `updateNested(c, ["buffs","physicalReduction"], …)`.
- (Opcional) incluir `physicalReduction`/`magicReduction` na coerção numérica de `sanitizeCharacterForPersist()` para robustez; não é obrigatório, pois `excelCalc` já coage com `Number(...||0)`.

### Arquivos afetados
- `app.js`: apenas a lista de chaves do card Buffs em `renderStats()` (L982) — adicionar `physicalReduction`.
- `docs/NiarTale_Documento_Continuidade.md`: nota de que o buff de R.D. Física é editável.
- `docs/Auditoria_Paridade_UI_Planilha.md`: marcar I1 endereçado.

### Riscos
- **Baixo.** Risco principal é apenas de rótulo: a sigla precisa diferenciar o **bônus de buff** do **R.FIS final** (read-only no painel Calculados) para não confundir o usuário.
- Sem risco de regressão de cálculo (fórmula intocada).

### Testes necessários
1. Campo aparece no card Buffs e edita `buffs.physicalReduction`.
2. Definir `+5` aumenta `R.FIS` em 5 (somado a armadura/HATE/sub-raça).
3. Reload preserva o valor.
4. Ficha antiga (sem o campo) abre com `0` e R.FIS inalterado.

---

## 2. Item — Expor `buffs.magicReduction`

### Comportamento atual
- Idêntico ao anterior: valor existe e é somado em `calc.magicReduction`, mas sem input. "R.MAG" é exibido read-only.

### Comportamento esperado
- Campo numérico editável no card "Buffs", rotulado como bônus de R.D. Mágica (sugestão: `R.MAG` ou `RD MAG`), com `refresh` imediato.

### Impacto nos cálculos
- **Nenhuma alteração de fórmula.** `excelCalc` já usa `Number(buf.magicReduction||0)` (L1535).
- Efeito: `R.MAG = round(hateRD + sr.rdMag + buffs.magicReduction)`.
- **Importante:** R.D. Mágica **não** recebe contribuição de armadura (por design da planilha) — manter assim. Só HATE, sub-raça e este buff somam.

### Persistência
- Já coberta pelo merge de `buffs` em `normalizeCharacter()`; default `0` em fichas antigas. Salvamento via `updateNested(c, ["buffs","magicReduction"], …)`.

### Arquivos afetados
- `app.js`: lista de chaves do card Buffs em `renderStats()` (L982) — adicionar `magicReduction`.
- Documentação: mesma nota de I1.

### Riscos
- **Baixo.** Mesmo cuidado de rótulo do item anterior; sem risco de cálculo.

### Testes necessários
1. Campo aparece e edita `buffs.magicReduction`.
2. Definir `+3` aumenta `R.MAG` em 3.
3. Equipar armadura **não** altera R.MAG (continua independente de `armorRD`).
4. Reload preserva; ficha antiga abre com `0`.

---

## 3. Estratégia recomendada de implementação (resumo)

- **Mínima e segura:** estender a lista de chaves iterada no card Buffs para incluir `physicalReduction` e `magicReduction`, reutilizando `field(...)` com `type:"number"` e `refresh:true`.
- **Rótulos via `field`:** como o card hoje usa `k.toUpperCase()`, os dois campos novos exigem rótulos legíveis (não basta o upper da chave). Sugestão: tratar esses dois com um pequeno mapa de rótulo (ex.: `RD FIS`, `RD MAG`) ou renderizá-los como dois `field` explícitos após o `map` das 7 chaves, evitando exibir "PHYSICALREDUCTION".
- **Sem migração eager**; compatibilidade já garantida pelo merge de `buffs`.

---

## 4. Requisitos a respeitar

| Requisito | Observação |
|---|---|
| Não alterar `excelCalc` | Já consome os dois campos; não tocar |
| Não alterar fórmulas de C.A./Esquiva/R.D. | A R.D. já soma os buffs; apenas expor a entrada |
| Não alterar identidade visual | Reusar `field`/`card` do card Buffs |
| Sem migração eager | Merge de `buffs` cobre fichas antigas |
| Compatibilidade total | Default `0`; comportamento idêntico até o usuário editar |

---

## 5. Critérios de aceite (GO da Sprint 4)

1. Usuário edita bônus de R.D. Física e Mágica pela aba Atributos.
2. `R.FIS`/`R.MAG` no painel Calculados refletem a soma imediatamente.
3. R.D. Mágica permanece independente de armadura.
4. Rótulos distinguem o buff de entrada do valor final calculado.
5. `excelCalc` inalterado; fichas antigas sem regressão.

---

## 6. Fora de escopo (Sprint 4)

- Tabela completa Tipo/Quantidade/Bônus da planilha (`W14/X14/Y14`) — esta sprint expõe só o bônus somado, não a estrutura tabular.
- I2 (Condição Atual), I3 (HATE/HOPE %), I4 (bônus de perícia), V1 (Theme Song), V2 (CASH no HUD) — sprints posteriores.
- Decisão sobre EN/Energia — permanece em avaliação própria.

*Fim da especificação. Nenhuma alteração de código foi realizada.*
