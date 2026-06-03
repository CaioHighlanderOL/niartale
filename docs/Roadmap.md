# Em andamento

## 1. Consolidar fonte de verdade e criterios de aceite

**Prioridade:** fidelidade a planilha, correcoes criticas  
**Base:** `docs/NiarTale_Documento_Continuidade.md` e `docs/Planilha Original.xlsx`

- Manter a planilha como fonte canonica das regras mecanicas.
- Tratar `excelCalc()` como implementacao atual dos derivados ja auditados.
- Preservar as correcoes D1-D18 ja documentadas; nao reabrir sem nova evidencia por celula.
- Para qualquer mudanca futura de regra, registrar: celula da planilha, formula original, comportamento atual no app e impacto esperado.

**Dependencias tecnicas:** nenhuma.  
**Criterio de pronto:** qualquer tarefa futura deve citar celulas/areas da planilha quando afetar calculos.

## 2. Preparar trilha de validacao de calculos

**Prioridade:** correcoes criticas, fidelidade a planilha  
**Base:** formulas da aba `Ficha`, especialmente H15, H17, H19, H21, H23, K24, K27, F26, H26, F28, H28, F30, X15 e X16.

- Definir uma bateria minima de casos por raca/sub-raca antes de novas alteracoes.
- Cobrir Humano, Monstro, Anfibio, Alcadethes, Reptil, Esqueleto, Parasita, Aranha e Elemental.
- Cobrir HATE, Inversao, armaduras leve/media/pesada e buffs.
- Garantir que alteracoes em AGI sejam avaliadas tambem em C.A., Iniciativa e Esquiva.

**Dependencias tecnicas:** leitura estavel da planilha e entendimento de `excelCalc()`.  
**Criterio de pronto:** lista de casos esperados documentada antes de qualquer nova mudanca mecanica.

## 3. Raca e Sub-raca estruturadas ✅ (2026-06-02)

Concluido. Detalhes em `docs/NiarTale_Relatorio_Raca_SubRaca.md`.

# Próximo

## 1. Expor HATE e Inversao na ficha

**Prioridade:** correcao critica, fidelidade a planilha, funcionalidade da ficha  
**Planilha:** U24, U26, H15, H17, H19, H23, X15, X16  
**Status atual:** `conditions.hateBoost` e `conditions.inversion` ja existem no modelo e ja afetam `excelCalc()`, mas nao ha controle direto na UI.

- Adicionar controles visiveis na aba de Atributos ou Recursos.
- Atualizar os calculos imediatamente ao alternar os controles.
- Preservar a diferenca entre HATE nos atributos (+30) e HATE nas reducoes de dano (+16).
- Deixar claro que INT nao recebe HATE/Inversao pela formula atual da planilha.

**Dependencias tecnicas:** nenhuma migracao de dados.  
**Risco:** baixo; campos ja existem.  
**Criterio de pronto:** usuario consegue ativar/desativar HATE e Inversao sem editar Firestore manualmente.

## 2. Tornar tipo de armadura um dado explicito

**Prioridade:** correcao critica, fidelidade a planilha, estrutura de dados  
**Planilha:** R21, R23, R25, F26, H28, X15  
**Status atual:** `armorState()` infere armadura por texto no nome/slot do equipamento.

- Criar campo estruturado para tipo de armadura: nenhuma, leve, media, pesada.
- Manter fallback por nome apenas para compatibilidade com fichas antigas.
- Atualizar a documentacao do modelo de `equipment`.
- Planejar migracao suave em `normalizeCharacter()`.

**Dependencias tecnicas:** precisa tocar modelo de dados antes da UI final.  
**Risco:** alto se adiado, porque nomes livres geram C.A., Esquiva e RD Fisica erradas sem aviso.  
**Criterio de pronto:** calculos de armadura deixam de depender de texto livre.

## 3. Exibir total de pericia com atributo base

**Prioridade:** fidelidade a planilha, funcionalidade da ficha, UX  
**Planilha:** M6:M18, T6:T18, F28, F30  
**Status atual:** a UI mostra bonus de Treinado/Mestre/Extra, mas nao deixa explicito o total de rolagem somando modificador de atributo.

- Confirmar mapeamento pericia -> atributo.
- Exibir bonus atual e total final sem destruir a edicao existente.
- Garantir que Reflexo continue alimentando Iniciativa e Esquiva.
- Garantir que Percepcao continue alimentando P.A.

**Dependencias tecnicas:** idealmente depois de estruturar raca/sub-raca e armadura, pois os modificadores precisam estar confiaveis.  
**Risco:** medio; risco principal e mapear pericias para atributos sem confirmacao de regra.  
**Criterio de pronto:** jogador ve o total de rolagem sem calculo manual recorrente.

# Depois

## 1. Implementar CalculaDANO, CalculaCURA e HP Restante

**Prioridade:** correcao critica, fidelidade a planilha, funcionalidade da ficha  
**Planilha:** W18:X23, Y18:Y23, K24  
**Status atual:** existe `resources.hp.current`, mas nao existe o bloco de ate 5 entradas de dano/cura da planilha.

- Modelar entradas temporarias ou persistidas de dano e cura.
- Calcular total de dano como `SUM(W19:W23)`.
- Calcular HP restante como `K24 - dano + cura`.
- Definir se o botao aplica resultado em `resources.hp.current` ou se o valor restante passa a ser derivado.

**Dependencias tecnicas:** `hpMax` confiavel; decisoes de modelo para historico de combate.  
**Risco:** medio-alto; pode conflitar com edicao manual de HP atual.  
**Criterio de pronto:** combate nao exige calculo externo de HP restante.

## 2. Implementar CalculaPP, PP recuperado e PP Restante

