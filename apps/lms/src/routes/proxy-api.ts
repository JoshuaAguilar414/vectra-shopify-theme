import { Router, type Request, type Response } from "express";
import multer from "multer";
import { ObjectId } from "mongodb";
import { stringify } from "csv-stringify/sync";
import { lookup } from "mime-types";
import { getShopDb, getDb } from "@/db";
import { withActiveCourseStages } from "@/lib/assignments";
import { formatAssignmentStatus } from "@/lib/assignment-display";
import { getDashboardStats } from "@/lib/dashboard-stats";
import {
  listFieldDefinitionsForData,
  nextFieldOrder,
  payloadValues,
  persistNewDropdownOptions,
  slugifyFieldKey,
  toParticipantView,
  uniqueKey,
  validateParticipantValues
} from "@/lib/fields";
import { InviteError, inviteLearner, inviteStaff, listAdminUsers, updateLearnerProfile } from "@/lib/learners";
import { normalizeCompanyId, parseParticipantRows, upsertParticipants } from "@/lib/participants";
import { processAssignmentReminders } from "@/lib/reminders";
import { listRoles } from "@/lib/roles";
import { extractScormPackage, removeScormPackage } from "@/lib/scorm";
import {
  computeActivitySteps,
  computeScormProgress,
  countScormInteractions,
  parseProgressMeasure
} from "@/lib/scorm-progress";
import { readCourseFile } from "@/lib/course-storage";
import { SpreadsheetParseError, parseSpreadsheetBuffer } from "@/lib/spreadsheet";
import type {
  AssignmentDocument,
  CourseDocument,
  FieldDefinitionDocument,
  LearnerProfileDocument,
  ParticipantDocument,
  ScormData,
  UserStatus
} from "@/lib/types";
import { clamp, safeObjectId } from "@/lib/utils";
import {
  assignCourseSchema,
  bulkAssignSchema,
  bulkDeleteSchema,
  createUserSchema,
  fieldCreateSchema,
  progressSchema,
  updateCourseSchema,
  updateUserProfileSchema
} from "@/lib/validation";
import { requireLearner, requireRosterAdmin, requireStaff, resolveProxyActor } from "@/middleware/shopify-proxy";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_SCORM_UPLOAD_MB || 500) * 1024 * 1024 }
});

export const proxyApiRouter = Router();
proxyApiRouter.use(resolveProxyActor);

function shop(req: Request): string {
  return req.lms!.shopId;
}

