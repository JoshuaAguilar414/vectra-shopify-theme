import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("src/lib");

function adaptFields() {
  let s = fs.readFileSync(path.join(dir, "fields.ts"), "utf8");
  s = s.replace(
    "export async function listFieldDefinitions(db: Db): Promise<FieldDefinitionView[]> {\n  await ensureFieldDefinitions(db);\n  const docs = await db\n    .collection<FieldDefinitionDocument>(\"fieldDefinitions\")\n    .find({})\n    .sort({ order: 1, label: 1 })\n    .toArray();",
    "export async function listFieldDefinitions(db: Db, shopId: string): Promise<FieldDefinitionView[]> {\n  await ensureFieldDefinitions(db, shopId);\n  const docs = await db\n    .collection<FieldDefinitionDocument>(\"fieldDefinitions\")\n    .find({ shopId })\n    .sort({ order: 1, label: 1 })\n    .toArray();"
  );
  s = s.replace(
    "export async function listFieldDefinitionsForData(db: Db): Promise<FieldDefinitionView[]> {\n  const fields = await listFieldDefinitions(db);\n  const observed = await observedFieldValues(db, fields);",
    "export async function listFieldDefinitionsForData(db: Db, shopId: string): Promise<FieldDefinitionView[]> {\n  const fields = await listFieldDefinitions(db, shopId);\n  const observed = await observedFieldValues(db, shopId, fields);"
  );
  s = s.replace(
    "async function observedFieldValues(db: Db, fields: FieldDefinitionView[]): Promise<Record<string, string[]>> {\n  const projection: Record<string, 1> = { customFields: 1 };\n  for (const key of SYSTEM_FIELD_KEYS) projection[key] = 1;\n  const rows = await db\n    .collection<ParticipantDocument>(\"participants\")\n    .find({ active: true })",
    "async function observedFieldValues(db: Db, shopId: string, fields: FieldDefinitionView[]): Promise<Record<string, string[]>> {\n  const projection: Record<string, 1> = { customFields: 1 };\n  for (const key of SYSTEM_FIELD_KEYS) projection[key] = 1;\n  const rows = await db\n    .collection<ParticipantDocument>(\"participants\")\n    .find({ shopId, active: true })"
  );
  s = s.replace(
    "async function harvestDropdownOptions(db: Db, key: SystemFieldKey): Promise<string[]> {\n  const rows = await db\n    .collection<ParticipantDocument>(\"participants\")\n    .find({ active: true })",
    "async function harvestDropdownOptions(db: Db, shopId: string, key: SystemFieldKey): Promise<string[]> {\n  const rows = await db\n    .collection<ParticipantDocument>(\"participants\")\n    .find({ shopId, active: true })"
  );
  s = s.replace(
    "export async function ensureFieldDefinitions(db: Db): Promise<void> {\n  const collection = db.collection<FieldDefinitionDocument>(\"fieldDefinitions\");\n  const now = new Date();\n\n  for (const seed of SYSTEM_SEEDS) {\n    const existing = await collection.findOne({ key: seed.key });\n    if (!existing) {\n      const options =\n        seed.type === \"dropdown\" && !seed.lockedOptions\n          ? [...new Set([...seed.options, ...(await harvestDropdownOptions(db, seed.key as SystemFieldKey))])].sort()\n          : seed.options;\n      await collection.insertOne({\n        ...seed,\n        options,\n        createdAt: now,\n        updatedAt: now\n      });\n      continue;\n    }\n    if (existing.type === \"dropdown\" && !existing.lockedOptions && !(existing.options || []).length) {\n      const harvested = await harvestDropdownOptions(db, seed.key as SystemFieldKey);",
    "export async function ensureFieldDefinitions(db: Db, shopId: string): Promise<void> {\n  const collection = db.collection<FieldDefinitionDocument>(\"fieldDefinitions\");\n  const now = new Date();\n\n  for (const seed of SYSTEM_SEEDS) {\n    const existing = await collection.findOne({ shopId, key: seed.key });\n    if (!existing) {\n      const options =\n        seed.type === \"dropdown\" && !seed.lockedOptions\n          ? [...new Set([...seed.options, ...(await harvestDropdownOptions(db, shopId, seed.key as SystemFieldKey))])].sort()\n          : seed.options;\n      await collection.insertOne({\n        ...seed,\n        shopId,\n        options,\n        createdAt: now,\n        updatedAt: now\n      });\n      continue;\n    }\n    if (existing.type === \"dropdown\" && !existing.lockedOptions && !(existing.options || []).length) {\n      const harvested = await harvestDropdownOptions(db, shopId, seed.key as SystemFieldKey);"
  );
  s = s.replace(
    "export function applyFieldValues(fields: FieldDefinitionView[], values: Record<string, string>): ParticipantWrite {\n  const customFields: Record<string, string> = {};\n  const system: Partial<ParticipantWrite> = {};\n\n  for (const field of fields) {\n    const value = normalizeFieldValue(field, values[field.key] || \"\");\n    if (isSystemFieldKey(field.key)) {\n      (system as Record<string, string>)[field.key] = value;\n    } else {\n      customFields[field.key] = value;\n    }\n  }\n\n  return {\n    stakeholderGroup: (system.stakeholderGroup || \"Facility\") as StakeholderGroup,\n    companyId: system.companyId || \"\",\n    name: system.name || \"\",\n    belongsToBp: system.belongsToBp || \"\",\n    country: system.country || \"\",\n    topic: system.topic || \"\",\n    nominatedProvider: normalizeNominatedProvider(system.nominatedProvider || \"\"),\n    customFields\n  };\n}",
    "export function applyFieldValues(fields: FieldDefinitionView[], values: Record<string, string>, shopId = \"\"): ParticipantWrite {\n  const customFields: Record<string, string> = {};\n  const system: Partial<ParticipantWrite> = {};\n\n  for (const field of fields) {\n    const value = normalizeFieldValue(field, values[field.key] || \"\");\n    if (isSystemFieldKey(field.key)) {\n      (system as Record<string, string>)[field.key] = value;\n    } else {\n      customFields[field.key] = value;\n    }\n  }\n\n  return {\n    shopId,\n    stakeholderGroup: (system.stakeholderGroup || \"Facility\") as StakeholderGroup,\n    companyId: system.companyId || \"\",\n    name: system.name || \"\",\n    belongsToBp: system.belongsToBp || \"\",\n    country: system.country || \"\",\n    topic: system.topic || \"\",\n    nominatedProvider: normalizeNominatedProvider(system.nominatedProvider || \"\"),\n    customFields\n  };\n}"
  );
  s = s.replace(
    "export async function loadParticipantLookup(db: Db): Promise<Map<string, ParticipantDocument>> {\n  const rows = await db.collection<ParticipantDocument>(\"participants\").find({ active: true }).toArray();",
    "export async function loadParticipantLookup(db: Db, shopId: string): Promise<Map<string, ParticipantDocument>> {\n  const rows = await db.collection<ParticipantDocument>(\"participants\").find({ shopId, active: true }).toArray();"
  );
  s = s.replace(
    "export async function persistNewDropdownOptions(\n  db: Db,\n  fields: FieldDefinitionView[],\n  rows: ParticipantWrite[]\n): Promise<void> {\n  const now = new Date();\n  for (const field of fields) {\n    if (field.type !== \"dropdown\" || field.lockedOptions) continue;\n    const seen = new Set(field.options.map((option) => option.toLowerCase()));\n    const additions: string[] = [];\n    for (const row of rows) {\n      const value = getRecordValue(row, field).trim();\n      if (!value || seen.has(value.toLowerCase())) continue;\n      seen.add(value.toLowerCase());\n      additions.push(value);\n    }\n    if (!additions.length) continue;\n    await db.collection<FieldDefinitionDocument>(\"fieldDefinitions\").updateOne(\n      { key: field.key },",
    "export async function persistNewDropdownOptions(\n  db: Db,\n  shopId: string,\n  fields: FieldDefinitionView[],\n  rows: ParticipantWrite[]\n): Promise<void> {\n  const now = new Date();\n  for (const field of fields) {\n    if (field.type !== \"dropdown\" || field.lockedOptions) continue;\n    const seen = new Set(field.options.map((option) => option.toLowerCase()));\n    const additions: string[] = [];\n    for (const row of rows) {\n      const value = getRecordValue(row, field).trim();\n      if (!value || seen.has(value.toLowerCase())) continue;\n      seen.add(value.toLowerCase());\n      additions.push(value);\n    }\n    if (!additions.length) continue;\n    await db.collection<FieldDefinitionDocument>(\"fieldDefinitions\").updateOne(\n      { shopId, key: field.key },"
  );
  s = s.replace(
    "export async function nextFieldOrder(db: Db): Promise<number> {\n  const last = await db\n    .collection<FieldDefinitionDocument>(\"fieldDefinitions\")\n    .find({})\n    .sort({ order: -1 })\n    .limit(1)\n    .next();",
  "export async function nextFieldOrder(db: Db, shopId: string): Promise<number> {\n  const last = await db\n    .collection<FieldDefinitionDocument>(\"fieldDefinitions\")\n    .find({ shopId })\n    .sort({ order: -1 })\n    .limit(1)\n    .next();"
  );
  fs.writeFileSync(path.join(dir, "fields.ts"), s);
  console.log("fields.ts ok");
}

