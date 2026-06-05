# Bateria de Testes de Regressao — NiarTale

**Data:** 2026-06-05  
**Fontes:** `docs/NiarTale_Documento_Continuidade.md`, `docs/Planilha Original.xlsx`, `docs/Roadmap_Atualizado.md`, relatorios de sprints concluidas, auditorias e `app.js`  
**Objetivo:** validar que atributos, derivados, HP, PP, raca, sub-raca, combate, equipamentos, armaduras, resistencias, progressao, permissoes e Campos Extras continuam fieis as formulas da planilha e ao comportamento atual do sistema.

---

## 0. Fixture base

Use esta ficha base em todos os testes, salvo quando a pre-condicao indicar alteracao:

```text
race: humano
subRace: nenhum
attributes: FOR=8, CON=8, AGI=8, INT=8, MAG=8
buffs: for=0, con=0, agi=0, int=0, mag=0, hp=0, pp=0, physicalReduction=0, magicReduction=0
conditions: hateBoost=false, inversion=false
skills: todas sem Treinado, sem Mestre, extra=0
equipment: sem armadura equipada
combat: todos os arrays zerados
exp=0, xp=0, lv=1, nvl=0
```

Resultado esperado da fixture base:

```text
mods: FOR=3, CON=3, AGI=3, INT=3, MAG=3
HP=23
PP=8
C.A.=13
BLOQ=3
INI=3
ESQ=3
P.A.=3
R.FIS=0
R.MAG=0
HP Restante=23
PP Restante=8
Aplicados=40
```

Referencias de formula:

- Modificadores: `ROUNDDOWN(atributo/4,0) + base racial + buffs/sub-raca`.
- HP (`K24`): Humano `20 + CON`; Monstro `10 + MAG/2`; Elemental `0`.
- PP (`K27`): Humano `7 + MAG/2`; Monstro `15 + MAG`; Elemental dobra a base.
- C.A. (`F26`): `10 + AGI + armadura + sub-raca`.
- BLOQ (`H26`): `CON - 3 se Monstro - 5 se Parasita`.
- INI (`F28`): `AGI + Reflexo`.
- ESQ (`H28`): `INI - penalidade de armadura media/pesada - penalidade Reptil`.
- P.A. (`F30`): `INT + Percepcao`.
- R.FIS (`X15`): armadura + HATE + `RD FIS` + sub-raca.
- R.MAG (`X16`): HATE + `RD MAG` + sub-raca.
- Pericia: `Treinado ? 5 : 0` + `Mestre ? 10 : 0` + `Extra`.
- Aplicados (`H13`): soma dos valores brutos de FOR, CON, AGI, INT e MAG.

---

## 1. Atributos

### T-ATR-01 — Modificadores basicos de Humano

- **Pre-condicao:** fixture base.
- **Acao:** abrir a aba Atributos ou avaliar `excelCalc(c)`.
- **Resultado esperado:** FOR=3, CON=3, AGI=3, INT=3, MAG=3.

### T-ATR-02 — Arredondamento para baixo

- **Pre-condicao:** fixture base com todos os atributos em `7`.
- **Acao:** recalcular a ficha.
- **Resultado esperado:** todos os modificadores = `2` (`ROUNDDOWN(7/4)=1` + base racial humano `1`).

### T-ATR-03 — Buffs de atributo

- **Pre-condicao:** fixture base com `buffs.for=2`, `buffs.con=3`, `buffs.agi=4`, `buffs.int=5`, `buffs.mag=6`.
- **Acao:** recalcular a ficha.
- **Resultado esperado:** FOR=5, CON=6, AGI=7, INT=8, MAG=9.

### T-ATR-04 — HATE afeta FOR/CON/AGI/MAG, nao INT

- **Pre-condicao:** fixture base com `conditions.hateBoost=true`.
- **Acao:** recalcular a ficha.
- **Resultado esperado:** FOR=33, CON=33, AGI=33, INT=3, MAG=33.

### T-ATR-05 — Inversao afeta FOR/CON/AGI/MAG, nao INT

- **Pre-condicao:** fixture base com `conditions.inversion=true`.
- **Acao:** recalcular a ficha.
- **Resultado esperado:** FOR=17, CON=17, AGI=17, INT=3, MAG=17.