function sendError(res: Response, error: unknown, fallback = "Request failed", status = 400): void {
  if (error instanceof InviteError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : fallback;
  console.error(error);
  res.status(status).json({ error: message });
}

// ——— Participants ———
proxyApiRouter.get("/api/participants", requireStaff, async (req, res) => {
  const db = await getShopDb(shop(req));
  const participants = await db
    .collection<ParticipantDocument>("participants")
    .find({ shopId: shop(req), active: true })
    .sort({ stakeholderGroup: 1, name: 1 })
    .toArray();
  res.json({ participants: participants.map(toParticipantView) });
});

proxyApiRouter.post("/api/participants", requireStaff, requireRosterAdmin, async (req, res) => {
  try {
    const db = await getShopDb(shop(req));
    const fields = await listFieldDefinitionsForData(db, shop(req));
    const parsed = validateParticipantValues(fields, payloadValues(req.body || {}, fields), shop(req));
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const payload = { ...parsed.data, shopId: shop(req), companyId: normalizeCompanyId(parsed.data.companyId) };
    const existing = await db.collection<ParticipantDocument>("participants").findOne({
      shopId: shop(req),
      companyId: payload.companyId,
      name: payload.name,
      stakeholderGroup: payload.stakeholderGroup
    });
    const now = new Date();
    if (existing?.active) {
      res.status(409).json({
        error: "An organization with this Company ID, name, and stakeholder group already exists."
      });
      return;
    }
    if (existing?._id) {
      await db
        .collection<ParticipantDocument>("participants")
        .updateOne({ _id: existing._id }, { $set: { ...payload, active: true, updatedAt: now } });
      const restored = await db.collection<ParticipantDocument>("participants").findOne({ _id: existing._id });
      res.json({ participant: toParticipantView(restored!), restored: true });
      return;
    }
    const doc: ParticipantDocument = { ...payload, active: true, createdAt: now, updatedAt: now };
    const result = await db.collection<ParticipantDocument>("participants").insertOne(doc);
    res.json({ participant: toParticipantView({ ...doc, _id: result.insertedId }) });
  } catch (error) {
    sendError(res, error);
  }
});

proxyApiRouter.delete("/api/participants/:participantId", requireStaff, requireRosterAdmin, async (req, res) => {
  const id = safeObjectId(req.params.participantId);
  if (!id) {
    res.status(400).json({ error: "Invalid participant" });
    return;
  }
  const db = await getShopDb(shop(req));
  await db
    .collection<ParticipantDocument>("participants")
    .updateOne({ _id: id, shopId: shop(req) }, { $set: { active: false, updatedAt: new Date() } });
  res.json({ ok: true });
});

proxyApiRouter.post("/api/participants/bulk-delete", requireStaff, requireRosterAdmin, async (req, res) => {
  const parsed = bulkDeleteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide ids[]" });
    return;
  }
  const ids = parsed.data.ids.map(safeObjectId).filter(Boolean) as ObjectId[];
  const db = await getShopDb(shop(req));
  const result = await db
    .collection<ParticipantDocument>("participants")
    .updateMany({ _id: { $in: ids }, shopId: shop(req) }, { $set: { active: false, updatedAt: new Date() } });
  res.json({ ok: true, deleted: result.modifiedCount });
});

proxyApiRouter.post("/api/participants/import", requireStaff, requireRosterAdmin, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "CSV or XLSX file required" });
      return;
    }
    const db = await getShopDb(shop(req));
    const fields = await listFieldDefinitionsForData(db, shop(req));
    const records = parseSpreadsheetBuffer(req.file.buffer, req.file.originalname);
    const parsed = parseParticipantRows(records, fields, { allowNewDropdownValues: true });
    if (parsed.errors.length && !parsed.rows.length) {
      res.status(400).json({ error: parsed.errors[0], errors: parsed.errors });
      return;
    }
    const rows = parsed.rows.map((row) => ({ ...row, shopId: shop(req) }));
    await persistNewDropdownOptions(db, shop(req), fields, rows);
    const result = await upsertParticipants(db, shop(req), rows, { presentKeys: parsed.presentKeys });
    res.json({ ...result, errors: parsed.errors, imported: rows.length });
  } catch (error) {
    if (error instanceof SpreadsheetParseError) {
      res.status(400).json({ error: error.message });
      return;
    }
    sendError(res, error, "Import failed");
  }
});

// ——— Fields & roles ———
proxyApiRouter.get("/api/fields", requireStaff, async (req, res) => {
  const db = await getShopDb(shop(req));
  const fields = await listFieldDefinitionsForData(db, shop(req));
  res.json({ fields });
});

proxyApiRouter.post("/api/fields", requireStaff, requireRosterAdmin, async (req, res) => {
  const parsed = fieldCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid field" });
    return;
  }
  const db = await getShopDb(shop(req));
  const existing = await db.collection<FieldDefinitionDocument>("fieldDefinitions").find({ shopId: shop(req) }).toArray();
  const keys = new Set(existing.map((f) => f.key));
  const key = uniqueKey(slugifyFieldKey(parsed.data.label), keys);
  const now = new Date();
  const doc: FieldDefinitionDocument = {
    shopId: shop(req),
    key,
    label: parsed.data.label,
    type: parsed.data.type,
    required: parsed.data.required,
    options: parsed.data.options || [],
    system: false,
    lockedOptions: false,
    copyToUser: parsed.data.copyToUser,
    filterable: parsed.data.filterable,
    order: await nextFieldOrder(db, shop(req)),
    createdAt: now,
    updatedAt: now
  };
  const result = await db.collection<FieldDefinitionDocument>("fieldDefinitions").insertOne(doc);
  res.json({ field: { id: result.insertedId.toHexString(), ...doc } });
});

