import type { Db } from "mongodb";
import type {
  FieldDefinitionDocument,
  FieldType,
  ParticipantDocument,
  StakeholderGroup,
  UserDocument
} from "@/lib/types";

export function normalizeCompanyId(value: string): string {
  return value.trim();
}

export function normalizeNominatedProvider(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "vectra") return "VECTRA";
  return trimmed;
}

export interface FieldDefinitionView {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
  system: boolean;
  lockedOptions: boolean;
  copyToUser: boolean;
  filterable: boolean;
  order: number;
}

export const SYSTEM_FIELD_KEYS = [
  "stakeholderGroup",
  "companyId",
  "name",
  "belongsToBp",
  "country",
  "topic",
  "nominatedProvider"
] as const;

export type SystemFieldKey = (typeof SYSTEM_FIELD_KEYS)[number];

const RESERVED_KEYS = new Set([
  ...SYSTEM_FIELD_KEYS,
  "_id",
  "id",
  "email",
  "role",
  "status",
  "firstName",
  "lastName",
  "passwordHash",
  "inviteTokenHash",
  "inviteExpiresAt",
  "resetTokenHash",
  "resetExpiresAt",
  "customFields",
  "active",
  "createdAt",
  "updatedAt",
  "entity",
  "facilityTraining",
  "progress",
  "score"
]);

const IDENTITY_KEYS = new Set(["stakeholderGroup", "companyId", "name"]);

export const SYSTEM_HEADER_ALIASES: Record<SystemFieldKey, string[]> = {
  stakeholderGroup: ["Stakeholder", "stakeholder", "Stakeholder Group"],
  companyId: ["ID", "Id", "Company ID", "companyId"],
  name: ["Name", "Facility Name", "Organization", "name"],
  belongsToBp: ["Belongs to BP", "Belongs to BP ", "belongsToBp", "Business Partner"],
  country: ["Country", "country"],
  topic: ["Topic", "topic"],
  nominatedProvider: ["Nominated Provider", "Provider", "nominatedProvider"]
};

const SYSTEM_SEEDS: Array<Omit<FieldDefinitionDocument, "_id" | "shopId" | "createdAt" | "updatedAt">> = [
  {
    key: "stakeholderGroup",
    label: "Stakeholder group",
    type: "dropdown",
    required: true,
    options: ["Facility", "Business Partner"],
    system: true,
    lockedOptions: true,
    copyToUser: true,
    filterable: true,
    order: 10
  },
  {
    key: "companyId",
    label: "Company ID",
    type: "text",
    required: true,
    options: [],
    system: true,
    lockedOptions: true,
    copyToUser: true,
    filterable: false,
    order: 20
  },
  {
    key: "name",
    label: "Organization name",
    type: "text",
    required: true,
    options: [],
    system: true,
    lockedOptions: true,
    copyToUser: true,
    filterable: false,
    order: 30
  },
  {
    key: "belongsToBp",
    label: "Belongs to BP",
    type: "dropdown",
    required: false,
    options: [],
    system: true,
    lockedOptions: false,
    copyToUser: true,
    filterable: true,
    order: 40
  },
  {
    key: "country",
    label: "Country",
    type: "dropdown",
    required: false,
    options: [],
    system: true,
    lockedOptions: false,
    copyToUser: true,
    filterable: true,
    order: 50
  },
  {
    key: "topic",
    label: "Topic",
    type: "dropdown",
    required: false,
    options: ["Freely Chosen Employment"],
    system: true,
    lockedOptions: false,
    copyToUser: true,
    filterable: true,
    order: 60
  },
  {
    key: "nominatedProvider",
    label: "Nominated provider",
    type: "dropdown",
    required: false,
    options: ["VECTRA"],
    system: true,
    lockedOptions: false,
    copyToUser: true,
    filterable: true,
    order: 70
  }
];

export function toFieldView(doc: FieldDefinitionDocument): FieldDefinitionView {
  return {
    id: doc._id!.toHexString(),
    key: doc.key,
    label: doc.label,
    type: doc.type,
    required: doc.required,
    options: doc.options || [],
    system: doc.system,
    lockedOptions: doc.lockedOptions,
    copyToUser: doc.copyToUser,
    filterable: doc.filterable,
    order: doc.order
  };
}

export function canToggleRequired(field: { key: string }): boolean {
  return !IDENTITY_KEYS.has(field.key);
}

