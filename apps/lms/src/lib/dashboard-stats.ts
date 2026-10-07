import { withActiveCourseStages } from "@/lib/assignments";
import type { Db } from "mongodb";
import type { AssignmentStatus, LearnerProfileDocument } from "@/lib/types";

export type PeriodKey = "all" | "week" | "month" | "year";

export type StatusCounts = {
  notStarted: number;
  inProgress: number;
  completed: number;
  total: number;
};

export type PeriodStats = StatusCounts & {
  assignedInPeriod: number;
  completedInPeriod: number;
  newlyActivated: number;
};

export type DashboardStats = {
  participants: number;
  courses: number;
  learners: {
    invited: number;
    active: number;
    inactive: number;
    total: number;
  };
  periods: Record<PeriodKey, PeriodStats>;
};

type AssignmentRow = {
  status: AssignmentStatus;
  assignedAt?: Date;
  lastActivityAt?: Date;
  completedAt?: Date;
};

function emptyCounts(): StatusCounts {
  return { notStarted: 0, inProgress: 0, completed: 0, total: 0 };
}

function startOfWeek(now: Date): Date {
  const date = new Date(now);
  const day = date.getDay();
  const offset = day === 0 ? 6 : day - 1;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - offset);
  return date;
}

function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function startOfYear(now: Date): Date {
  return new Date(now.getFullYear(), 0, 1);
}

function inRange(value: Date | undefined, start: Date | null): boolean {
  if (!start) return true;
  if (!value) return false;
  return value >= start;
}

function bumpStatus(counts: StatusCounts, status: AssignmentStatus) {
  counts.total += 1;
  if (status === "COMPLETED") counts.completed += 1;
  else if (status === "IN_PROGRESS") counts.inProgress += 1;
  else counts.notStarted += 1;
}

export async function getDashboardStats(db: Db, shopId: string, now = new Date()): Promise<DashboardStats> {
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);
  const starts: Record<PeriodKey, Date | null> = {
    all: null,
    week: weekStart,
    month: monthStart,
    year: yearStart
  };

  const [participants, courses, learners, assignments] = await Promise.all([
    db.collection("participants").countDocuments({ shopId, active: true }),
    db.collection("courses").countDocuments({ shopId, active: true, type: "SCORM_12" }),
    db
      .collection<LearnerProfileDocument>("learnerProfiles")
      .find({ shopId, role: "LEARNER" }, { projection: { status: 1, createdAt: 1 } })
      .toArray(),
    db
      .collection("assignments")
      .aggregate<AssignmentRow>([
        { $match: { shopId } },
        ...withActiveCourseStages(),
        { $project: { status: 1, assignedAt: 1, lastActivityAt: 1, completedAt: 1 } }
      ])
      .toArray()
  ]);

  const learnerCounts = {
    invited: learners.filter((item) => item.status === "INVITED").length,
    active: learners.filter((item) => item.status === "ACTIVE").length,
    inactive: learners.filter((item) => item.status === "INACTIVE").length,
    total: learners.length
  };

  const periods = {} as Record<PeriodKey, PeriodStats>;
  for (const key of Object.keys(starts) as PeriodKey[]) {
    const start = starts[key];
    const counts = emptyCounts();
    let assignedInPeriod = 0;
    let completedInPeriod = 0;

    for (const row of assignments) {
      if (key === "all") {
        bumpStatus(counts, row.status);
      } else if (inRange(row.assignedAt, start)) {
        bumpStatus(counts, row.status);
      }
      if (inRange(row.assignedAt, start) && key !== "all") assignedInPeriod += 1;
      if (inRange(row.completedAt, start)) completedInPeriod += 1;
    }

    if (key === "all") {
      assignedInPeriod = counts.total;
      completedInPeriod = counts.completed;
    }

    periods[key] = {
      ...counts,
      assignedInPeriod,
      completedInPeriod,
      newlyActivated: learners.filter((item) => item.status === "ACTIVE" && inRange(item.createdAt, start)).length
    };
  }

  return {
    participants,
    courses,
    learners: learnerCounts,
    periods
  };
}