proxyApiRouter.get("/api/roles", requireStaff, async (req, res) => {
  const db = await getShopDb(shop(req));
  res.json({ roles: await listRoles(db, shop(req)) });
});

// ——— Users (learners) ———
proxyApiRouter.get("/api/users", requireStaff, async (req, res) => {
  const db = await getShopDb(shop(req));
  res.json({ users: await listAdminUsers(db, shop(req)) });
});

proxyApiRouter.post("/api/users", requireStaff, async (req, res) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid user payload" });
      return;
    }
    const db = await getShopDb(shop(req));
    const data = parsed.data;
    if (data.role === "LEARNER") {
      const result = await inviteLearner(db, shop(req), {
        email: data.email,
        name: data.name!,
        companyId: data.companyId!,
        stakeholderGroup: data.stakeholderGroup!,
        facilityTraining: data.facilityTraining,
        shopifyCustomerId: data.shopifyCustomerId
      });
      res.json(result);
      return;
    }
    if (!req.lms?.permissions.createStaff) {
      res.status(403).json({ error: "Only administrators can create staff." });
      return;
    }
    const result = await inviteStaff(db, shop(req), {
      email: data.email,
      firstName: data.firstName!,
      lastName: data.lastName!,
      entity: data.entity!,
      role: data.role,
      shopifyCustomerId: data.shopifyCustomerId
    });
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
});

proxyApiRouter.patch("/api/users/:userId/status", requireStaff, async (req, res) => {
  const id = safeObjectId(req.params.userId);
  const status = String(req.body?.status || "") as UserStatus;
  if (!id || !["ACTIVE", "INACTIVE", "INVITED"].includes(status)) {
    res.status(400).json({ error: "Invalid status update" });
    return;
  }
  const db = await getShopDb(shop(req));
  await db
    .collection<LearnerProfileDocument>("learnerProfiles")
    .updateOne({ _id: id, shopId: shop(req) }, { $set: { status, updatedAt: new Date() } });
  res.json({ ok: true });
});

proxyApiRouter.post("/api/users/bulk-delete", requireStaff, async (req, res) => {
  if (!req.lms?.permissions.removeUsers) {
    res.status(403).json({ error: "Only administrators can remove users." });
    return;
  }
  const parsed = bulkDeleteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide ids[]" });
    return;
  }
  const ids = parsed.data.ids.map(safeObjectId).filter(Boolean) as ObjectId[];
  const db = await getShopDb(shop(req));
  await db.collection<AssignmentDocument>("assignments").deleteMany({ shopId: shop(req), userId: { $in: ids } });
  const result = await db.collection<LearnerProfileDocument>("learnerProfiles").deleteMany({
    shopId: shop(req),
    _id: { $in: ids }
  });
  res.json({ ok: true, deleted: result.deletedCount });
});

// ——— Courses ———
proxyApiRouter.get("/api/courses", requireStaff, async (req, res) => {
  const db = await getShopDb(shop(req));
  const courses = await db
    .collection<CourseDocument>("courses")
    .find({ shopId: shop(req) })
    .sort({ createdAt: -1 })
    .toArray();
  res.json({
    courses: courses.map((c) => ({
      id: c._id!.toHexString(),
      title: c.title,
      description: c.description,
      type: c.type,
      active: c.active,
      launchPath: c.launchPath,
      originalFilename: c.originalFilename,
      createdAt: c.createdAt
    }))
  });
});