export function isSystemFieldKey(key: string): key is SystemFieldKey {
  return (SYSTEM_FIELD_KEYS as readonly string[]).includes(key);
}

export function slugifyFieldKey(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return slug || "custom_field";
}

export function uniqueKey(base: string, existing: Set<string>): string {
  let key = base;
  let n = 2;
  while (RESERVED_KEYS.has(key) || existing.has(key)) {
    key = `${base}_${n}`;
    n += 1;
  }
  return key;
}

function parseStakeholder(value: string): StakeholderGroup | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "facility") return "Facility";
  if (normalized === "business partner" || normalized === "businesspartner") return "Business Partner";
  return null;
}

export function headerAliases(field: Pick<FieldDefinitionView, "key" | "label">): string[] {
  const aliases = isSystemFieldKey(field.key) ? [...SYSTEM_HEADER_ALIASES[field.key]] : [];
  aliases.push(field.label, field.key);
  return [...new Set(aliases.filter(Boolean))];
}

export function pickFromRow(row: Record<string, string>, names: string[]): string {
  const lookup = new Map(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value]));
  for (const name of names) {
    const value = lookup.get(name.trim().toLowerCase());
    if (value?.trim()) return value.trim();
  }
  return "";
}

export function rowHasColumn(records: Record<string, string>[], names: string[]): boolean {
  if (!records.length) return false;
  const keys = new Set(Object.keys(records[0]).map((key) => key.trim().toLowerCase()));
  return names.some((name) => keys.has(name.trim().toLowerCase()));
}

export function normalizeFieldValue(field: FieldDefinitionView, raw: string): string {
  const trimmed = raw.trim();
  if (field.key === "companyId") return normalizeCompanyId(trimmed);
  if (field.key === "nominatedProvider") return normalizeNominatedProvider(trimmed);
  if (field.key === "stakeholderGroup") return parseStakeholder(trimmed) || trimmed;
  if (!trimmed) return "";
  if (field.type === "dropdown" && field.options.length) {
    const match = field.options.find((option) => option.toLowerCase() === trimmed.toLowerCase());
    if (match) return match;
  }
  return trimmed;
}

export function defaultFieldValue(field: FieldDefinitionView): string {
  if (field.key === "stakeholderGroup") return "Facility";
  if (field.key === "topic") {
    return field.options.includes("Freely Chosen Employment")
      ? "Freely Chosen Employment"
      : field.options[0] || "";
  }
  if (field.key === "nominatedProvider") {
    return field.options.includes("VECTRA") ? "VECTRA" : field.options[0] || "VECTRA";
  }
  return "";
}

export function defaultFieldValues(fields: FieldDefinitionView[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, defaultFieldValue(field)]));
}

export function dropdownOptions(field: FieldDefinitionView, extraValues: string[] = []): string[] {
  return [...new Set([...field.options, ...extraValues.map((value) => value.trim()).filter(Boolean)])];
}

export function getRecordValue(
  record: { customFields?: Record<string, string>; entity?: string; name?: string } & object,
  field: Pick<FieldDefinitionView, "key">
): string {
  if (isSystemFieldKey(field.key)) {
    const rec = record as Record<string, unknown>;
    if (field.key === "name" && typeof rec.entity === "string" && rec.entity && rec.name == null) {
      return rec.entity;
    }
    const value = rec[field.key];
    return value == null ? "" : String(value);
  }
  return record.customFields?.[field.key] || "";
}

export function getUserFieldValue(
  user: { entity?: string; customFields?: Record<string, string> } & object,
  field: Pick<FieldDefinitionView, "key">
): string {
  if (field.key === "name") return String(user.entity || "");
  return getRecordValue(user, field);
}

export type ParticipantWrite = Omit<ParticipantDocument, "_id" | "createdAt" | "updatedAt" | "active">;

export function validateFieldValue(
  field: FieldDefinitionView,
  value: string,
  options?: { allowNewDropdownValues?: boolean }
): string | null {
  if (field.required && !value.trim()) {
    return `${field.label} is required.`;
  }
  if (!value.trim()) return null;
  if (field.key === "stakeholderGroup" && !parseStakeholder(value)) {
    return "Stakeholder group must be Facility or Business Partner.";
  }
  const allowNew = options?.allowNewDropdownValues && !field.lockedOptions;
  if (field.type === "dropdown" && field.options.length && !allowNew) {
    const allowed = field.options.some((option) => option.toLowerCase() === value.trim().toLowerCase());
    if (!allowed) {
      return `${field.label} must be one of: ${field.options.join(", ")}.`;
    }
  }
  return null;
}

