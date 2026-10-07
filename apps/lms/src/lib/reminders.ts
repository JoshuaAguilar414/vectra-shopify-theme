import type { Db, ObjectId } from "mongodb";
import { withActiveCourseStages } from "@/lib/assignments";
import { sendAssignmentReminderEmail } from "@/lib/mail";
import type { AssignmentDocument, CourseDocument, LearnerProfileDocument } from "@/lib/types";

export type ReminderResult = {
  scanned: number;
  sent: number;
  failed: number;
  skipped: number;
};

type ReminderRow = AssignmentDocument & {
  course: CourseDocument;
  learner?: LearnerProfileDocument;
};

function reminderDelayMs(): number {
  const days = Number(process.env.REMINDER_DAYS || 3);
  const safeDays = Number.isFinite(days) && days > 0 ? days : 3;
  return safeDays * 24 * 60 * 60 * 1000;
}

export async function processAssignmentReminders(
  db: Db,
  shopId?: string,
  now = new Date()
): Promise<ReminderResult> {
  const cutoff = new Date(now.getTime() - reminderDelayMs());
  const appUrl = (process.env.STOREFRONT_URL || process.env.APP_URL || "http://localhost:3456").replace(/\/$/, "");
  const match: Record<string, unknown> = {
    status: "NOT_STARTED",
    assignedAt: { $lte: cutoff },
    $or: [{ reminderSentAt: { $exists: false } }, { reminderSentAt: null }]
  };
  if (shopId) match.shopId = shopId;

  const rows = await db
    .collection("assignments")
    .aggregate<ReminderRow>([
      { $match: match },
      ...withActiveCourseStages(),
      { $lookup: { from: "learnerProfiles", localField: "userId", foreignField: "_id", as: "learner" } },
      { $unwind: { path: "$learner", preserveNullAndEmptyArrays: true } }
    ])
    .toArray();

  const result: ReminderResult = { scanned: rows.length, sent: 0, failed: 0, skipped: 0 };

  for (const row of rows) {
    const learner = row.learner;
    if (!learner?._id || learner.role !== "LEARNER" || learner.status === "INACTIVE") {
      result.skipped += 1;
      continue;
    }
    if (!learner.email) {
      result.skipped += 1;
      continue;
    }

    const courseTitle = row.course?.title || "your assigned course";
    const loginUrl = `${appUrl}/account/login`;
    try {
      const sent = await sendAssignmentReminderEmail({
        to: learner.email,
        learnerName: learner.firstName || "learner",
        courseTitle,
        loginUrl
      });
      if (!sent) {
        result.failed += 1;
        continue;
      }
      await db.collection<AssignmentDocument>("assignments").updateOne(
        { _id: row._id as ObjectId },
        { $set: { reminderSentAt: now, updatedAt: now } }
      );
      result.sent += 1;
    } catch (error) {
      console.error("Assignment reminder failed", { email: learner.email, error });
      result.failed += 1;
    }
  }

  return result;
}
