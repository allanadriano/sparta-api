import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
  exerciseId: string;
  name?: string;
  order?: number;
  sets?: number;
  reps?: number;
  restTimeInSeconds?: number;
}

interface OutputDto {
  id: string;
  name: string;
  order: number;
  sets: number;
  reps: number;
  restTimeInSeconds: number;
}

export class UpdateWorkoutExercise {
  async execute(dto: InputDto): Promise<OutputDto> {
    const exercise = await prisma.workoutExercise.findUnique({
      where: { id: dto.exerciseId },
      include: {
        workoutDay: {
          include: {
            workoutPlan: true,
          },
        },
      },
    });

    if (
      !exercise ||
      exercise.workoutDayId !== dto.workoutDayId ||
      exercise.workoutDay.workoutPlanId !== dto.workoutPlanId ||
      exercise.workoutDay.workoutPlan.userId !== dto.userId
    ) {
      throw new NotFoundError("Workout exercise not found");
    }

    const updated = await prisma.workoutExercise.update({
      where: { id: dto.exerciseId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.sets !== undefined && { sets: dto.sets }),
        ...(dto.reps !== undefined && { reps: dto.reps }),
        ...(dto.restTimeInSeconds !== undefined && {
          restTimeInSeconds: dto.restTimeInSeconds,
        }),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      order: updated.order,
      sets: updated.sets,
      reps: updated.reps,
      restTimeInSeconds: updated.restTimeInSeconds,
    };
  }
}
