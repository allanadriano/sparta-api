import { prisma } from "../lib/db.js";
export class ListWorkoutPlans {
    async execute(dto) {
        const workoutPlans = await prisma.workoutPlan.findMany({
            where: {
                userId: dto.userId,
                ...(dto.active !== undefined && { isActive: dto.active }),
            },
            orderBy: { createdAt: "desc" },
            include: {
                workoutDays: {
                    include: {
                        exercises: {
                            orderBy: { order: "asc" },
                        },
                    },
                },
            },
        });
        return {
            workoutPlans: workoutPlans.map((plan) => ({
                id: plan.id,
                name: plan.name,
                isActive: plan.isActive,
                workoutDays: plan.workoutDays.map((day) => ({
                    id: day.id,
                    name: day.name,
                    weekDay: day.weekDay,
                    isRest: day.isRest,
                    estimatedDurationInSeconds: day.estimatedDurationInSeconds,
                    coverImageUrl: day.coverImageUrl ?? undefined,
                    exercises: day.exercises.map((exercise) => ({
                        id: exercise.id,
                        order: exercise.order,
                        name: exercise.name,
                        sets: exercise.sets,
                        reps: exercise.reps,
                        restTimeInSeconds: exercise.restTimeInSeconds,
                    })),
                })),
            })),
        };
    }
}