function adaptParticipants() {
  let s = fs.readFileSync(path.join(dir, "participants.ts"), "utf8");
  s = s.replace(
    "export async function findApprovedParticipant(\n  db: Db,\n  companyId: string,\n  stakeholderGroup: StakeholderGroup,\n  organizationalName?: string\n): Promise<ParticipantDocument | null> {\n  const rows = await db.collection<ParticipantDocument>(\"participants\").find({\n    companyId: normalizeCompanyId(companyId),\n    stakeholderGroup,\n    active: true\n  }).toArray();",
    "export async function findApprovedParticipant(\n  db: Db,\n  shopId: string,\n  companyId: string,\n  stakeholderGroup: StakeholderGroup,\n  organizationalName?: string\n): Promise<ParticipantDocument | null> {\n  const rows = await db.collection<ParticipantDocument>(\"participants\").find({\n    shopId,\n    companyId: normalizeCompanyId(companyId),\n    stakeholderGroup,\n    active: true\n  }).toArray();"
  );
  s = s.replace(
    "export async function upsertParticipants(\n  db: Db,\n  rows: ParticipantWrite[],\n  options?: { presentKeys?: string[] }\n): Promise<{ upserted: number; updated: number }> {",
    "export async function upsertParticipants(\n  db: Db,\n  shopId: string,\n  rows: ParticipantWrite[],\n  options?: { presentKeys?: string[] }\n): Promise<{ upserted: number; updated: number }> {"
  );
  s = s.replace(
    "const setDoc: Record<string, unknown> = {\n      stakeholderGroup: row.stakeholderGroup,\n      companyId: row.companyId,\n      name: row.name,\n      active: true,\n      updatedAt: now\n    };",
    "const setDoc: Record<string, unknown> = {\n      shopId,\n      stakeholderGroup: row.stakeholderGroup,\n      companyId: row.companyId,\n      name: row.name,\n      active: true,\n      updatedAt: now\n    };"
  );
  s = s.replace(
    "const result = await db.collection<ParticipantDocument>(\"participants\").updateOne(\n      { companyId: row.companyId, name: row.name, stakeholderGroup: row.stakeholderGroup },",
    "const result = await db.collection<ParticipantDocument>(\"participants\").updateOne(\n      { shopId, companyId: row.companyId, name: row.name, stakeholderGroup: row.stakeholderGroup },"
  );
  s = s.replace(
    "rows.push(applyFieldValues(activeFields, values));",
    "rows.push(applyFieldValues(activeFields, values, \"\"));"
  );
  fs.writeFileSync(path.join(dir, "participants.ts"), s);
  console.log("participants.ts ok");
}

