# Auditoria de Paridade UI — Planilha vs Ficha

**Data:** 2026-06-03
**Fontes:** `docs/NiarTale_Documento_Continuidade.md`, `docs/Planilha Original.xlsx` (aba `Ficha`)
**Foco:** **usabilidade e controle**, não cálculo interno. A pergunta de cada item é: *o que o usuário vê/edita/controla na planilha e não consegue ver/editar/controlar na ficha?*

> Critério de inclusão: o item precisa ser **visível, editável ou um controle manual** na planilha **e** estar ausente, somente-leitura ou inalcançável na ficha. Itens com paridade de uso (mesmo que com nome/calc diferente) foram omitidos.

---

## Resumo executivo

| Classe | Itens |
|---|---|
| Crítico | 1 |
| Importante | 4 |
| Conveniência | 3 |

**Achado principal:** a planilha permite ao jogador **controlar o tipo de armadura** por marcação direta (`R21/R23/R25`). Na ficha **não existe nenhuma forma de fazer isso pela interface** — não há aba/tela de Equipamentos, e o tipo de armadura é apenas inferido por texto de um item equipado que, por sua vez, também não pode ser equipado pela UI.

---

## Tabela de paridade (somente lacunas)

| ID | Item | Planilha (vê / edita / controla) | Ficha (estado) | Classe |
|---|---|---|---|---|
| C1 | Tipo de armadura (Leve/Média/Pesada) | Vê e marca direto (`R21/R23/R25`) | Sem controle algum; nem aba de Equipamentos existe | Crítico |
| I1 | Bônus adicional de Redução de Dano | Edita `Y15` (R.D. Fís.) e `Y16` (R.D. Mag.) + tabela Tipo/Qtd | Apenas vê R.FIS/R.MAG (read-only); sem input | Importante |
| I2 | Condição Atual | Vê e edita texto livre (`T21`) separado de STATUS | Ausente (só existe `status`) | Importante |
| I3 | HATE % / HOPE % | Vê percentuais (`C3`, `AA3`, `J32`, `T31`) | HATE só booleano; HOPE inexistente | Importante |
| I4 | Bônus de perícia (com atributo base) | Vê coluna "Bônus" por perícia (`M`/`T`) | Vê um "+N" que não inclui o mod do atributo | Importante |
| V1 | Theme Song | Vê e edita texto (`M47`) | Ausente | Conveniência |
| V2 | CASH na visão principal | Vê CASH junto dos derivados (`G30/H30`) | Editável só na aba Recursos; fora do HUD | Conveniência |
| V3 | Equipar item / lista de equipamento | Inventário + armadura num bloco visível | `inventory` existe; `equipment`/`equipped` sem UI | Conveniência |

---

## Detalhamento

### C1 — Tipo de armadura: controle manual ausente (Crítico)
- **Planilha:** o jogador marca Armadura Leve/Média/Pesada (`R21`, `R23`, `R25`). É um **controle direto** que altera C.A., Esquiva e R.D. Física.
- **Ficha:** não há checkbox/seletor de armadura. O tipo é **inferido** pelo nome de um item `equipped`, mas **não existe aba de Equipamentos** (`SHEET_TABS` vai de Inventário direto a Notas) — logo o usuário **não tem como marcar um item como equipado** pela interface. O caminho de controle está totalmente fechado.
- **Impacto no jogador:** não consegue ativar/trocar armadura pela ficha; C.A./Esquiva/R.D. ficam erradas sem aviso e sem ação possível.
- **Impacto no mestre:** não consegue auditar ou ajustar a defesa de um personagem pela ficha; precisa recorrer à planilha.
- **Dificuldade:** Média. Reaproveita o `armorState`/cálculo existente; basta expor um controle (3 checkboxes ou um select) e persistir o estado. Sem mudança em `excelCalc`.

### I1 — Bônus adicional de Redução de Dano não editável (Importante)
- **Planilha:** colunas Tipo/Quantidade/`Bônus adc.` com `Y15`/`Y16` editáveis pelo usuário para somar R.D. Física/Mágica.
- **Ficha:** R.FIS/R.MAG aparecem apenas como métricas **read-only**. O modelo até tem `buffs.physicalReduction`/`buffs.magicReduction`, mas **a UI de Buffs só renderiza** `for/agi/int/mag/con/hp/pp` — esses dois campos não têm input.
- **Impacto no jogador:** não consegue registrar reduções extras (resistências situacionais) pela ficha.
- **Impacto no mestre:** não consegue conceder/ajustar R.D. adicional sem editar dados crus.
- **Dificuldade:** Baixa. Adicionar dois inputs ao card Buffs (campos já existem no modelo e no cálculo).