**Prioridade:** correcao critica, fidelidade a planilha, funcionalidade da ficha  
**Planilha:** W25:X30, Y25:Y30, K27  
**Status atual:** `resources.mp.current` existe, mas nao reflete o bloco de gasto/recuperacao de PP da planilha.

- Reutilizar o mesmo padrao definido para dano/cura.
- Calcular PP gasto como `SUM(W26:W30)`.
- Calcular PP restante como `K27 - gasto + recuperacao`.
- Decidir nomenclatura final entre MP e PP na UI.

**Dependencias tecnicas:** decisao de modelo do item anterior; `ppMax` confiavel.  
**Risco:** medio; cuidado para nao duplicar conceitos `mp` e `pp`.  
**Criterio de pronto:** uso de habilidades pode ser controlado sem conta manual.

## 3. Completar progressao: EXP, XP, Aplicados e LVL/NVL

**Prioridade:** estrutura de dados, fidelidade a planilha, funcionalidade da ficha  
**Planilha:** F13, F14, H13, H14  
**Status atual:** existe apenas `lv` como numero simples.

- Adicionar campos de EXP acumulado e XP disponivel.
- Calcular pontos aplicados a partir dos atributos.
- Representar LVL/NVL como nivel atual e nivel maximo da campanha.
- Definir se `lvMax` pertence a campanha ou a ficha.

**Dependencias tecnicas:** modelo de campanha/ficha; validacao de atributos.  
**Risco:** medio; altera estrutura persistida.  
**Criterio de pronto:** progressao da ficha deixa de depender da planilha ou anotacao externa.

## 4. Modelar HATE e HOPE percentuais

**Prioridade:** fidelidade a planilha, estrutura de dados, funcionalidade da ficha  
**Planilha:** C3, J31:J32, AA3, T30:T31  
**Status atual:** HATE existe apenas como booleano mecanico; HOPE nao existe como recurso estruturado.

- Definir campos numericos para HATE e HOPE.
- Decidir se `hateBoost` continua manual ou passa a ser derivado de um limiar.
- Exibir progresso atual/maximo sem quebrar os calculos ja existentes.
- Documentar a relacao entre HATE percentual e U26.

**Dependencias tecnicas:** controles de HATE/Inversao ja devem existir; semantica de HATE/HOPE precisa ser confirmada.  
**Risco:** alto; pode mudar a origem do maior modificador mecanico do sistema.  
**Criterio de pronto:** HATE/HOPE deixam de ser apenas texto da planilha e viram recursos coerentes no app.

## 5. Separar ou formalizar Condicao Atual

**Prioridade:** funcionalidade da ficha, UX  
**Planilha:** T21  
**Status atual:** `status` existe, mas mistura identidade/status narrativo com possivel condicao de combate.

- Decidir se `status` e suficiente.
- Se nao for, criar `conditionText` ou estrutura equivalente.
- Exibir em local visivel na ficha.

**Dependencias tecnicas:** nenhuma forte; idealmente apos recursos de combate.  
**Risco:** baixo.  
**Criterio de pronto:** condicoes de combate ficam claras e nao se confundem com flavor/status geral.

# Futuro

## 1. Adicionar Theme Song como campo padrao

**Prioridade:** funcionalidade da ficha, UX  
**Planilha:** M47  
**Status atual:** ausente como campo padrao; pode existir apenas como campo customizado manual.

- Adicionar campo estruturado para link/nome da musica.
- Exibir na aba Geral ou Historia.
- Evitar player complexo ate haver necessidade real.

**Dependencias tecnicas:** baixa; pode usar o mesmo padrao de campos textuais.  
**Risco:** baixo.  
**Criterio de pronto:** ficha cobre o campo `Theme Song` da planilha.

## 2. Melhorar HUD com CASH e recursos derivados

**Prioridade:** UX, funcionalidade da ficha  
**Planilha:** G30/H30, recursos de HP/PP  
**Status atual:** CASH existe em `resources.cash`, mas nao e destaque na HUD principal.

- Avaliar inclusao de CASH na HUD sem poluir o layout.
- Exibir HP/PP maximos derivados de forma consistente.
- Evitar redesign visual amplo.

**Dependencias tecnicas:** melhor depois de estabilizar dano/PP.  
**Risco:** baixo.  
**Criterio de pronto:** recursos importantes ficam mais escaneaveis durante jogo.

## 3. Refinar UX de edicao e protecoes contra erro

**Prioridade:** UX  
**Status atual:** inputs sao livres em pontos sensiveis e o app ja protege foco durante digitacao.

- Validar ranges numericos de atributos, recursos, buffs e reducoes.
- Melhorar mensagens de erro/toast para operacoes negadas.
- Destacar quando HP/PP atual ultrapassar maximo derivado.
- Mostrar avisos para fichas antigas com dados migrados ou fallback por nome.

**Dependencias tecnicas:** idealmente apos campos estruturados e recursos de combate.  
**Risco:** baixo-medio; cuidado para nao bloquear casos validos do sistema.  
**Criterio de pronto:** erros comuns ficam visiveis antes de afetar a mesa.

## 4. Evoluir visual somente apos estabilizar regra e dados

**Prioridade:** visual  
**Status atual:** identidade retro-pixel e deliberada.

- Preservar paleta, densidade e linguagem visual.
- Melhorar legibilidade apenas onde houver problema comprovado.
- Evitar reestruturação visual antes das correcoes mecanicas e de dados.

**Dependencias tecnicas:** todas as prioridades anteriores.  
**Risco:** medio se feito cedo, porque pode mascarar pendencias mecanicas.  
**Criterio de pronto:** melhorias visuais aumentam clareza sem mudar a identidade do projeto.
