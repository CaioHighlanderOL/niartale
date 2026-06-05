# Especificacao Tecnica — Sprint 5: Pericias com Atributo Base

**Data:** 2026-06-04
**Fontes:** `docs/NiarTale_Documento_Continuidade.md`, `docs/Planilha Original.xlsx` (aba `Ficha`), `docs/Paridade_Atual_Pos_Sprint4.md`, codigo `app.js`
**Escopo:** pericias com atributo base (item P1/I4 do roadmap/paridade).
**Natureza:** especificacao. **Nao implementar.**

---

## 0. Descoberta critica (releitura da planilha)

A premissa dos relatorios de paridade anteriores — "a coluna Bonus da planilha inclui o modificador de atributo" — **esta incorreta**. As formulas reais da aba `Ficha` foram extraidas e mostram:

| Celula | Formula real | Significado |
|---|---|---|
| `M6:M18` (Bonus, coluna esquerda) | `IF(K6,5,0)+IF(L6,10,0)+N6` | Treinado(+5) + Mestre(+10) + Extra |
| `T6:T18` (Bonus, coluna direita) | `IF(R6,5,0)+IF(S6,10,0)+U6` | Treinado(+5) + Mestre(+10) + Extra |

Ou seja, **a coluna "Bonus" por pericia NAO soma modificador de atributo** — e exatamente o que `skillBonus()` ja faz no app:

```text
(trained ? 5 : 0) + (master ? 10 : 0) + Number(extra || 0)
```

O modificador de atributo aparece **apenas nos derivados**, e o app ja reproduz isso fielmente:

| Celula | Formula real | App (`excelCalc`) |
|---|---|---|
| `F28` (INI) | `H19 + T15` | `initiative = mods.agi + skillBonus(c,"Reflexo")` |
| `F30` (P.A.) | `H21 + T12` | `pa = mods.int + skillBonus(c,"Percepcao")` |
| `H28` (ESQ) | `(H19+T15) - IF(R25,6,0) - IF(R23,3,0) - IF(G8="Réptil",6,0)` | `dodge = initiative - armorDodgePen - sr.dodgePen` |

**Conclusao:** nao existe, na planilha, um mapeamento pericia -> atributo, nem soma de atributo na linha da pericia. O app **ja esta fiel**. Portanto, "pericias com atributo base" **nao e uma correcao de fidelidade**; seria uma **nova decisao de design (house rule / conveniencia de UX)**.

---

## 1. Comportamento atual

- A aba `Pericias` lista 26 pericias; cada linha mostra `+N` calculado por `skillBonus()` = Treinado/Mestre/Extra.
- Esse `+N` **coincide** com a coluna "Bonus" da planilha (`Mx`/`Tx`).
- O atributo de governanca so e somado em INI (AGI), P.A. (INT) e ESQ (AGI), exatamente como na planilha.
- Nao ha mapeamento pericia -> atributo no modelo nem na planilha.

---

## 2. Comportamento esperado (decisao de produto necessaria)

Como a planilha nao define o recurso, ha duas opcoes honestas. **Recomenda-se a Opcao A.**

### Opcao A (recomendada) — Nao alterar; manter fidelidade
- Manter `skillBonus()` e a exibicao como estao (fieis a `Mx`/`Tx`).
- Encerrar P1/I4 como **"sem acao por fidelidade"**, documentando que a planilha nao soma atributo por pericia.
- Custo zero, risco zero. Atualizar `Paridade_Atual_Pos_Sprint4.md` e o roadmap para refletir a releitura.

### Opcao B (opcional) — Total de rolagem como exibicao informativa (house rule)
Se a mesa **quiser** ver, por pericia, um "total de rolagem" que inclua o atributo de governanca (convencao comum de RPG, ausente na planilha):

- Exibir, **alem** do `Bonus` atual, um segundo numero "Total" = `Bonus + mod(atributo de governanca)`.
- O `Bonus` original permanece visivel e inalterado (e o valor da planilha).
- Exige **definir e aprovar** um mapeamento pericia -> atributo (NAO existe na planilha — seria invencao do projeto). Sem esse mapeamento confirmado, a Opcao B nao deve ser implementada.
- Estritamente **display**: nao entra em nenhum calculo derivado.

---