function adaptRoles() {
  let s = fs.readFileSync(path.join(dir, "roles.ts"), "utf8");
  s = s.replace(
    "export async function ensureSystemRoles(db: Db): Promise<void> {\n  if (!global.__systemRolesReady) {\n    global.__systemRolesReady = upsertSystemRoles(db);\n  }\n  await global.__systemRolesReady;\n}\n\nasync function upsertSystemRoles(db: Db): Promise<void> {\n  const now = new Date();\n  const roles = db.collection<RoleDocument>(\"roles\");\n  for (const role of DEFAULT_ROLES) {\n    const existing = await roles.findOne({ key: role.key });",
    "const roleReady = new Map<string, Promise<void>>();\n\nexport async function ensureSystemRoles(db: Db, shopId: string): Promise<void> {\n  if (!roleReady.has(shopId)) {\n    roleReady.set(shopId, upsertSystemRoles(db, shopId));\n  }\n  await roleReady.get(shopId);\n}\n\nasync function upsertSystemRoles(db: Db, shopId: string): Promise<void> {\n  const now = new Date();\n  const roles = db.collection<RoleDocument>(\"roles\");\n  for (const role of DEFAULT_ROLES) {\n    const existing = await roles.findOne({ shopId, key: role.key });"
  );
  s = s.replace(
    "await roles.updateOne(\n          { _id: existing._id },\n          {\n            $set: {\n              name: role.name,\n              description: role.description,\n              system: true,\n              pages: role.pages,\n              canManageRoster: role.canManageRoster,\n              canCreateStaff: role.canCreateStaff,\n              canRemoveUsers: role.canRemoveUsers,\n              updatedAt: now\n            }\n          }\n        );\n      } else {\n        await roles.updateOne(\n          { _id: existing._id },\n          { $set: { system: true, name: existing.name || role.name, updatedAt: now } }\n        );\n      }\n      continue;\n    }\n    await roles.insertOne({ ...role, createdAt: now, updatedAt: now });\n  }\n}\n\nexport async function listRoles(db: Db): Promise<RoleView[]> {\n  await ensureSystemRoles(db);\n  const roles = await db.collection<RoleDocument>(\"roles\").find({}).sort({ system: -1, name: 1 }).toArray();",
    "await roles.updateOne(\n          { _id: existing._id },\n          {\n            $set: {\n              shopId,\n              name: role.name,\n              description: role.description,\n              system: true,\n              pages: role.pages,\n              canManageRoster: role.canManageRoster,\n              canCreateStaff: role.canCreateStaff,\n              canRemoveUsers: role.canRemoveUsers,\n              updatedAt: now\n            }\n          }\n        );\n      } else {\n        await roles.updateOne(\n          { _id: existing._id },\n          { $set: { shopId, system: true, name: existing.name || role.name, updatedAt: now } }\n        );\n      }\n      continue;\n    }\n    await roles.insertOne({ ...role, shopId, createdAt: now, updatedAt: now });\n  }\n}\n\nexport async function listRoles(db: Db, shopId: string): Promise<RoleView[]> {\n  await ensureSystemRoles(db, shopId);\n  const roles = await db.collection<RoleDocument>(\"roles\").find({ shopId }).sort({ system: -1, name: 1 }).toArray();"
  );
  s = s.replace(
    "export async function getRoleByKey(db: Db, key: string): Promise<RoleDocument | null> {\n  await ensureSystemRoles(db);\n  return db.collection<RoleDocument>(\"roles\").findOne({ key });\n}",
    "export async function getRoleByKey(db: Db, shopId: string, key: string): Promise<RoleDocument | null> {\n  await ensureSystemRoles(db, shopId);\n  return db.collection<RoleDocument>(\"roles\").findOne({ shopId, key });\n}"
  );
  s = s.replace(
    "declare global {\n  // eslint-disable-next-line no-var\n  var __systemRolesReady: Promise<void> | undefined;\n}\n\n",
    ""
  );
  fs.writeFileSync(path.join(dir, "roles.ts"), s);
  console.log("roles.ts ok");
}

adaptFields();
adaptParticipants();
adaptRoles();
