import type { Db, ObjectId } from "mongodb";
import { withActiveCourseStages } from "@/lib/assignments";
import { loadParticipantLookup, overlayRosterOnUser, participantLookupKey, rosterFieldsForUser } from "@/lib/fields";
import { sendInvitationEmail } from "@/lib/mail";
import { findApprovedParticipant } from "@/lib/participants";
import type {
  AssignmentDocument,
  CourseDocument,
  LearnerProfileDocument,
  StaffProfileDocument,
  StakeholderGroup,
  UserRole,
  UserStatus
} from "@/lib/types";
import { splitFullName } from "@/lib/utils";

export type InviteLearnerInput = {
  email: string;
  name: string;
  companyId: string;
  stakeholderGroup: StakeholderGroup;
  facilityTraining?: string;
  shopifyCustomerId?: string;
  role?: "LEARNER";
};

export type InviteStaffInput = {
  email: string;
  firstName: string;
  lastName: string;
  entity: string;
  role: UserRole;
  shopifyCustomerId?: string;
};

export type AssignedCourseView = { title: string; status: string };

export type UserView = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  entity: string;
  companyId?: string;
  stakeholderGroup?: StakeholderGroup;
  facilityTraining?: string;
  belongsToBp?: string;
  country?: string;
  topic?: string;
  nominatedProvider?: string;
  customFields?: Record<string, string>;
  role: UserRole;
  status: UserStatus;
  shopifyCustomerId?: string;
  createdAt: string;
  assignedCourses: AssignedCourseView[];
};

export class InviteError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function inviteLearner(db: Db, shopId: string, input: InviteLearnerInput): Promise<{ user: UserView; emailSent: boolean }> {
  const email = input.email.trim().toLowerCase();
  const { firstName, lastName } = splitFullName(input.name);
  const organizationalName = input.facilityTraining?.trim();
  if (!organizationalName) throw new InviteError("Enter your organizational name.", 400);

  const participant = await findApprovedParticipant(db, shopId, input.companyId, input.stakeholderGroup, organizationalName);
  if (!participant) {
    const anyForId = await findApprovedParticipant(db, shopId, input.companyId, input.stakeholderGroup);
    throw new InviteError(
      anyForId
        ? "Organizational name must match the approved organization name for this Company ID on the participant roster."
        : "This Company ID is not on the approved VECTRA participant list for the selected stakeholder group.",
      400
    );
  }
  if (await db.collection<LearnerProfileDocument>("learnerProfiles").findOne({ shopId, email })) {
    throw new InviteError("An account with this email already exists.", 409);
  }

  const now = new Date();
  const document: LearnerProfileDocument = {
    shopId,
    shopifyCustomerId: input.shopifyCustomerId,
    firstName,
    lastName,
    email,
    entity: participant.name,
    ...rosterFieldsForUser(participant),
    facilityTraining: organizationalName,
    role: "LEARNER",
    status: input.shopifyCustomerId ? "ACTIVE" : "INVITED",
    createdAt: now,
    updatedAt: now
  };

  const inserted = await db.collection<LearnerProfileDocument>("learnerProfiles").insertOne(document);
  const assignedCourses = await autoAssignTopicCourse(db, shopId, inserted.insertedId, participant.topic, now);

  const storefront = (process.env.STOREFRONT_URL || process.env.APP_URL || "http://localhost:3456").replace(/\/$/, "");
  const loginUrl = `${storefront}/account/login`;
  let emailSent = false;
  try {
    emailSent = await sendInvitationEmail({
      to: document.email,
      learnerName: document.firstName,
      activationUrl: loginUrl
    });
  } catch (error) {
    console.error("Invitation email failed", error);
  }

  return {
    user: toUserView(document, inserted.insertedId, assignedCourses),
    emailSent
  };
}

export async function inviteStaff(
  db: Db,
  shopId: string,
  input: InviteStaffInput
): Promise<{ staff: StaffProfileDocument & { id: string }; emailSent: boolean }> {
  const email = input.email.trim().toLowerCase();
  if (await db.collection<StaffProfileDocument>("staffProfiles").findOne({ shopId, email })) {
    throw new InviteError("A staff profile with this email already exists.", 409);
  }
  const now = new Date();
  const document: StaffProfileDocument = {
    shopId,
    shopifyCustomerId: input.shopifyCustomerId,
    email,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    role: input.role,
    createdAt: now,
    updatedAt: now
  };
  const inserted = await db.collection<StaffProfileDocument>("staffProfiles").insertOne(document);
  const storefront = (process.env.STOREFRONT_URL || process.env.APP_URL || "http://localhost:3456").replace(/\/$/, "");
  let emailSent = false;
  try {
    emailSent = await sendInvitationEmail({
      to: email,
      learnerName: document.firstName,
      activationUrl: `${storefront}/account/login`
    });
  } catch (error) {
    console.error("Staff invitation email failed", error);
  }
  return { staff: { ...document, _id: inserted.insertedId, id: inserted.insertedId.toHexString() }, emailSent };
}

