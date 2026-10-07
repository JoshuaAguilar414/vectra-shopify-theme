import type { Db } from "mongodb";
import { isSystemRoleKey, slugRoleKey, STAFF_PAGES, type RoleView } from "@/lib/role-catalog";
import type { RoleDocument, UserRole } from "@/lib/types";

export { isLearnerRole, isSystemRoleKey, slugRoleKey, STAFF_PAGES, SYSTEM_ROLE_KEYS, type RoleView } from "@/lib/role-catalog";

const DEFAULT_ROLES: Array<Omit<RoleDocument, "_id" | "shopId" | "createdAt" | "updatedAt">> = [
  {
    key: "ADMIN",
    name: "Admin",
    description: "Full control of the LMS, including roster, staff, settings, and user groups.",
    system: true,
    pages: STAFF_PAGES.map((page) => page.key),
    canManageRoster: true,
    canCreateStaff: true,
    canRemoveUsers: true
  },
  {
    key: "COORDINATOR",
    name: "Coordinator",
    description: "Manage learners, courses, assignments, and reports. Roster is read-only.",
    system: true,
    pages: ["overview", "participants", "users", "courses", "reports"],
    canManageRoster: false,
    canCreateStaff: false,
    canRemoveUsers: false
  },
  {
    key: "LEARNER",
    name: "Learner",
    description: "Take assigned courses and manage a personal profile.",
    system: true,
    pages: [],
    canManageRoster: false,
    canCreateStaff: false,
    canRemoveUsers: false
  }
];

export function toRoleView(role: RoleDocument): RoleView {
  return {
    id: role._id!.toHexString(),
    key: role.key,
    name: role.name,
    description: role.description,
    system: role.system,
    pages: role.pages || [],
    canManageRoster: Boolean(role.canManageRoster),
    canCreateStaff: Boolean(role.canCreateStaff),
    canRemoveUsers: Boolean(role.canRemoveUsers)
  };
}

const roleReady = new Map<string, Promise<void>>();

export async function ensureSystemRoles(db: Db, shopId: string): Promise<void> {
  if (!roleReady.has(shopId)) {
    roleReady.set(shopId, upsertSystemRoles(db, shopId));
  }
  await roleReady.get(shopId);
}

async function upsertSystemRoles(db: Db, shopId: string): Promise<void> {
  const now = new Date();
  const roles = db.collection<RoleDocument>("roles");
  for (const role of DEFAULT_ROLES) {
    const existing = await roles.findOne({ shopId, key: role.key });
    if (existing?._id) {
      if (role.key === "ADMIN" || role.key === "LEARNER") {
        await roles.updateOne(
          { _id: existing._id },
          {
            $set: {
              shopId,
              name: role.name,
              description: role.description,
              system: true,
              pages: role.pages,
              canManageRoster: role.canManageRoster,
              canCreateStaff: role.canCreateStaff,
              canRemoveUsers: role.canRemoveUsers,
              updatedAt: now
            }
          }
        );
      } else {
        await roles.updateOne(
          { _id: existing._id },
          { $set: { shopId, system: true, name: existing.name || role.name, updatedAt: now } }
        );
      }
      continue;
    }
    await roles.insertOne({ ...role, shopId, createdAt: now, updatedAt: now });
  }
}

export async function listRoles(db: Db, shopId: string): Promise<RoleView[]> {
  await ensureSystemRoles(db, shopId);
  const roles = await db.collection<RoleDocument>("roles").find({ shopId }).sort({ system: -1, name: 1 }).toArray();
  return roles.filter((role) => role._id).map(toRoleView);
}

export async function getRoleByKey(db: Db, shopId: string, key: string): Promise<RoleDocument | null> {
  await ensureSystemRoles(db, shopId);
  return db.collection<RoleDocument>("roles").findOne({ shopId, key });
}

export function fallbackRole(key: string, shopId = ""): RoleDocument {
  const match = DEFAULT_ROLES.find((role) => role.key === key);
  if (match) {
    return { ...match, shopId, createdAt: new Date(), updatedAt: new Date() };
  }
  if (key === "LEARNER" || !key) {
    return { ...DEFAULT_ROLES[2], shopId, createdAt: new Date(), updatedAt: new Date() };
  }
  return {
    ...DEFAULT_ROLES[1],
    shopId,
    key,
    name: key,
    system: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

export function nextUniqueRoleKey(name: string, existing: Set<string>): UserRole {
  const base = slugRoleKey(name);
  if (!existing.has(base) && !isSystemRoleKey(base)) return base;
  let index = 2;
  while (existing.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}
