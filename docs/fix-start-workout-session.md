# Fix: StartWorkoutSession — Prisma 7 e alinhamento com videoaula

## Problema

Ao tentar iniciar uma sessão de treino (`POST /workout-plans/:id/days/:dayId/sessions`), a API retornava `500 Internal Server Error` com `PrismaClientValidationError`.

### Causa raiz

No `StartWorkoutSession.ts`, a query usava `startedAt: { not: null }` para verificar sessões existentes. No Prisma 7, o argumento `not` não aceita `null`.

```ts
// Inválido no Prisma 7
const existingSession = await prisma.workoutSession.findFirst({
  where: { workoutDayId: dto.workoutDayId, startedAt: { not: null } },
});
```

## Correção

Substituído por `completedAt: null`, que busca sessões **não completadas** (em andamento):

```ts
const existingSession = await prisma.workoutSession.findFirst({
  where: { workoutDayId: dto.workoutDayId, completedAt: null },
});
```

Essa mudança também melhora a lógica: antes, qualquer sessão já iniciada (mesmo completada) bloqueava a criação de uma nova. Agora, só bloqueia se houver uma sessão em andamento.

## Outras mudanças (alinhamento com videoaula)

### StartWorkoutSession.ts

- **Ownership check**: `UnauthorizedError` → `NotFoundError` (esconde a existência do recurso por segurança)
- **Sessão duplicada**: `ConflictError` → `SessionAlreadyStartedError` (erro mais específico)

### errors/index.ts

- Criada classe `SessionAlreadyStartedError`

### routes/workout-plan.ts

- Rota de start session agora trata `SessionAlreadyStartedError` (409) em vez de `ConflictError`
- Removido tratamento de `UnauthorizedError` dessa rota (não é mais lançado pelo use case)