export function applyFieldValues(
  fields: FieldDefinitionView[],
  values: Record<string, string>,
  shopId = ""
): ParticipantWrite {
  const customFields: Record<string, string> = {};
  const system: Partial<ParticipantWrite> = {};

  for (const field of fields) {
    const value = normalizeFieldValue(field, values[field.key] || "");
    if (isSystemFieldKey(field.key)) {
      (system as Record<string, string>)[field.key] = value;
    } else {
      customFields[field.key] = value;
    }
  }

  return {
    shopId,
    stakeholderGroup: (system.stakeholderGroup || "Facility") as StakeholderGroup,
    companyId: system.companyId || "",
    name: system.name || "",
    belongsToBp: system.belongsToBp || "",
    country: system.country || "",
    topic: system.topic || "",
    nominatedProvider: normalizeNominatedProvider(system.nominatedProvider || ""),
    customFields
  };
}

export function validateParticipantValues(
  fields: FieldDefinitionView[],
  values: Record<string, string>,
  shopId = ""
): { ok: true; data: ParticipantWrite } | { ok: false; error: string } {
  for (const field of fields) {
    const value = normalizeFieldValue(field, values[field.key] || "");
    const error = validateFieldValue(field, value);
    if (error) return { ok: false, error };
  }
  const data = applyFieldValues(fields, values, shopId);
  if (!data.companyId || !data.name || !data.stakeholderGroup) {
    return { ok: false, error: "Company ID, organization name, and stakeholder group are required." };
  }
  return { ok: true, data };
}

export function payloadValues(body: Record<string, unknown>, fields: FieldDefinitionView[]): Record<string, string> {
  const custom =
    body.customFields && typeof body.customFields === "object"
      ? (body.customFields as Record<string, unknown>)
      : {};
  const values: Record<string, string> = {};
  for (const field of fields) {
    const raw = body[field.key] ?? custom[field.key] ?? "";
    values[field.key] = String(raw ?? "");
  }
  return values;
}

export function valuesFromParticipant(item: ParticipantDocument, fields: FieldDefinitionView[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, getRecordValue(item, field)]));
}

export function toParticipantView(item: ParticipantDocument) {
  return {
    id: item._id!.toHexString(),
    stakeholderGroup: item.stakeholderGroup,
    companyId: item.companyId,
    name: item.name,
    belongsToBp: item.belongsToBp || "",
    country: item.country || "",
    topic: item.topic || "",
    nominatedProvider: normalizeNominatedProvider(item.nominatedProvider || ""),
    customFields: item.customFields || {}
  };
}

export type ParticipantView = ReturnType<typeof toParticipantView>;

export function rosterFieldsForUser(participant: ParticipantDocument): Pick<
  UserDocument,
  "companyId" | "stakeholderGroup" | "belongsToBp" | "country" | "topic" | "nominatedProvider" | "customFields"
> {
  return {
    companyId: participant.companyId,
    stakeholderGroup: participant.stakeholderGroup,
    belongsToBp: participant.belongsToBp,
    country: participant.country,
    topic: participant.topic,
    nominatedProvider: normalizeNominatedProvider(participant.nominatedProvider || ""),
    customFields: participant.customFields || {}
  };
}

export async function listFieldDefinitions(db: Db, shopId: string): Promise<FieldDefinitionView[]> {
  await ensureFieldDefinitions(db, shopId);
  const docs = await db
    .collection<FieldDefinitionDocument>("fieldDefinitions")
    .find({ shopId })
    .sort({ order: 1, label: 1 })
    .toArray();
  return docs.filter((doc) => doc._id).map(toFieldView);
}

export async function listFieldDefinitionsForData(db: Db, shopId: string): Promise<FieldDefinitionView[]> {
  const fields = await listFieldDefinitions(db, shopId);
  const observed = await observedFieldValues(db, shopId, fields);
  return fields.map((field) =>
    field.type === "dropdown" && !field.lockedOptions
      ? { ...field, options: dropdownOptions(field, observed[field.key] || []) }
      : field
  );
}