### T-ATR-06 — HATE + Inversao acumulam

- **Pre-condicao:** fixture base com `conditions.hateBoost=true` e `conditions.inversion=true`.
- **Acao:** recalcular a ficha.
- **Resultado esperado:** FOR=47, CON=47, AGI=47, INT=3, MAG=47.

---

## 2. HP

### T-HP-01 — HP de Humano

- **Pre-condicao:** fixture base.
- **Acao:** recalcular HP.
- **Resultado esperado:** HP=23 (`20 + CON 3`).

### T-HP-02 — HP de Monstro

- **Pre-condicao:** fixture base com `race=monstro`.
- **Acao:** recalcular HP.
- **Resultado esperado:** HP=11 (`ROUNDDOWN(10 + MAG 3/2)`).

### T-HP-03 — Buff de HP

- **Pre-condicao:** fixture base com `buffs.hp=10`.
- **Acao:** recalcular HP.
- **Resultado esperado:** HP=33.

### T-HP-04 — Elemental zera HP

- **Pre-condicao:** fixture base com `subRace=elemental` e `buffs.hp=10`.
- **Acao:** recalcular HP.
- **Resultado esperado:** HP=0. O buff de HP nao deve ser aplicado quando Elemental zera HP.

### T-HP-05 — Penalidade de Esqueleto

- **Pre-condicao:** fixture base com `subRace=esqueleto`.
- **Acao:** recalcular HP.
- **Resultado esperado:** HP=13 (`23 - 10`).

### T-HP-06 — Penalidade de Parasita

- **Pre-condicao:** fixture base com `subRace=parasita`.
- **Acao:** recalcular HP.
- **Resultado esperado:** HP=3 (`20 + CON(-7) - 10`).

### T-HP-07 — Alcadethes soma CON adicional

- **Pre-condicao:** fixture base com `subRace=alcadethes`.
- **Acao:** recalcular HP.
- **Resultado esperado:** HP=26 (`20 + CON 3 + CON adicional 3`).

---

## 3. PP

### T-PP-01 — PP de Humano

- **Pre-condicao:** fixture base.
- **Acao:** recalcular PP.
- **Resultado esperado:** PP=8 (`ROUNDDOWN(7 + MAG 3/2)`).

### T-PP-02 — PP de Monstro

- **Pre-condicao:** fixture base com `race=monstro`.
- **Acao:** recalcular PP.
- **Resultado esperado:** PP=18 (`15 + MAG 3`).

### T-PP-03 — Buff de PP

- **Pre-condicao:** fixture base com `buffs.pp=5`.
- **Acao:** recalcular PP.
- **Resultado esperado:** PP=13.

### T-PP-04 — Elemental dobra a base antes do buff

- **Pre-condicao:** fixture base com `subRace=elemental` e `buffs.pp=5`.
- **Acao:** recalcular PP.
- **Resultado esperado:** PP=21 (`base 8 * 2 + buff 5`).

---

## 4. Derivados

### T-DER-01 — Derivados basicos

- **Pre-condicao:** fixture base.
- **Acao:** recalcular derivados.
- **Resultado esperado:** C.A.=13, BLOQ=3, INI=3, ESQ=3, P.A.=3, R.FIS=0, R.MAG=0.

### T-DER-02 — Reflexo alimenta INI e ESQ

- **Pre-condicao:** fixture base com pericia `Reflexo` treinada e `extra=2`.
- **Acao:** recalcular derivados.
- **Resultado esperado:** `skillBonus(Reflexo)=7`, INI=10 (`AGI 3 + 7`) e ESQ=10.

### T-DER-03 — Percepcao alimenta P.A.

- **Pre-condicao:** fixture base com pericia `Percepcao` mestre e `extra=1`.
- **Acao:** recalcular derivados.
- **Resultado esperado:** `skillBonus(Percepcao)=11`, P.A.=14 (`INT 3 + 11`).

### T-DER-04 — Monstro reduz Bloqueio

- **Pre-condicao:** fixture base com `race=monstro`.
- **Acao:** recalcular derivados.
- **Resultado esperado:** BLOQ=0 (`CON 3 - 3`).

### T-DER-05 — INT nao recebe HATE/Inversao

