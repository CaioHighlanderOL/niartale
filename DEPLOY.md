# Deploy do NiarTale RPG Core

O app agora usa Firebase Auth + Firestore diretamente no frontend.

1. Confirme a config em `firebase.js`.
2. No Console Firebase, habilite Authentication com Email/Senha.
3. Crie o banco Cloud Firestore.
4. Publique regras e hosting:

```bash
firebase deploy
```

Entidades usadas:
- `users/{uid}`
- `campaigns/default`
- `characters/{characterId}`
- `diceLog/{rollId}`

Por seguranca, cadastros pelo app criam usuarios `player`. Para definir um
Mestre, edite o documento `users/{uid}` no Firestore Console e altere `role`
para `master`. Depois disso, o proprio Mestre pode gerenciar fichas e campanha.