### I2 — Condição Atual ausente (Importante)
- **Planilha:** `T21` "Condição Atual" é um campo próprio, **separado** de STATUS (`J21`), para estados de combate (atordoado, sangrando, etc.).
- **Ficha:** existe só um `status` único (HUD + Geral). Não há onde registrar a condição de combate separadamente.
- **Impacto no jogador:** mistura identidade/estado e condição efêmera num só campo, ou perde o registro.
- **Impacto no mestre:** dificulta acompanhar condições ativas da mesa em combate.
- **Dificuldade:** Baixa. Novo campo de texto + default/normalização; sem impacto em cálculo.

### I3 — HATE % / HOPE % não exibidos (Importante)
- **Planilha:** mostra percentuais de HATE (`C3`, `J32`) e HOPE (`AA3`, `T31`) no topo da ficha — informação que o usuário **lê** constantemente.
- **Ficha:** HATE existe apenas como **toggle booleano**; HOPE **não existe** (nem visor, nem controle).
- **Impacto no jogador:** perde leitura de um recurso de mesa; HOPE é lacuna total.
- **Impacto no mestre:** não tem como exibir/conferir esses medidores pela ficha.
- **Dificuldade:** Média. Exige primeiro **definir a regra** dos percentuais (origem/limites) antes de expor; risco de tocar na origem do maior modificador do sistema.

### I4 — Bônus de perícia exibido sem o atributo base (Importante)
- **Planilha:** cada perícia mostra uma coluna "Bônus" (`M`/`T`) que **inclui o modificador do atributo base**.
- **Ficha:** a lista mostra `+N` calculado só com Treinado/Mestre/Extra; o número visível **diverge** do que a planilha apresenta.
- **Impacto no jogador:** lê um total menor que o real e precisa somar o atributo na mão a cada rolagem.
- **Impacto no mestre:** confere valores que não batem com a planilha.
- **Dificuldade:** Média. É exibição, mas `skillBonus` alimenta INI/ESQ/P.A — exige cuidado para mudar só a apresentação sem alterar os derivados.

### V1 — Theme Song ausente (Conveniência)
- **Planilha:** `M47` campo de texto livre para a música-tema.
- **Ficha:** não existe (só seria possível via "Campos extras" manual).
- **Impacto jogador/mestre:** puramente cosmético/imersivo.
- **Dificuldade:** Baixa. Um campo de texto na aba Geral.

### V2 — CASH fora da visão principal (Conveniência)
- **Planilha:** CASH (`G30/H30`) fica junto dos derivados, sempre à vista.
- **Ficha:** CASH é editável/visível **apenas** na aba Recursos; o HUD mostra LV/HP/MP/STATUS.
- **Impacto jogador/mestre:** baixo; é escaneabilidade, não ausência de dado.
- **Dificuldade:** Baixa. Incluir CASH no HUD ou nos derivados.

### V3 — Equipamentos sem interface (Conveniência / pré-requisito de C1)
- **Planilha:** inventário e armadura ficam num bloco visível e marcável.
- **Ficha:** há `inventory` (editável), mas o modelo `equipment` com `equipped` **não tem nenhuma tela**. O usuário não vê nem gerencia equipamentos.
- **Impacto jogador/mestre:** não há gestão de "o que está equipado"; é também o que **bloqueia** o C1.
- **Dificuldade:** Média. Nova aba/seção de Equipamentos; se resolvido, pode endereçar C1 junto.

---

## Itens com paridade de uso (omitidos, não são lacuna)

- **NOME, RAÇA, SUB-RAÇA, ALMAS** — vê/edita na ficha (Almas via campo extra padrão).
- **EXP, XP, LVL/NVL** — editáveis (LEVEL/NIVEL); **Aplicados** read-only nos dois (formula na planilha).
- **Atributos (valor) e modificadores** — valor editável, mod visível.
- **Buffs** principais (For/Agi/Int/Mag/Con/HP/PP) — editáveis (exceção: R.D., ver I1).
- **HATE / Inversão** — toggles editáveis na ficha.
- **CalculaDANO/CURA/PP/PP Rec + HP/PP Restante** — card "Fluxo de combate" (vê e edita).
- **Derivados** PV/PP/C.A/INI/ESQ/BLOQ/P.A — visíveis no painel Calculados.
- **STATUS, Notas, Inventário, História, Imagem (M46/avatar)** — vê/edita.

---

## Priorização sugerida (somente de controle/usabilidade)

1. **C1 + V3** — dar ao usuário controle de armadura/equipamento (fecha a maior lacuna de controle).
2. **I1** — expor inputs de R.D. adicional (baixo custo, modelo já existe).
3. **I2** — campo Condição Atual (baixo custo).
4. **I4** — alinhar exibição do bônus de perícia (cuidado com derivados).
5. **I3** — HATE/HOPE percentuais (depende de definição de regra).
6. **V1, V2** — Theme Song e CASH no HUD (cosméticos).

*Fim do relatório. Nenhuma alteração de código foi realizada.*