- **Pre-condicao:** fixture base com HATE e Inversao ligados.
- **Acao:** recalcular P.A. sem bonus de Percepcao.
- **Resultado esperado:** P.A.=3, pois INT permanece 3.

---

## 5. Raca

### T-RAC-01 — Humano aplica base racial +1

- **Pre-condicao:** fixture base com atributos 8.
- **Acao:** recalcular modificadores.
- **Resultado esperado:** todos os modificadores base = 3.

### T-RAC-02 — Monstro aplica base racial +1 e formulas proprias de HP/PP

- **Pre-condicao:** fixture base com `race=monstro`.
- **Acao:** recalcular ficha.
- **Resultado esperado:** mods = 3 em todos; HP=11; PP=18; BLOQ=0.

### T-RAC-03 — Nenhum nao aplica base racial

- **Pre-condicao:** fixture base com `race=nenhum`.
- **Acao:** recalcular ficha.
- **Resultado esperado:** mods = 2 em todos; HP=0; PP=0; C.A.=12; BLOQ=2; INI=2; ESQ=2; P.A.=2.

### T-RAC-04 — Normalizacao de raca desconhecida

- **Pre-condicao:** ficha com `race="Dragao"` antes do save/load.
- **Acao:** normalizar/salvar a ficha.
- **Resultado esperado:** `race` vira `nenhum`; deve haver warning de raca nao reconhecida quando aplicavel.

---

## 6. Sub-raca

### T-SUB-01 — Anfibio

- **Pre-condicao:** fixture base com `subRace=anfibio`.
- **Acao:** recalcular ficha.
- **Resultado esperado:** FOR=5, AGI=5, HP=23, PP=8, C.A.=15, INI=5, ESQ=5, R.FIS=6, R.MAG=6.

### T-SUB-02 — Alcadethes

- **Pre-condicao:** fixture base com `subRace=alcadethes`.
- **Acao:** recalcular ficha.
- **Resultado esperado:** FOR=9, CON=3, AGI=0, MAG=9, HP=26, PP=11, C.A.=10.

### T-SUB-03 — Reptil

- **Pre-condicao:** fixture base com `subRace=reptil`.
- **Acao:** recalcular ficha.
- **Resultado esperado:** FOR=9, AGI=3, C.A.=9 (`10+3+2-6`), INI=3, ESQ=-3, R.FIS=22, R.MAG=22.

### T-SUB-04 — Reptil ignora buff de FOR

- **Pre-condicao:** fixture base com `subRace=reptil` e `buffs.for=99`.
- **Acao:** recalcular FOR.
- **Resultado esperado:** FOR=9; o buff de FOR nao entra para Reptil.

### T-SUB-05 — Esqueleto

- **Pre-condicao:** fixture base com `subRace=esqueleto`.
- **Acao:** recalcular ficha.
- **Resultado esperado:** AGI=8, HP=13, C.A.=18, INI=8, ESQ=8.

### T-SUB-06 — Parasita

- **Pre-condicao:** fixture base com `subRace=parasita`.
- **Acao:** recalcular ficha.
- **Resultado esperado:** CON=-7, AGI=9, HP=3, C.A.=26, BLOQ=-12.

### T-SUB-07 — Aranha

- **Pre-condicao:** fixture base com `subRace=aranha`.
- **Acao:** recalcular ficha.
- **Resultado esperado:** AGI=7, C.A.=17, INI=7, ESQ=7.

### T-SUB-08 — Elemental

- **Pre-condicao:** fixture base com `subRace=elemental`.
- **Acao:** recalcular ficha.
- **Resultado esperado:** HP=0; PP=16; demais modificadores iguais a fixture base.

### T-SUB-09 — Sub-racas nominais sem mecanica

- **Pre-condicao:** fixture base com `subRace=fantasma`, depois `flor`, depois `variados`, depois `boneco magico`.
- **Acao:** recalcular ficha em cada sub-raca.
- **Resultado esperado:** todos os derivados iguais aos da fixture base; nenhuma entrada deve existir em `SUB_RACE_SR` para essas chaves.

### T-SUB-10 — Normalizacao de sub-raca desconhecida

