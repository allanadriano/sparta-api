import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { NotFoundError } from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);

const WEEKDAY_MAP: Record<number, WeekDay> = {
  0: WeekDay.SUNDAY,
  1: WeekDay.MONDAY,
  2: WeekDay.TUESDAY,
  3: WeekDay.WEDNESDAY,
  4: WeekDay.THURSDAY,
  5: WeekDay.FRIDAY,
  6: WeekDay.SATURDAY,
};

interface InputDto {
  userId: string;
  from: string;
  to: string;
}

interface OutputDto {
  workoutStreak: number;
  consistencyByDay: Record<
    string,
    {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    }
  >;
  completedWorkoutsCount: number;
  conclusionRate: number;
  totalTimeInSeconds: number;
}

export class GetStats {
  async execute(dto: InputDto): Promise<OutputDto> {
    const from = dayjs.utc(dto.from).startOf("day");
    const to = dayjs.utc(dto.to).endOf("day");

    const workoutPlan = await prisma.workoutPlan.findFirst({
      where: { userId: dto.userId, isActive: true },
      include: {
        workoutDays: {
          include: {
            sessions: {
              where: {
                startedAt: {
                  gte: from.toDate(),
                  lte: to.toDate(),
                },
              },
            },
          },
        },
      },
    });

    if (!workoutPlan) {
      throw new NotFoundError("Active workout plan not found");
    }

    // Flatten all sessions
    const allSessions = workoutPlan.workoutDays.flatMap((day) => day.sessions);

    // Build consistencyByDay — only days with sessions
    const consistencyByDay: Record<
      string,
      { workoutDayCompleted: boolean; workoutDayStarted: boolean }
    > = {};

    for (const session of allSessions) {
      const dayKey = dayjs.utc(session.startedAt).format("YYYY-MM-DD");

      const existing = consistencyByDay[dayKey] ?? {
        workoutDayCompleted: false,
        workoutDayStarted: false,
      };

      existing.workoutDayStarted = true;
      if (session.completedAt) {
        existing.workoutDayCompleted = true;
      }

      consistencyByDay[dayKey] = existing;
    }

    // completedWorkoutsCount
    const completedWorkoutsCount = allSessions.filter(
      (s) => s.completedAt !== null,
    ).length;

    // conclusionRate
    const conclusionRate =
      allSessions.length > 0 ? completedWorkoutsCount / allSessions.length : 0;

    // totalTimeInSeconds
    const totalTimeInSeconds = allSessions
      .filter((s) => s.completedAt !== null)
      .reduce((total, s) => {
        const start = dayjs.utc(s.startedAt);
        const end = dayjs.utc(s.completedAt);
        return total + end.diff(start, "second");
      }, 0);

    // workoutStreak
    const workoutStreak = this.calculateStreak(
      workoutPlan.workoutDays,
      dayjs.utc(dto.to),
    );

    return {
      workoutStreak,
      consistencyByDay,
      completedWorkoutsCount,
      conclusionRate,
      totalTimeInSeconds,
    };
  }

  private calculateStreak(
    workoutDays: Array<{
      weekDay: WeekDay;
      isRest: boolean;
      sessions: Array<{ completedAt: Date | null }>;
    }>,
    currentDate: dayjs.Dayjs,
  ): number {
    let streak = 0;
    let checkDate = currentDate;

    while (true) {
      const weekDay = WEEKDAY_MAP[checkDate.day()];
      const workoutDay = workoutDays.find((d) => d.weekDay === weekDay);

      if (!workoutDay) {
        break;
      }

      if (workoutDay.isRest) {
        streak++;
        checkDate = checkDate.subtract(1, "day");
        continue;
      }

      const hasCompletedSession = workoutDay.sessions.some((s) => {
        if (!s.completedAt) return false;
        return (
          dayjs.utc(s.completedAt).format("YYYY-MM-DD") ===
          checkDate.format("YYYY-MM-DD")
        );
      });

      if (hasCompletedSession) {
        streak++;
        checkDate = checkDate.subtract(1, "day");
      } else {
        break;
      }
    }

    return streak;
  }
}