proxyApiRouter.post("/api/courses", requireStaff, upload.single("file"), async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    if (!title || !req.file) {
      res.status(400).json({ error: "Title and ZIP package are required" });
      return;
    }
    const id = new ObjectId();
    const { launchPath } = await extractScormPackage(req.file.buffer, id.toHexString());
    const now = new Date();
    const course: CourseDocument = {
      _id: id,
      shopId: shop(req),
      title,
      description,
      type: "SCORM_12",
      active: true,
      launchPath,
      originalFilename: req.file.originalname,
      createdAt: now,
      updatedAt: now
    };
    await (await getShopDb(shop(req))).collection<CourseDocument>("courses").insertOne(course);
    res.json({
      course: { id: id.toHexString(), title, description, type: course.type, active: true, launchPath }
    });
  } catch (error) {
    sendError(res, error, "SCORM upload failed");
  }
});

proxyApiRouter.patch("/api/courses/:courseId", requireStaff, async (req, res) => {
  const id = safeObjectId(req.params.courseId);
  const parsed = updateCourseSchema.safeParse(req.body);
  if (!id || !parsed.success) {
    res.status(400).json({ error: "Invalid course update" });
    return;
  }
  const db = await getShopDb(shop(req));
  await db
    .collection<CourseDocument>("courses")
    .updateOne({ _id: id, shopId: shop(req) }, { $set: { ...parsed.data, updatedAt: new Date() } });
  res.json({ ok: true });
});

proxyApiRouter.delete("/api/courses/:courseId", requireStaff, async (req, res) => {
  const id = safeObjectId(req.params.courseId);
  if (!id) {
    res.status(400).json({ error: "Invalid course" });
    return;
  }
  const db = await getShopDb(shop(req));
  await db
    .collection<CourseDocument>("courses")
    .updateOne({ _id: id, shopId: shop(req) }, { $set: { active: false, updatedAt: new Date() } });
  res.json({ ok: true });
});

// ——— Assignments ———
proxyApiRouter.get("/api/assignments", requireStaff, async (req, res) => {
  const db = await getShopDb(shop(req));
  const rows = await db
    .collection("assignments")
    .aggregate([
      { $match: { shopId: shop(req) } },
      ...withActiveCourseStages(),
      { $lookup: { from: "learnerProfiles", localField: "userId", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $sort: { assignedAt: -1 } }
    ])
    .toArray();
  res.json({
    assignments: rows.map((row: any) => ({
      id: row._id.toHexString(),
      status: row.status,
      progress: row.progress,
      score: row.score,
      assignedAt: row.assignedAt,
      completedAt: row.completedAt,
      course: { id: row.course._id.toHexString(), title: row.course.title },
      user: {
        id: row.user._id.toHexString(),
        firstName: row.user.firstName,
        lastName: row.user.lastName,
        email: row.user.email,
        entity: row.user.entity
      }
    }))
  });
});

proxyApiRouter.post("/api/assignments", requireStaff, async (req, res) => {
  const parsed = assignCourseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "userId and courseId required" });
    return;
  }
  const userId = safeObjectId(parsed.data.userId);
  const courseId = safeObjectId(parsed.data.courseId);
  if (!userId || !courseId) {
    res.status(400).json({ error: "Invalid ids" });
    return;
  }
  const db = await getShopDb(shop(req));
  const now = new Date();
  await db.collection<AssignmentDocument>("assignments").updateOne(
    { shopId: shop(req), userId, courseId },
    {
      $setOnInsert: {
        shopId: shop(req),
        userId,
        courseId,
        status: "NOT_STARTED",
        progress: 0,
        scormData: {},
        assignedAt: now,
        updatedAt: now
      }
    },
    { upsert: true }
  );
  res.json({ ok: true });
});