- **Pre-condicao:** ficha com `subRace="Dragao"` antes do save/load.
- **Acao:** normalizar/salvar a ficha.
- **Resultado esperado:** `subRace` vira `nenhum`; deve haver warning de sub-raca nao reconhecida quando aplicavel.

---

## 7. Combate

### T-CBT-01 — HP Restante com dano e cura

- **Pre-condicao:** fixture base com `combat.hpDamage=[3,4,0,0,0]` e `combat.hpHeal=[2,0,0,0,0]`.
- **Acao:** recalcular `combatFlow(c, calc)`.
- **Resultado esperado:** dano total=7; cura total=2; HP Restante=18 (`23 - 7 + 2`).

### T-CBT-02 — PP Restante com gasto e recuperacao

- **Pre-condicao:** fixture base com `combat.ppSpend=[2,1,0,0,0]` e `combat.ppRecover=[5,0,0,0,0]`.
- **Acao:** recalcular `combatFlow(c, calc)`.
- **Resultado esperado:** gasto total=3; recuperacao total=5; PP Restante=10 (`8 - 3 + 5`).

### T-CBT-03 — Fluxo de combate nao altera HP/PP atuais automaticamente

- **Pre-condicao:** fixture base com `resources.hp.current=23`, `resources.mp.current=8`, `combat.hpDamage=[10,0,0,0,0]`, `combat.ppSpend=[4,0,0,0,0]`.
- **Acao:** recalcular e salvar.
- **Resultado esperado:** HP Restante=13 e PP Restante=4; `resources.hp.current` continua 23 e `resources.mp.current` continua 8, salvo se o usuario alterar manualmente.

### T-CBT-04 — Valores negativos sao normalizados para zero

- **Pre-condicao:** ficha com valores negativos em arrays de `combat` ou digitacao negativa nos campos de fluxo.
- **Acao:** normalizar/salvar.
- **Resultado esperado:** valores negativos viram 0; arrays ficam completos com 5 posicoes.

---

## 8. Equipamentos

### T-EQP-01 — Equipamento nao equipado nao afeta calculos

- **Pre-condicao:** fixture base com item `{ equipped:false, armorType:"pesada", name:"Armadura Pesada" }`.
- **Acao:** recalcular ficha.
- **Resultado esperado:** C.A.=13, ESQ=3, R.FIS=0.

### T-EQP-02 — Equipar item aplica armorType explicito

- **Pre-condicao:** fixture base com item `{ equipped:true, armorType:"leve", name:"Qualquer nome" }`.
- **Acao:** recalcular ficha.
- **Resultado esperado:** C.A.=15, ESQ=3, R.FIS=5.

### T-EQP-03 — armorType explicito tem prioridade sobre nome

- **Pre-condicao:** fixture base com item `{ equipped:true, armorType:"leve", name:"Armadura Pesada" }`.
- **Acao:** recalcular ficha.
- **Resultado esperado:** tratar como leve: C.A.=15, ESQ=3, R.FIS=5. Nao pode aplicar pesada pelo nome.

### T-EQP-04 — Fallback por nome para ficha antiga

- **Pre-condicao:** fixture base com item legado `{ equipped:true, armorType:"", slot:"Armadura", name:"Armadura Pesada" }`.
- **Acao:** recalcular ficha.
- **Resultado esperado:** tratar como pesada por fallback: C.A.=7, ESQ=-3, R.FIS=20.

### T-EQP-05 — Duplicar mesmo tipo nao deve contar duas vezes

- **Pre-condicao:** fixture base com dois itens equipados `armorType="leve"`.
- **Acao:** recalcular ficha.
- **Resultado esperado:** apenas flag leve ativa: C.A.=15, ESQ=3, R.FIS=5.

---

## 9. Armaduras

### T-ARM-01 — Armadura leve

- **Pre-condicao:** fixture base com uma armadura leve equipada.
- **Acao:** recalcular derivados.
- **Resultado esperado:** C.A.=15; ESQ=3; R.FIS=5.

### T-ARM-02 — Armadura media

- **Pre-condicao:** fixture base com uma armadura media equipada.
- **Acao:** recalcular derivados.
- **Resultado esperado:** C.A.=10 (`13 - 3`); ESQ=0 (`3 - 3`); R.FIS=10.

### T-ARM-03 — Armadura pesada