## 3. Impacto em `skillBonus()`

- **Opcao A:** nenhum. `skillBonus()` permanece intacto.
- **Opcao B:** `skillBonus()` **NAO deve ser alterado**. O total com atributo deve ser calculado por uma funcao **separada** (ex.: `skillRollTotal(c, name)`), puramente de exibicao. Alterar `skillBonus()` para incluir atributo causaria dupla contagem em INI/ESQ/P.A. (ver secao 4) e e proibido.

---

## 4. Impacto em INI / ESQ / P.A. (cascata critica)

`skillBonus()` alimenta tres derivados:

- **INI** = `mods.agi + skillBonus("Reflexo")`
- **ESQ** = `initiative - penalidades` (depende de INI, logo de `skillBonus("Reflexo")`)
- **P.A.** = `mods.int + skillBonus("Percepcao")`

Se o atributo fosse adicionado **dentro** de `skillBonus()`:

- INI viraria `AGI + (Reflexo + AGI)` = **AGI contado duas vezes**.
- ESQ herdaria o mesmo erro (parte de INI).
- P.A. viraria `INT + (Percepcao + INT)` = **INT em dobro**.

Portanto:
- **Opcao A:** INI/ESQ/P.A. inalterados. ✓
- **Opcao B:** INI/ESQ/P.A. **devem continuar usando `skillBonus()` cru** (sem atributo). O "Total" por pericia e somente visual e nunca substitui `skillBonus` nessas formulas.

---

## 5. Persistencia

- **Nenhuma mudanca de modelo em nenhuma das opcoes.**
- Pericias continuam `{ id, name, trained, master, extra }`.
- O "Total" da Opcao B e **derivado em render** (como `Aplicados`), nao persistido.
- Nao ha migracao (eager ou lazy).
- `firestore.rules` inalterado.

---

## 6. Riscos de regressao

| Risco | Opcao | Severidade | Mitigacao |
|---|---|---|---|
| Dupla contagem de atributo em INI/ESQ/P.A. | B | Alto | Nunca alterar `skillBonus()`; usar funcao separada so para exibicao |
| Divergencia da planilha (somar atributo onde a planilha nao soma) | B | Medio | Tratar como house rule explicita; manter o `Bonus` original visivel |
| Mapeamento pericia -> atributo invencionado | B | Medio | Exigir aprovacao do mapeamento antes de codar; sem mapeamento, nao implementar |
| Confusao visual entre `Bonus` e `Total` | B | Baixo | Rotulos distintos e claros |
| Nenhum | A | Nulo | Sem alteracao de codigo |

---

## 7. Recomendacao final

**Adotar a Opcao A.** A releitura da planilha mostra que o app ja e fiel: a coluna "Bonus" por pericia nao inclui atributo, e o atributo ja e somado corretamente em INI/ESQ/P.A. O item P1/I4 deve ser **reclassificado como concluido por fidelidade / sem acao**, e os documentos de paridade/roadmap atualizados.

A Opcao B so deve ser aberta se houver **decisao explicita de produto** por uma house rule de "total de rolagem por pericia", acompanhada de um mapeamento pericia -> atributo aprovado. Nesse caso, sera estritamente display, com `skillBonus()` intocado.

---

## 8. Criterios de aceite

### Se Opcao A
1. Nenhuma alteracao de codigo.
2. `Paridade_Atual_Pos_Sprint4.md` e roadmap atualizados removendo P1/I4 como pendencia de fidelidade.

### Se Opcao B
1. Cada pericia mostra `Bonus` (inalterado) e `Total` (= Bonus + mod do atributo mapeado).
2. `skillBonus()` inalterado; INI/ESQ/P.A. com os mesmos valores de hoje.
3. Mapeamento pericia -> atributo documentado e aprovado.
4. Nenhuma persistencia nova; total recalculado em render.
5. Bateria `docs/Testes_Regressao.md` (T-DER-02, T-DER-03) passa sem mudanca de valores.

---

## 9. Fora de escopo

- Alterar formulas de INI/ESQ/P.A. ou `excelCalc`.
- Persistir total de pericia.
- Criar mapeamento mecanico pericia -> atributo sem aprovacao.

*Fim da especificacao. Nenhuma alteracao de codigo foi realizada.*