async function observedFieldValues(
  db: Db,
  shopId: string,
  fields: FieldDefinitionView[]
): Promise<Record<string, string[]>> {
  const projection: Record<string, 1> = { customFields: 1 };
  for (const key of SYSTEM_FIELD_KEYS) projection[key] = 1;
  const rows = await db
    .collection<ParticipantDocument>("participants")
    .find({ shopId, active: true })
    .project(projection)
    .toArray();
  const observed: Record<string, string[]> = {};
  for (const field of fields) {
    observed[field.key] = uniqueSorted(rows.map((row) => getRecordValue(row, field)));
  }
  return observed;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

async function harvestDropdownOptions(db: Db, shopId: string, key: SystemFieldKey): Promise<string[]> {
  const rows = await db
    .collection<ParticipantDocument>("participants")
    .find({ shopId, active: true })
    .project({ [key]: 1 })
    .toArray();
  return [...new Set(rows.map((row) => String((row as Record<string, unknown>)[key] || "").trim()).filter(Boolean))].sort();
}

export async function ensureFieldDefinitions(db: Db, shopId: string): Promise<void> {
  const collection = db.collection<FieldDefinitionDocument>("fieldDefinitions");
  const now = new Date();

  for (const seed of SYSTEM_SEEDS) {
    const existing = await collection.findOne({ shopId, key: seed.key });
    if (!existing) {
      const options =
        seed.type === "dropdown" && !seed.lockedOptions
          ? [...new Set([...seed.options, ...(await harvestDropdownOptions(db, shopId, seed.key as SystemFieldKey))])].sort()
          : seed.options;
      await collection.insertOne({
        ...seed,
        shopId,
        options,
        createdAt: now,
        updatedAt: now
      });
      continue;
    }
    if (existing.type === "dropdown" && !existing.lockedOptions && !(existing.options || []).length) {
      const harvested = await harvestDropdownOptions(db, shopId, seed.key as SystemFieldKey);
      if (harvested.length) {
        await collection.updateOne(
          { _id: existing._id },
          { $set: { options: harvested, updatedAt: now } }
        );
      }
    }
  }
}

export function overlayRosterOnUser<T extends {
  entity?: string;
  companyId?: string;
  stakeholderGroup?: string;
  belongsToBp?: string;
  country?: string;
  topic?: string;
  nominatedProvider?: string;
  customFields?: Record<string, string>;
}>(user: T, participant: ParticipantDocument | null | undefined): T {
  if (!participant) return user;
  const roster = rosterFieldsForUser(participant);
  return {
    ...user,
    companyId: roster.companyId,
    stakeholderGroup: roster.stakeholderGroup,
    belongsToBp: roster.belongsToBp,
    country: roster.country,
    topic: roster.topic,
    nominatedProvider: roster.nominatedProvider,
    customFields: { ...(user.customFields || {}), ...(roster.customFields || {}) }
  };
}

export function participantLookupKey(companyId?: string, stakeholderGroup?: string, name?: string): string {
  return `${companyId || ""}|${stakeholderGroup || ""}|${name || ""}`.trim().toLowerCase();
}

export async function loadParticipantLookup(db: Db, shopId: string): Promise<Map<string, ParticipantDocument>> {
  const rows = await db.collection<ParticipantDocument>("participants").find({ shopId, active: true }).toArray();
  const map = new Map<string, ParticipantDocument>();
  for (const row of rows) {
    map.set(participantLookupKey(row.companyId, row.stakeholderGroup, row.name), row);
  }
  return map;
}

export async function persistNewDropdownOptions(
  db: Db,
  shopId: string,
  fields: FieldDefinitionView[],
  rows: ParticipantWrite[]
): Promise<void> {
  const now = new Date();
  for (const field of fields) {
    if (field.type !== "dropdown" || field.lockedOptions) continue;
    const seen = new Set(field.options.map((option) => option.toLowerCase()));
    const additions: string[] = [];
    for (const row of rows) {
      const value = getRecordValue(row, field).trim();
      if (!value || seen.has(value.toLowerCase())) continue;
      seen.add(value.toLowerCase());
      additions.push(value);
    }
    if (!additions.length) continue;
    await db.collection<FieldDefinitionDocument>("fieldDefinitions").updateOne(
      { shopId, key: field.key },
      { $addToSet: { options: { $each: additions } }, $set: { updatedAt: now } }
    );
  }
}

export async function nextFieldOrder(db: Db, shopId: string): Promise<number> {
  const last = await db
    .collection<FieldDefinitionDocument>("fieldDefinitions")
    .find({ shopId })
    .sort({ order: -1 })
    .limit(1)
    .next();
  return (last?.order || 0) + 10;
}