- **Pre-condicao:** fixture base com uma armadura pesada equipada.
- **Acao:** recalcular derivados.
- **Resultado esperado:** C.A.=7 (`13 - 6`); ESQ=-3 (`3 - 6`); R.FIS=20.

### T-ARM-04 — Leve + Media acumulam flags de planilha

- **Pre-condicao:** fixture base com uma armadura leve e uma media equipadas.
- **Acao:** recalcular derivados.
- **Resultado esperado:** C.A.=12 (`13 + 2 - 3`); ESQ=0; R.FIS=15.

### T-ARM-05 — Media + Pesada acumulam penalidades

- **Pre-condicao:** fixture base com uma armadura media e uma pesada equipadas.
- **Acao:** recalcular derivados.
- **Resultado esperado:** C.A.=4 (`13 - 3 - 6`); ESQ=-6 (`3 - 3 - 6`); R.FIS=30.

---

## 10. Resistencias

### T-RES-01 — Buffs RD FIS e RD MAG

- **Pre-condicao:** fixture base com `buffs.physicalReduction=4` e `buffs.magicReduction=5`.
- **Acao:** recalcular resistencias.
- **Resultado esperado:** R.FIS=4; R.MAG=5.

### T-RES-02 — HATE soma resistencia fisica e magica

- **Pre-condicao:** fixture base com `conditions.hateBoost=true`.
- **Acao:** recalcular resistencias.
- **Resultado esperado:** R.FIS=16; R.MAG=16.

### T-RES-03 — Armadura afeta apenas R.FIS

- **Pre-condicao:** fixture base com armadura pesada equipada.
- **Acao:** recalcular resistencias.
- **Resultado esperado:** R.FIS=20; R.MAG=0.

### T-RES-04 — Anfibio soma R.FIS e R.MAG

- **Pre-condicao:** fixture base com `subRace=anfibio`.
- **Acao:** recalcular resistencias.
- **Resultado esperado:** R.FIS=6; R.MAG=6.

### T-RES-05 — Reptil soma R.FIS e R.MAG

- **Pre-condicao:** fixture base com `subRace=reptil`.
- **Acao:** recalcular resistencias.
- **Resultado esperado:** R.FIS=22; R.MAG=22.

### T-RES-06 — Composicao de resistencia fisica

- **Pre-condicao:** fixture base com `subRace=anfibio`, `conditions.hateBoost=true`, armadura media equipada e `buffs.physicalReduction=4`.
- **Acao:** recalcular R.FIS.
- **Resultado esperado:** R.FIS=36 (`armadura 10 + HATE 16 + buff 4 + Anfibio 6`).

### T-RES-07 — Composicao de resistencia magica

- **Pre-condicao:** fixture base com `subRace=reptil`, `conditions.hateBoost=true` e `buffs.magicReduction=5`.
- **Acao:** recalcular R.MAG.
- **Resultado esperado:** R.MAG=43 (`Reptil 22 + HATE 16 + buff 5`).

---

## 11. Progressao

### T-PRO-01 — EXP manual persiste e nao altera calculos

- **Pre-condicao:** fixture base.
- **Acao:** alterar `EXP` para 100, salvar e recarregar.
- **Resultado esperado:** `exp=100`; HP/PP/C.A./INI/ESQ/P.A./R.D. iguais aos da fixture base.

### T-PRO-02 — XP manual persiste e nao altera calculos

- **Pre-condicao:** fixture base.
- **Acao:** alterar `XP` para 7, salvar e recarregar.
- **Resultado esperado:** `xp=7`; derivados iguais aos da fixture base.

### T-PRO-03 — LEVEL e NIVEL sao independentes

- **Pre-condicao:** fixture base.
- **Acao:** alterar `LEVEL` (`lv`) para 3 e `NIVEL` (`nvl`) para 10.
- **Resultado esperado:** `lv=3`, `nvl=10`; nenhum derivado mecanico muda.

### T-PRO-04 — Aplicados soma atributos brutos

- **Pre-condicao:** atributos FOR=4, CON=8, AGI=12, INT=16, MAG=20.
- **Acao:** verificar card `APLICADOS`.
- **Resultado esperado:** Aplicados=60.