async function autoAssignTopicCourse(
  db: Db,
  shopId: string,
  userId: ObjectId,
  topic: string,
  now: Date
): Promise<AssignedCourseView[]> {
  const course = await db.collection<CourseDocument>("courses").findOne({
    shopId,
    active: true,
    type: "SCORM_12",
    $or: [
      { title: { $regex: topic || "Freely Chosen Employment", $options: "i" } },
      { description: { $regex: topic || "Freely Chosen Employment", $options: "i" } }
    ]
  });
  if (!course?._id) return [];
  await db.collection<AssignmentDocument>("assignments").updateOne(
    { shopId, userId, courseId: course._id },
    {
      $setOnInsert: {
        shopId,
        userId,
        courseId: course._id,
        status: "NOT_STARTED",
        progress: 0,
        scormData: {},
        assignedAt: now,
        updatedAt: now
      }
    },
    { upsert: true }
  );
  return [{ title: course.title, status: "NOT_STARTED" }];
}

export async function listAdminUsers(db: Db, shopId: string): Promise<UserView[]> {
  const [users, assignmentRows, participants] = await Promise.all([
    db.collection<LearnerProfileDocument>("learnerProfiles").find({ shopId }).sort({ createdAt: -1 }).toArray(),
    db
      .collection("assignments")
      .aggregate([
        { $match: { shopId } },
        ...withActiveCourseStages(),
        { $project: { userId: 1, title: "$course.title", status: 1 } }
      ])
      .toArray(),
    loadParticipantLookup(db, shopId)
  ]);

  const coursesByUser = new Map<string, AssignedCourseView[]>();
  for (const row of assignmentRows as Array<{ userId: ObjectId; title: string; status: string }>) {
    const key = row.userId.toHexString();
    const list = coursesByUser.get(key) || [];
    list.push({ title: row.title, status: row.status });
    coursesByUser.set(key, list);
  }

  return users
    .filter((user) => user._id)
    .map((user) => {
      const participant = participants.get(participantLookupKey(user.companyId, user.stakeholderGroup, user.entity));
      return toUserView(overlayRosterOnUser(user, participant), user._id!, coursesByUser.get(user._id!.toHexString()) || []);
    });
}

function toUserView(document: LearnerProfileDocument, id: ObjectId, assignedCourses: AssignedCourseView[] = []): UserView {
  return {
    id: id.toHexString(),
    firstName: document.firstName,
    lastName: document.lastName,
    email: document.email,
    entity: document.entity,
    companyId: document.companyId,
    stakeholderGroup: document.stakeholderGroup,
    facilityTraining: document.facilityTraining,
    belongsToBp: document.belongsToBp,
    country: document.country,
    topic: document.topic,
    nominatedProvider: document.nominatedProvider,
    customFields: document.customFields || {},
    role: document.role,
    status: document.status,
    shopifyCustomerId: document.shopifyCustomerId,
    createdAt: document.createdAt.toISOString(),
    assignedCourses
  };
}

export async function updateLearnerProfile(
  db: Db,
  shopId: string,
  userId: ObjectId,
  input: { name?: string; firstName?: string; lastName?: string }
): Promise<UserView> {
  const user = await db.collection<LearnerProfileDocument>("learnerProfiles").findOne({ _id: userId, shopId });
  if (!user) throw new InviteError("User not found", 404);

  const updates: Partial<LearnerProfileDocument> = { updatedAt: new Date() };
  if (input.name) {
    const names = splitFullName(input.name);
    updates.firstName = names.firstName;
    updates.lastName = names.lastName;
  } else if (input.firstName && input.lastName) {
    updates.firstName = input.firstName.trim();
    updates.lastName = input.lastName.trim();
  }
  if (Object.keys(updates).length === 1) throw new InviteError("Provide at least one field to update.", 400);

  await db.collection<LearnerProfileDocument>("learnerProfiles").updateOne({ _id: userId, shopId }, { $set: updates });
  const updated = await db.collection<LearnerProfileDocument>("learnerProfiles").findOne({ _id: userId, shopId });
  return toUserView(updated!, userId);
}

export async function linkCustomerToLearner(
  db: Db,
  shopId: string,
  customerId: string,
  email?: string
): Promise<LearnerProfileDocument | null> {
  const byCustomer = await db.collection<LearnerProfileDocument>("learnerProfiles").findOne({
    shopId,
    shopifyCustomerId: customerId
  });
  if (byCustomer) return byCustomer;
  if (!email) return null;
  const byEmail = await db.collection<LearnerProfileDocument>("learnerProfiles").findOne({
    shopId,
    email: email.trim().toLowerCase()
  });
  if (!byEmail?._id) return null;
  await db.collection<LearnerProfileDocument>("learnerProfiles").updateOne(
    { _id: byEmail._id },
    { $set: { shopifyCustomerId: customerId, status: "ACTIVE", updatedAt: new Date() } }
  );
  return { ...byEmail, shopifyCustomerId: customerId, status: "ACTIVE" };
}