proxyApiRouter.post("/api/assignments/bulk", requireStaff, async (req, res) => {
  const parsed = bulkAssignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid bulk assign" });
    return;
  }
  const courseId = safeObjectId(parsed.data.courseId);
  if (!courseId) {
    res.status(400).json({ error: "Invalid courseId" });
    return;
  }
  const db = await getShopDb(shop(req));
  const filter: Record<string, unknown> = { shopId: shop(req), role: "LEARNER", status: { $ne: "INACTIVE" } };
  if (parsed.data.userIds?.length) {
    filter._id = { $in: parsed.data.userIds.map(safeObjectId).filter(Boolean) };
  } else {
    if (parsed.data.companyId) filter.companyId = parsed.data.companyId;
    if (parsed.data.country) filter.country = parsed.data.country;
    if (parsed.data.stakeholderGroup) filter.stakeholderGroup = parsed.data.stakeholderGroup;
  }
  const learners = await db.collection<LearnerProfileDocument>("learnerProfiles").find(filter).toArray();
  const now = new Date();
  let assigned = 0;
  for (const learner of learners) {
    if (!learner._id) continue;
    const result = await db.collection<AssignmentDocument>("assignments").updateOne(
      { shopId: shop(req), userId: learner._id, courseId },
      {
        $setOnInsert: {
          shopId: shop(req),
          userId: learner._id,
          courseId,
          status: "NOT_STARTED",
          progress: 0,
          scormData: {},
          assignedAt: now,
          updatedAt: now
        }
      },
      { upsert: true }
    );
    if (result.upsertedCount) assigned += 1;
  }
  res.json({ ok: true, assigned, matched: learners.length });
});

// ——— Reports ———
proxyApiRouter.get("/api/reports", requireStaff, async (req, res) => {
  const db = await getShopDb(shop(req));
  const rows = await loadReportRows(db, shop(req), req.query as Record<string, string>);
  res.json({ rows });
});

