import { NotFoundError } from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
  name?: string;
  weekDay?: WeekDay;
  isRest?: boolean;
  estimatedDurationInSeconds?: number;
  coverImageUrl?: string;
}

interface OutputDto {
  id: string;
  name: string;
  weekDay: WeekDay;
  isRest: boolean;
  estimatedDurationInSeconds: number;
  coverImageUrl?: string;
}

export class UpdateWorkoutDay {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutDay = await prisma.workoutDay.findUnique({
      where: { id: dto.workoutDayId },
      include: {
        workoutPlan: true,
      },
    });

    if (
      !workoutDay ||
      workoutDay.workoutPlanId !== dto.workoutPlanId ||
      workoutDay.workoutPlan.userId !== dto.userId
    ) {
      throw new NotFoundError("Workout day not found");
    }

    const updated = await prisma.workoutDay.update({
      where: { id: dto.workoutDayId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.weekDay !== undefined && { weekDay: dto.weekDay }),
        ...(dto.isRest !== undefined && { isRest: dto.isRest }),
        ...(dto.estimatedDurationInSeconds !== undefined && {
          estimatedDurationInSeconds: dto.estimatedDurationInSeconds,
        }),
        ...(dto.coverImageUrl !== undefined && {
          coverImageUrl: dto.coverImageUrl,
        }),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      weekDay: updated.weekDay,
      isRest: updated.isRest,
      estimatedDurationInSeconds: updated.estimatedDurationInSeconds,
      coverImageUrl: updated.coverImageUrl ?? undefined,
    };
  }
}