### T-PRO-05 — Aplicados nao e persistido

- **Pre-condicao:** fixture base.
- **Acao:** salvar e inspecionar o objeto persistido.
- **Resultado esperado:** nao existe campo persistido `aplicados`/`appliedPoints`; o valor e sempre derivado da soma dos atributos.

### T-PRO-06 — Valores negativos de progressao sao clampados

- **Pre-condicao:** ficha com `exp=-1`, `xp=-2`, `nvl=-3` antes do save/load.
- **Acao:** normalizar/salvar.
- **Resultado esperado:** `exp=0`, `xp=0`, `nvl=0`.

---

## 12. Permissoes

### T-PERM-01 — Dono da ficha pode editar a propria ficha

- **Pre-condicao:** usuario jogador autenticado; ficha com `ownerId` igual ao `uid` do usuario; usuario nao e Mestre.
- **Acao:** abrir a ficha e alterar um campo simples (ex.: `Status` ou `Notas`), salvar/recarregar.
- **Resultado esperado:** campo editavel; alteracao persistida; Firestore permite update por owner.

### T-PERM-02 — Jogador nao dono nao edita ficha alheia

- **Pre-condicao:** usuario jogador autenticado; ficha com `ownerId` diferente do `uid`; usuario nao e Mestre.
- **Acao:** tentar editar campos da ficha via UI.
- **Resultado esperado:** inputs desabilitados/acoes restritas indisponiveis; nenhum save deve ocorrer; rules impedem update caso a UI seja burlada.

### T-PERM-03 — Mestre edita qualquer ficha

- **Pre-condicao:** usuario com `role="master"`; ficha de outro owner.
- **Acao:** alterar campo simples, salvar/recarregar.
- **Resultado esperado:** edicao permitida; alteracao persistida; lista de fichas inclui fichas de todos os jogadores.

### T-PERM-04 — Jogador nao acessa painel de Mestre

- **Pre-condicao:** usuario jogador (`role="player"`).
- **Acao:** tentar abrir a view `master`.
- **Resultado esperado:** app redireciona para `sheet` ou impede acesso; controles marcados como `data-master-only` ficam ocultos no modo jogador.

### T-PERM-05 — Botoes restritos ficam indisponiveis para jogador

- **Pre-condicao:** usuario jogador em uma ficha.
- **Acao:** verificar botoes `Nova ficha`, `Duplicar`, exportacao JSON, exclusao/acoes de Mestre.
- **Resultado esperado:** botoes restritos ocultos ou desabilitados; jogador nao executa acoes de Mestre.

### T-PERM-06 — Colapso visual nao depende de permissao

- **Pre-condicao:** usuario sem `canEdit` visualizando uma ficha.
- **Acao:** expandir/recolher secoes e cards individuais (Habilidades, Inventario, Equipamentos, Campos Extras).
- **Resultado esperado:** expandir/recolher funciona (acao visual); editar/renomear/remover permanece bloqueado.

### T-PERM-07 — Dice log respeita owner/Mestre

- **Pre-condicao:** usuario jogador autenticado.
- **Acao:** criar uma rolagem; tentar alterar/remover rolagem de outro usuario (se houver caminho manual).
- **Resultado esperado:** jogador cria apenas log proprio; alteracao/delete de logs por jogador comum e negada; Mestre pode moderar/remover conforme rules.

---

## 13. Campos Extras

### T-CF-01 — Criar Campo Extra

- **Pre-condicao:** usuario com `canEdit`; ficha sem edicao pendente.
- **Acao:** clicar `+ Campo`.
- **Resultado esperado:** novo campo `{ id, label:"Novo campo", value:"" }` criado, persistido e renderizado; card do campo novo inicia expandido.

### T-CF-02 — Renomear Campo Extra

- **Pre-condicao:** ficha com Campo Extra existente.
- **Acao:** expandir o card, alterar `Campo`/`label` para `Apelido`, salvar/recarregar.
- **Resultado esperado:** label persistido; cabecalho do card passa a exibir `Apelido` no proximo render.

### T-CF-03 — Editar valor do Campo Extra

- **Pre-condicao:** ficha com Campo Extra `Apelido`.
- **Acao:** alterar `Valor` para `Corvo`, salvar/recarregar.
- **Resultado esperado:** `value="Corvo"` persistido; nenhum calculo mecanico muda.

