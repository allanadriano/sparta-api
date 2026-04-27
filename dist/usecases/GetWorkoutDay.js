import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";
dayjs.extend(utc);
export class GetWorkoutDay {
    async execute(dto) {
        const workoutPlan = await prisma.workoutPlan.findUnique({
            where: { id: dto.workoutPlanId },
        });
        if (!workoutPlan) {
            throw new NotFoundError("Workout plan not found");
        }
        if (workoutPlan.userId !== dto.userId) {
            throw new NotFoundError("Workout plan not found");
        }
        const workoutDay = await prisma.workoutDay.findUnique({
            where: { id: dto.workoutDayId, workoutPlanId: dto.workoutPlanId },
            include: {
                exercises: {
                    orderBy: { order: "asc" },
                },
                sessions: true,
            },
        });
        if (!workoutDay) {
            throw new NotFoundError("Workout day not found");
        }
        return {
            id: workoutDay.id,
            name: workoutDay.name,
            isRest: workoutDay.isRest,
            coverImageUrl: workoutDay.coverImageUrl ?? undefined,
            estimatedDurationInSeconds: workoutDay.estimatedDurationInSeconds,
            weekDay: workoutDay.weekDay,
            exercises: workoutDay.exercises.map((exercise) => ({
                id: exercise.id,
                name: exercise.name,
                order: exercise.order,
                workoutDayId: exercise.workoutDayId,
                sets: exercise.sets,
                reps: exercise.reps,
                restTimeInSeconds: exercise.restTimeInSeconds,
            })),
            sessions: workoutDay.sessions.map((session) => ({
                id: session.id,
                workoutDayId: session.workoutDayId,
                startedAt: session.startedAt
                    ? dayjs.utc(session.startedAt).format("YYYY-MM-DD")
                    : undefined,
                completedAt: session.completedAt
                    ? dayjs.utc(session.completedAt).format("YYYY-MM-DD")
                    : undefined,
            })),
        };
    }
}
