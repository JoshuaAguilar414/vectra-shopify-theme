import { MongoClient, type Db } from "mongodb";
import { ensureFieldDefinitions } from "@/lib/fields";
import { ensureSystemRoles } from "@/lib/roles";
import type {
  AssignmentDocument,
  CourseDocument,
  FieldDefinitionDocument,
  LearnerProfileDocument,
  ParticipantDocument,
  RoleDocument,
  StaffProfileDocument
} from "@/lib/types";

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var __indexesReady: Map<string, Promise<void>> | undefined;
}

function getUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured");
  return uri;
}

export function getClientPromise(): Promise<MongoClient> {
  if (!global.__mongoClientPromise) {
    const client = new MongoClient(getUri(), { maxPoolSize: 20, minPoolSize: 1 });
    global.__mongoClientPromise = client.connect();
  }
  return global.__mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(process.env.MONGODB_DB || "vectra_lms");
}

export async function getShopDb(shopId: string): Promise<Db> {
  const db = await getDb();
  await ensureShopIndexes(db, shopId);
  return db;
}

async function ensureShopIndexes(db: Db, shopId: string): Promise<void> {
  if (!global.__indexesReady) global.__indexesReady = new Map();
  if (!global.__indexesReady.has(shopId)) {
    global.__indexesReady.set(
      shopId,
      Promise.all([
        db.collection<LearnerProfileDocument>("learnerProfiles").createIndex({ shopId: 1, email: 1 }, { unique: true }),
        db
          .collection<LearnerProfileDocument>("learnerProfiles")
          .createIndex({ shopId: 1, shopifyCustomerId: 1 }, { unique: true, sparse: true }),
        db.collection<LearnerProfileDocument>("learnerProfiles").createIndex({ shopId: 1, companyId: 1 }),
        db.collection<LearnerProfileDocument>("learnerProfiles").createIndex({ shopId: 1, status: 1, role: 1 }),
        db.collection<StaffProfileDocument>("staffProfiles").createIndex({ shopId: 1, email: 1 }, { unique: true }),
        db
          .collection<StaffProfileDocument>("staffProfiles")
          .createIndex({ shopId: 1, shopifyCustomerId: 1 }, { unique: true, sparse: true }),
        db.collection<AssignmentDocument>("assignments").createIndex({ shopId: 1, userId: 1, courseId: 1 }, { unique: true }),
        db.collection<AssignmentDocument>("assignments").createIndex({ shopId: 1, courseId: 1, status: 1 }),
        db.collection<AssignmentDocument>("assignments").createIndex({ shopId: 1, status: 1, assignedAt: 1, reminderSentAt: 1 }),
        db.collection<CourseDocument>("courses").createIndex({ shopId: 1, active: 1, createdAt: -1 }),
        db
          .collection<ParticipantDocument>("participants")
          .createIndex({ shopId: 1, companyId: 1, name: 1, stakeholderGroup: 1 }, { unique: true }),
        db.collection<ParticipantDocument>("participants").createIndex({ shopId: 1, companyId: 1, stakeholderGroup: 1, active: 1 }),
        db.collection<ParticipantDocument>("participants").createIndex({ shopId: 1, active: 1, country: 1 }),
        db.collection<FieldDefinitionDocument>("fieldDefinitions").createIndex({ shopId: 1, key: 1 }, { unique: true }),
        db.collection<FieldDefinitionDocument>("fieldDefinitions").createIndex({ shopId: 1, order: 1 }),
        db.collection<RoleDocument>("roles").createIndex({ shopId: 1, key: 1 }, { unique: true })
      ]).then(async () => {
        await ensureFieldDefinitions(db, shopId);
        await ensureSystemRoles(db, shopId);
      })
    );
  }
  await global.__indexesReady.get(shopId);
}