### T-CF-04 — Excluir Campo Extra comum

- **Pre-condicao:** ficha com Campo Extra comum (nao legado).
- **Acao:** clicar remover/`×`, salvar/recarregar.
- **Resultado esperado:** campo removido do array `customFields`; nao reaparece.

### T-CF-05 — Excluir `Almas` persiste

- **Pre-condicao:** ficha com Campo Extra `Almas`.
- **Acao:** remover `Almas`, salvar/recarregar.
- **Resultado esperado:** `Almas` permanece removido; nao e reinjetado por normalizacao. Fichas novas ainda podem nascer com `Almas` via default.

### T-CF-06 — Ficha legada com Campo Extra sem `id`

- **Pre-condicao:** documento legado com `customFields: [{ label:"Legado", value:"X" }]` sem `id`.
- **Acao:** carregar a ficha, editar `Legado` e depois remover o campo.
- **Resultado esperado:** `normalizeCustomFields` faz backfill de `id`; edicao e exclusao funcionam por `id`; dados persistem corretamente.

### T-CF-07 — Campo `Sub-raca` de usuario e preservado quando `subRace` ja e valido

- **Pre-condicao:** ficha com `subRace="anfibio"` e Campo Extra com label `Sub-raca` usado como anotacao livre.
- **Acao:** salvar/recarregar.
- **Resultado esperado:** Campo Extra `Sub-raca` permanece no array; `subRace` continua `anfibio`; nenhuma perda silenciosa.

### T-CF-08 — Campo `Sub-raca` legado migra quando `subRace` esta vazio/invalido

- **Pre-condicao:** ficha legada com `subRace` ausente/vazio e Campo Extra `Sub-raca=Reptil`.
- **Acao:** carregar/normalizar/salvar.
- **Resultado esperado:** `subRace` vira `reptil`; Campo Extra `Sub-raca` legado e removido; demais Campos Extras preservados.

### T-CF-09 — Campos Extras respeitam permissao

- **Pre-condicao:** usuario sem `canEdit` visualizando ficha.
- **Acao:** tentar criar, renomear, editar valor ou excluir Campo Extra pela UI.
- **Resultado esperado:** acoes de escrita indisponiveis/bloqueadas; expandir/recolher continua funcionando como acao visual.

### T-CF-10 — Cards colapsaveis de Campos Extras nao alteram persistencia

- **Pre-condicao:** ficha com varios Campos Extras.
- **Acao:** expandir/recolher cards individuais, recarregar pagina.
- **Resultado esperado:** dados intactos; estado expandido/recolhido volta ao default de sessao; nenhum campo de UI e persistido.

### T-CF-11 — Labels duplicados nao quebram CRUD

- **Pre-condicao:** criar dois Campos Extras com mesmo label `Nota`.
- **Acao:** editar/remover apenas o segundo campo.
- **Resultado esperado:** operacao afeta o campo correto por `id`; o outro campo permanece intacto. Observacao: leituras por label (`customFieldVal`) podem retornar o primeiro match, mas o CRUD por id deve funcionar.

---

## 14. Checklist rapido pos-mudanca

Antes de considerar uma alteracao de regra como pronta, executar pelo menos:

- T-ATR-01, T-ATR-04, T-ATR-05.
- T-HP-01, T-HP-04.
- T-PP-01, T-PP-04.
- T-DER-02, T-DER-03.
- T-SUB-01 a T-SUB-09 quando mexer em raca/sub-raca.
- T-CBT-01 a T-CBT-04 quando mexer em Recursos/Combate.
- T-EQP-01 a T-EQP-05 e T-ARM-01 a T-ARM-05 quando mexer em equipamentos/armaduras.
- T-RES-01 a T-RES-07 quando mexer em buffs, HATE, armaduras ou sub-racas.
- T-PRO-01 a T-PRO-06 quando mexer em progressao.
- T-PERM-01 a T-PERM-07 quando mexer em Auth, Firestore, UI restrita ou rules.
- T-CF-01 a T-CF-11 quando mexer em Campos Extras, normalizacao ou migracao de raca/sub-raca.

*Fim da bateria de testes.*