proxyApiRouter.get("/api/reports/csv", requireStaff, async (req, res) => {
  const db = await getShopDb(shop(req));
  const rows = await loadReportRows(db, shop(req), req.query as Record<string, string>);
  const csv = stringify(
    rows.map((row) => ({
      "First Name": row.firstName,
      "Last Name": row.lastName,
      "Corporate Email": row.email,
      Entity: row.entity,
      Country: row.country || "",
      Course: row.courseTitle,
      Status: formatAssignmentStatus(row.status),
      "Assessment Score": row.score ?? "",
      "Last Completed Page or Lesson": row.lessonLocation || "",
      "Last Activity Date": row.lastActivityAt || "",
      "Completion Date": row.completedAt || ""
    })),
    { header: true }
  );
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="vectra-lms-progress-${new Date().toISOString().slice(0, 10)}.csv"`
  );
  res.send(csv);
});

async function loadReportRows(db: Awaited<ReturnType<typeof getShopDb>>, shopId: string, query: Record<string, string>) {
  const status = query.status;
  const course = query.course;
  const country = query.country;
  const q = (query.q || "").trim().toLowerCase();
  const rows = await db
    .collection("assignments")
    .aggregate([
      { $match: { shopId } },
      ...withActiveCourseStages(),
      { $lookup: { from: "learnerProfiles", localField: "userId", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $sort: { "user.entity": 1, "user.lastName": 1 } }
    ])
    .toArray();

  return rows
    .filter((row: any) => {
      if (status && row.status !== status) return false;
      if (course && row.course.title !== course) return false;
      if (country && (row.user.country || "") !== country) return false;
      if (q) {
        const haystack = [
          row.user.firstName,
          row.user.lastName,
          row.user.email,
          row.user.entity,
          row.user.country,
          row.course.title,
          row.status
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .map((row: any) => ({
      id: row._id.toHexString(),
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      email: row.user.email,
      entity: row.user.entity,
      country: row.user.country || "",
      courseTitle: row.course.title,
      status: row.status,
      progress: row.progress,
      score: row.score,
      lessonLocation: row.scormData?.lessonLocation || "",
      lastActivityAt: row.lastActivityAt ? new Date(row.lastActivityAt).toISOString() : "",
      completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : ""
    }));
}

// ——— Dashboard ———
proxyApiRouter.get("/api/dashboard", requireStaff, async (req, res) => {
  const db = await getShopDb(shop(req));
  res.json({ stats: await getDashboardStats(db, shop(req)) });
});

// ——— Learner profile / my courses / launch ———
proxyApiRouter.get("/api/profile", requireLearner, async (req, res) => {
  const db = await getShopDb(shop(req));
  if (req.lms!.learnerProfileId) {
    const id = new ObjectId(req.lms!.learnerProfileId);
    const profile = await db.collection<LearnerProfileDocument>("learnerProfiles").findOne({ _id: id, shopId: shop(req) });
    res.json({ profile, staff: req.lms!.staff, permissions: req.lms!.permissions });
    return;
  }
  res.json({ profile: null, staff: req.lms!.staff, permissions: req.lms!.permissions });
});

proxyApiRouter.patch("/api/profile", requireLearner, async (req, res) => {
  try {
    if (!req.lms!.learnerProfileId) {
      res.status(400).json({ error: "No learner profile linked" });
      return;
    }
    const parsed = updateUserProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid profile" });
      return;
    }
    const db = await getShopDb(shop(req));
    const user = await updateLearnerProfile(db, shop(req), new ObjectId(req.lms!.learnerProfileId), parsed.data);
    res.json({ user });
  } catch (error) {
    sendError(res, error);
  }
});

proxyApiRouter.get("/api/learn", requireLearner, async (req, res) => {
  const db = await getShopDb(shop(req));
  const userId = req.lms!.learnerProfileId ? new ObjectId(req.lms!.learnerProfileId) : null;
  if (!userId) {
    res.json({ assignments: [] });
    return;
  }
  const rows = await db
    .collection("assignments")
    .aggregate([
      { $match: { shopId: shop(req), userId } },
      ...withActiveCourseStages(),
      { $sort: { assignedAt: -1 } }
    ])
    .toArray();
  res.json({
    assignments: rows.map((row: any) => ({
      id: row._id.toHexString(),
      status: row.status,
      progress: row.progress,
      score: row.score,
      course: {
        id: row.course._id.toHexString(),
        title: row.course.title,
        description: row.course.description
      },
      launchUrl: `/marketplace/lms/learn?assignment=${row._id.toHexString()}`,
      apiLaunchUrl: `/apps/lms/api/learn/${row._id.toHexString()}`
    }))
  });
});

proxyApiRouter.get("/api/learn/:assignmentId", requireLearner, async (req, res) => {
  const id = safeObjectId(req.params.assignmentId);
  if (!id) {
    res.status(400).json({ error: "Invalid assignment" });
    return;
  }
  const db = await getShopDb(shop(req));
  const filter: Record<string, unknown> = { _id: id, shopId: shop(req) };
  if (!req.lms!.staff && req.lms!.learnerProfileId) {
    filter.userId = new ObjectId(req.lms!.learnerProfileId);
  }
  const assignment = await db.collection<AssignmentDocument>("assignments").findOne(filter);
  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }
  const course = await db.collection<CourseDocument>("courses").findOne({
    _id: assignment.courseId,
    shopId: shop(req),
    active: true
  });
  if (!course?.launchPath) {
    res.status(404).json({ error: "Course content not available" });
    return;
  }
  const contentBase = `/apps/lms/content/${course._id!.toHexString()}`;
  res.json({
    assignment: {
      id: assignment._id!.toHexString(),
      status: assignment.status,
      progress: assignment.progress,
      scormData: assignment.scormData
    },
    course: {
      id: course._id!.toHexString(),
      title: course.title,
      launchPath: course.launchPath,
      launchUrl: `${contentBase}/${course.launchPath}`
    },
    progressUrl: `/apps/lms/api/progress`
  });
});

proxyApiRouter.post("/api/progress", requireLearner, async (req, res) => {
  try {
    const assignmentId = safeObjectId(String(req.body?.assignmentId || ""));
    const parsed = progressSchema.safeParse(req.body);
    if (!assignmentId || !parsed.success) {
      res.status(400).json({ error: "Invalid SCORM progress payload" });
      return;
    }
    const db = await getShopDb(shop(req));
    const filter: Record<string, unknown> = { _id: assignmentId, shopId: shop(req) };
    if (!req.lms!.staff && req.lms!.learnerProfileId) {
      filter.userId = new ObjectId(req.lms!.learnerProfileId);
    }
    const assignment = await db.collection<AssignmentDocument>("assignments").findOne(filter);
    if (!assignment) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }

    const values = parsed.data.values;
    const prev = assignment.scormData || {};
    const lessonStatus = pickString(values["cmi.core.lesson_status"], prev.lessonStatus) || "incomplete";
    const scoreRaw = pickNumber(values["cmi.core.score.raw"], prev.scoreRaw);
    const scoreMin = pickNumber(values["cmi.core.score.min"], prev.scoreMin);
    const scoreMax = pickNumber(values["cmi.core.score.max"], prev.scoreMax) ?? 100;
    const lessonLocation = pickString(values["cmi.core.lesson_location"], prev.lessonLocation) || "";
    const suspendData = pickString(values["cmi.suspend_data"], prev.suspendData) || "";
    const progressMeasure = pickProgressMeasure(values["cmi.progress_measure"], prev.progressMeasure);
    const totalTime = pickString(values["cmi.core.total_time"], prev.totalTime) || "";
    const sessionTime = pickString(values["cmi.core.session_time"], prev.sessionTime) || "";
    const exit = pickString(values["cmi.core.exit"], prev.exit) || "";

    const completed = ["completed", "passed"].includes(lessonStatus.toLowerCase());
    const started =
      lessonStatus.toLowerCase() !== "not attempted" ||
      Boolean(lessonLocation || suspendData || scoreRaw !== undefined || progressMeasure !== undefined);
    const now = new Date();
    const interactionCount = countScormInteractions(values);
    const { activitySteps, lastProgressBumpAt } = computeActivitySteps({
      previousSteps: prev.activitySteps ?? 0,
      previousInteractionCount: prev.interactionCount ?? 0,
      interactionCount,
      started,
      completed,
      now,
      lastProgressBumpAt: prev.lastProgressBumpAt
    });
    const progress = computeScormProgress({
      completed,
      started,
      previous: assignment.progress,
      progressMeasure,
      scoreRaw,
      scoreMin,
      scoreMax,
      activitySteps
    });

    const scormData: ScormData = {
      lessonLocation,
      lessonStatus,
      scoreRaw,
      scoreMin,
      scoreMax,
      progressMeasure,
      interactionCount,
      activitySteps,
      ...(lastProgressBumpAt ? { lastProgressBumpAt } : {}),
      suspendData,
      totalTime,
      sessionTime,
      exit
    };

    await db.collection<AssignmentDocument>("assignments").updateOne(
      { _id: assignmentId },
      {
        $set: {
          status: completed ? "COMPLETED" : started ? "IN_PROGRESS" : "NOT_STARTED",
          progress: clamp(progress, 0, 100),
          ...(scoreRaw !== undefined ? { score: scoreRaw } : {}),
          scormData,
          lastActivityAt: now,
          updatedAt: now,
          ...(completed && !assignment.completedAt ? { completedAt: now } : {})
        }
      }
    );
    res.json({ ok: true, completed, progress });
  } catch (error) {
    sendError(res, error, "Progress update failed");
  }
});

proxyApiRouter.post("/api/progress/:assignmentId", requireLearner, async (req, res) => {
  req.body = { ...(req.body || {}), assignmentId: req.params.assignmentId };
  try {
    const assignmentId = safeObjectId(req.params.assignmentId);
    const parsed = progressSchema.safeParse(req.body);
    if (!assignmentId || !parsed.success) {
      res.status(400).json({ error: "Invalid SCORM progress payload" });
      return;
    }
    // Reuse POST /api/progress by setting body and falling through is awkward —
    // call the same persistence via redirecting body to shared shape:
    const fakeReq = req;
    fakeReq.body.assignmentId = req.params.assignmentId;
    const db = await getShopDb(shop(req));
    const filter: Record<string, unknown> = { _id: assignmentId, shopId: shop(req) };
    if (!req.lms!.staff && req.lms!.learnerProfileId) {
      filter.userId = new ObjectId(req.lms!.learnerProfileId);
    }
    const assignment = await db.collection<AssignmentDocument>("assignments").findOne(filter);
    if (!assignment) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }
    const values = parsed.data.values;
    const prev = assignment.scormData || {};
    const lessonStatus = pickString(values["cmi.core.lesson_status"], prev.lessonStatus) || "incomplete";
    const scoreRaw = pickNumber(values["cmi.core.score.raw"], prev.scoreRaw);
    const completed = ["completed", "passed"].includes(lessonStatus.toLowerCase());
    const started = lessonStatus.toLowerCase() !== "not attempted" || scoreRaw !== undefined;
    const now = new Date();
    const progress = computeScormProgress({
      completed,
      started,
      previous: assignment.progress,
      scoreRaw,
      activitySteps: prev.activitySteps
    });
    await db.collection<AssignmentDocument>("assignments").updateOne(
      { _id: assignmentId },
      {
        $set: {
          status: completed ? "COMPLETED" : started ? "IN_PROGRESS" : "NOT_STARTED",
          progress: clamp(progress, 0, 100),
          ...(scoreRaw !== undefined ? { score: scoreRaw } : {}),
          lastActivityAt: now,
          updatedAt: now,
          ...(completed && !assignment.completedAt ? { completedAt: now } : {})
        }
      }
    );
    res.json({ ok: true, completed, progress });
  } catch (error) {
    sendError(res, error);
  }
});

// ——— SCORM content ———
proxyApiRouter.get(/^\/content\/([^/]+)\/(.+)$/, async (req, res) => {
  try {
    const match = req.path.match(/^\/content\/([^/]+)\/(.+)$/);
    const courseId = match?.[1] || "";
    const rel = decodeURIComponent(match?.[2] || "").replace(/^\/+/, "");
    if (!courseId || rel.includes("..")) {
      res.status(400).json({ error: "Invalid path" });
      return;
    }
    const db = await getShopDb(shop(req));
    const oid = safeObjectId(courseId);
    if (!oid) {
      res.status(400).json({ error: "Invalid course" });
      return;
    }
    const course = await db.collection<CourseDocument>("courses").findOne({ _id: oid, shopId: shop(req) });
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }
    const body = await readCourseFile(courseId, rel || course.launchPath || "index.html");
    if (!body) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const type = lookup(rel) || "application/octet-stream";
    res.setHeader("Content-Type", typeof type === "string" ? type : "application/octet-stream");
    res.send(body);
  } catch (error) {
    sendError(res, error, "Content error", 500);
  }
});

export async function runRemindersJob(req: Request, res: Response): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers["x-cron-secret"] !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const db = await getDb();
  const shopId = typeof req.query.shop === "string" ? req.query.shop : undefined;
  const result = await processAssignmentReminders(db, shopId);
  res.json(result);
}

function pickString(next: string | undefined, previous: string | undefined): string | undefined {
  if (next !== undefined && next !== "") return next;
  return previous;
}

function pickNumber(next: string | undefined, previous: number | undefined): number | undefined {
  if (next !== undefined && next.trim() !== "") {
    const parsed = Number(next);
    return Number.isFinite(parsed) ? parsed : previous;
  }
  return previous;
}

function pickProgressMeasure(next: string | undefined, previous: number | undefined): number | undefined {
  if (next !== undefined && next.trim() !== "") {
    return parseProgressMeasure(next) ?? previous;
  }
  return previous;
}

// silence unused import warning for removeScormPackage in scaffold
void removeScormPackage;
