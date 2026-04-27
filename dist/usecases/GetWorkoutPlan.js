import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";
export class GetWorkoutPlan {
    async execute(dto) {
        const workoutPlan = await prisma.workoutPlan.findUnique({
            where: { id: dto.workoutPlanId },
            include: {
                workoutDays: {
                    include: {
                        _count: {
                            select: { exercises: true },
                        },
                    },
                },
            },
        });
        if (!workoutPlan) {
            throw new NotFoundError("Workout plan not found");
        }
        if (workoutPlan.userId !== dto.userId) {
            throw new NotFoundError("Workout plan not found");
        }
        return {
            id: workoutPlan.id,
            name: workoutPlan.name,
            workoutDays: workoutPlan.workoutDays.map((day) => ({
                id: day.id,
                weekDay: day.weekDay,
                name: day.name,
                isRest: day.isRest,
                coverImageUrl: day.coverImageUrl ?? undefined,
                estimatedDurationInSeconds: day.estimatedDurationInSeconds,
                exercisesCount: day._count.exercises,
            })),
        };
    }
}
