# Relatorio de Implementacao — EN / Energia

**Data:** 2026-06-05  
**Base:** `docs/Decisao_EN.md`  
**Objetivo:** implementar apenas a decisao recomendada para EN (deprecacao de UI), preservando compatibilidade legada e sem alterar calculos.

---

## 1. Decisao aplicada

Conforme `docs/Decisao_EN.md`, foi aplicada a estrategia de **deprecacao de EN na UI**:

- ocultar EN das barras de recursos;
- ocultar EN da edicao de recursos;
- parar de criar EN em fichas novas;
- manter compatibilidade com fichas antigas;
- sem migracao eager;
- sem mexer em formulas/calculos.

---

## 2. Alteracoes realizadas

### 2.1 `app.js`

1) **Fase 3 — parar de criar EN em fichas novas**

- Em `defaultCharacter().resources`, removida a entrada:
  - `energy: { label:"EN", current:5, max:5, color:"#80ff72" }`

Resultado:
- fichas novas passam a nascer com `hp`, `mp`, `cash`;
- nenhum impacto em fichas antigas (que podem continuar com `resources.energy` salvo).

2) **Fase 2 — ocultar EN da edicao de recursos**

- Em `renderResources(c)`, a lista de campos editaveis agora usa:
  - `const editableResources = Object.entries(c.resources || {}).filter(([k]) => k !== "energy");`

Resultado:
- EN nao aparece mais no card "Editar atuais";
- HP/MP/CASH continuam editaveis normalmente.

3) **Fase 1 — ocultar EN das barras**

- Em `resourceBars(c)`, a lista fixa mudou de:
  - `["hp","mp","energy","cash"]`
  para:
  - `["hp","mp","cash"]`

Resultado:
- EN deixa de ser exibido visualmente nas barras;
- HP/MP/CASH permanecem iguais.

---

## 3. Documentacao atualizada

### 3.1 `docs/Roadmap_Atualizado.md`

- D1 deixou de ser pendente e passou para **decisao aplicada**:
  - `D1. EN/Energia — DEPRECADO na UI`
- Registrado que:
  - EN foi removido da UI (barras + edicao);
  - novas fichas nao recebem EN por padrao;
  - compatibilidade legada preservada sem migracao eager.

### 3.2 `docs/NiarTale_Documento_Continuidade.md`

- Atualizado o resumo de recursos para refletir UI atual (HP, MP/PP, CASH).
- Secao `7.7 Recursos` atualizada:
  - exemplo de `resources` sem `energy`;
  - nota explicita de deprecacao de EN na UI;
  - compatibilidade com fichas legadas documentada.

---

## 4. Compatibilidade e seguranca da mudanca

- **Compatibilidade com fichas antigas:** preservada.
  - Fichas legadas com `resources.energy` continuam carregando.
  - O campo apenas nao e renderizado/editado na UI.
- **Sem migracao eager:** nenhuma rotina em lote foi criada/executada.
- **Sem alteracao de calculos:** `excelCalc`, `armorState`, `skillBonus` e derivados permanecem intactos.
- **Permissoes/rules:** `firestore.rules` nao alterado.

---

## 5. Verificacao

- Linter: sem erros em `app.js`.
- Conferencia funcional esperada:
  - ficha nova: sem EN visivel e sem EN no objeto default;
  - ficha legada com EN: abre normalmente; EN nao aparece na UI;
  - HP/MP/CASH continuam funcionando e salvando.

---

## 6. Arquivos alterados

- `app.js`
- `docs/Roadmap_Atualizado.md`
- `docs/NiarTale_Documento_Continuidade.md`
- `docs/Relatorio_EN.md` (este documento)

---

## 7. Conclusao

A decisao recomendada para EN foi implementada com sucesso: **EN deprecado na UI**, mantendo compatibilidade com fichas antigas, sem migracao eager e sem qualquer mudanca de formula/calculo.

