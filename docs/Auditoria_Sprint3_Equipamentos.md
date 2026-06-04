# Auditoria — Sprint 3: Equipamentos e Armadura

**Data:** 2026-06-03
**Fontes:** `docs/Especificacao_Sprint3_Equipamentos.md`, `docs/NiarTale_Documento_Continuidade.md`, `docs/Planilha Original.xlsx`, código `app.js`
**Natureza:** auditoria. **Nenhuma alteração de código realizada.**

---

## Veredito

**NÃO IMPLEMENTADO.** A Sprint 3 (Interface de Equipamentos, Equipar/Desequipar, Tipo de Armadura explícito) **não foi codificada**. O `app.js` permanece idêntico ao estado pós-Sprint 2. Não há o que auditar em termos de aderência: os artefatos previstos na especificação não existem no código.

### Evidências
- **Histórico git:** último commit é `56e5511 implementa sprint2 progressao`. Não há commit de Sprint 3.
- **Working tree:** as únicas mudanças não commitadas são documentos (`docs/Auditoria_Paridade_UI_Planilha.md`, `docs/Especificacao_Sprint3_Equipamentos.md`, `docs/Paridade_Atual_Pos_Sprint2.md`, `docs/Roadmap_Atualizado.md`). `app.js` não aparece como modificado.
- **Busca no código:** `armorType`, `renderEquipment`, `normalizeEquipment` e "Equipamentos" → **0 ocorrências**.
- `SHEET_TABS` segue de `inventory` direto a `notes` (sem aba de Equipamentos).
- `armorState()` segue na versão original por inferência de nome:

```1456:1463:app.js
function armorState(c) {
  const eq = c.equipment.filter((e) => e.equipped).map((e) => norm(`${e.slot} ${e.name}`));
  return {
    light:  eq.some((e) => e.includes("leve")),
    medium: eq.some((e) => e.includes("media") || e.includes("medio")),
    heavy:  eq.some((e) => e.includes("pesada") || e.includes("pesado")),
  };
}
```

---

## Matriz de verificação solicitada

| Item verificado | Estado | Observação |
|---|---|---|
| Aderência à especificação | ✗ Não implementado | Nenhum dos 3 itens de escopo existe no código. |
| Aderência à planilha | n/a | Os coeficientes da planilha já existiam em `excelCalc` (pré-Sprint 3) e seguem corretos, mas nada novo foi adicionado. |
| Fallback por nome preservado | ⚠ Trivialmente "preservado" | A inferência por nome é o **único** mecanismo existente; o tipo explícito que exigiria fallback ainda não foi criado. |
| Compatibilidade com fichas antigas | ✓ (inalterada) | Como nada mudou, não há risco novo de incompatibilidade. |
| Risco de dupla contagem | ✓ Inexistente hoje | Sem `armorType`, não há segunda fonte que possa duplicar com o nome. |
| Impacto em C.A. | Nenhum (sem mudança) | `armorCA = (light?2:0)-(medium?3:0)-(heavy?6:0)` inalterado. |
| Impacto em Esquiva | Nenhum (sem mudança) | `armorDodgePen = (medium?3:0)+(heavy?6:0)` inalterado. |
| Impacto em R.D. | Nenhum (sem mudança) | `armorRD = (light?5:0)+(medium?10:0)+(heavy?20:0)` inalterado; R.D. Mágica não recebe armadura. |

---

## Classificação de problemas

### Crítico
| ID | Problema | Impacto | Recomendação |
|---|---|---|---|
| C-A1 | **Escopo da Sprint 3 ausente do código.** A lacuna Crítica C1 da auditoria de UI (controle de armadura) continua aberta: o usuário ainda não consegue ver/gerenciar equipamentos nem definir tipo de armadura pela ficha. | Funcionalidade central não entregue; C.A./Esquiva/R.D. permanecem inalcançáveis por inferência frágil de nome. | Implementar conforme `docs/Especificacao_Sprint3_Equipamentos.md` (modelo `armorType` por item + aba de Equipamentos + toggle equipado), antes de qualquer auditoria de aderência. |

### Importante
| ID | Problema | Impacto | Recomendação |
|---|---|---|---|
| I-A1 | **Fragilidade pré-existente mantida:** armadura inferida por substring de nome. Ficha default ("Casaco listrado", equipado) contribui **zero** de armadura silenciosamente. | Risco de C.A./R.D. erradas sem aviso — exatamente o que a Sprint 3 deveria resolver. | É o alvo direto da implementação pendente; não introduzir nova lógica sobre o nome sem o tipo explícito. |

### Menor
| ID | Problema | Impacto | Recomendação |
|---|---|---|---|
| M-A1 | Documentos de planejamento (`Especificacao_Sprint3_Equipamentos.md`, etc.) ainda não commitados. | Rastreabilidade; risco de perda. | Commit dos documentos de planejamento para registro. |
| M-A2 | `work/repo` aparece modificado no working tree (não relacionado a Sprint 3). | Ruído no diff. | Verificar/limpar antes do commit da Sprint 3 para isolar o changeset. |

---

## Conclusão

Não há implementação da Sprint 3 para auditar. O estado atual corresponde ao fim da Sprint 2, com a fragilidade conhecida de armadura por nome ainda presente. As verificações de aderência (fallback, dupla contagem, impactos em C.A./Esquiva/R.D.) só serão aplicáveis após a codificação prevista na especificação.

**Próximo passo recomendado:** implementar a Sprint 3 e então reexecutar esta auditoria com foco em (1) `armorState` resolvendo `armorType` com fallback por nome, (2) ausência de dupla contagem, e (3) não-regressão de C.A./Esquiva/R.D. em fichas legadas.

*Fim do relatório. Nenhuma alteração de código foi realizada.*
