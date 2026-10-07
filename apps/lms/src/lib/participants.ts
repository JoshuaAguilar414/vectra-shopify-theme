import { parse } from "csv-parse/sync";
import type { Db } from "mongodb";
import {
  applyFieldValues,
  defaultFieldValue,
  headerAliases,
  normalizeCompanyId,
  normalizeFieldValue,
  pickFromRow,
  rowHasColumn,
  validateFieldValue,
  type FieldDefinitionView,
  type ParticipantWrite
} from "@/lib/fields";
import type { ParticipantDocument, StakeholderGroup } from "@/lib/types";

export { normalizeCompanyId, normalizeNominatedProvider } from "@/lib/fields";

export type ParticipantParseResult = {
  rows: ParticipantWrite[];
  errors: string[];
  missingColumns: string[];
  presentKeys: string[];
};

export function parseParticipantCsv(
  text: string,
  fields?: FieldDefinitionView[]
): Array<Omit<ParticipantDocument, "_id" | "createdAt" | "updatedAt" | "active">> {
  const records = parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true }) as Record<string, string>[];
  return parseParticipantRows(records, fields).rows;
}

export function parseParticipantRows(
  records: Record<string, string>[],
  fields?: FieldDefinitionView[],
  options?: { allowNewDropdownValues?: boolean }
): ParticipantParseResult {
  const activeFields = fields?.length ? fields : fallbackSystemFields();
  const missingColumns = activeFields
    .filter((field) => field.required && !rowHasColumn(records, headerAliases(field)))
    .map((field) => field.label);

  const presentKeys = activeFields
    .filter((field) => rowHasColumn(records, headerAliases(field)))
    .map((field) => field.key);

  const rows: ParticipantWrite[] = [];
  const errors: string[] = [];

  if (missingColumns.length) {
    return {
      rows: [],
      errors: [`Missing required column(s): ${missingColumns.join(", ")}.`],
      missingColumns,
      presentKeys
    };
  }

  for (const [index, row] of records.entries()) {
    const values: Record<string, string> = {};
    for (const field of activeFields) {
      const raw = pickFromRow(row, headerAliases(field));
      if (raw) {
        values[field.key] = normalizeFieldValue(field, raw);
      } else if (!field.required && (field.key === "topic" || field.key === "nominatedProvider")) {
        values[field.key] = defaultFieldValue(field);
      } else {
        values[field.key] = "";
      }
    }

    const rowErrors: string[] = [];
    for (const field of activeFields) {
      const error = validateFieldValue(field, values[field.key] || "", options);
      if (error) rowErrors.push(error);
    }

    const stakeholder = values.stakeholderGroup;
    if (!stakeholder || (stakeholder !== "Facility" && stakeholder !== "Business Partner")) {
      if (!rowErrors.some((item) => item.toLowerCase().includes("stakeholder"))) {
        rowErrors.push("Stakeholder group must be Facility or Business Partner.");
      }
    }

    if (rowErrors.length) {
      const name = values.name || values.companyId || `row ${index + 2}`;
      errors.push(`Row ${index + 2} (${name}): ${rowErrors.join(" ")}`);
      continue;
    }

    rows.push(applyFieldValues(activeFields, values, ""));
  }

  return { rows, errors, missingColumns, presentKeys };
}

export async function findApprovedParticipant(
  db: Db,
  shopId: string,
  companyId: string,
  stakeholderGroup: StakeholderGroup,
  organizationalName?: string
): Promise<ParticipantDocument | null> {
  const rows = await db.collection<ParticipantDocument>("participants").find({
    shopId,
    companyId: normalizeCompanyId(companyId),
    stakeholderGroup,
    active: true
  }).toArray();
  if (!rows.length) return null;
  const needle = organizationalName?.trim().toLowerCase();
  if (!needle) return rows[0];
  return rows.find((row) => row.name.trim().toLowerCase() === needle) || null;
}

export async function upsertParticipants(
  db: Db,
  shopId: string,
  rows: ParticipantWrite[],
  options?: { presentKeys?: string[] }
): Promise<{ upserted: number; updated: number }> {
  const now = new Date();
  let upserted = 0;
  let updated = 0;
  const present = options?.presentKeys ? new Set(options.presentKeys) : null;
  for (const row of rows) {
    const setDoc: Record<string, unknown> = {
      shopId,
      stakeholderGroup: row.stakeholderGroup,
      companyId: row.companyId,
      name: row.name,
      active: true,
      updatedAt: now
    };
    const optionalSystem = ["belongsToBp", "country", "topic", "nominatedProvider"] as const;
    for (const key of optionalSystem) {
      if (!present || present.has(key)) setDoc[key] = row[key];
    }
    const customFields = row.customFields || {};
    if (!present) {
      setDoc.customFields = customFields;
    } else {
      for (const [key, value] of Object.entries(customFields)) {
        if (present.has(key)) setDoc[`customFields.${key}`] = value;
      }
    }
    const setOnInsert: Record<string, unknown> = { createdAt: now };
    if (present) {
      if (!present.has("topic")) setOnInsert.topic = "Freely Chosen Employment";
      if (!present.has("nominatedProvider")) setOnInsert.nominatedProvider = "VECTRA";
    }
    const result = await db.collection<ParticipantDocument>("participants").updateOne(
      { shopId, companyId: row.companyId, name: row.name, stakeholderGroup: row.stakeholderGroup },
      {
        $set: setDoc,
        $setOnInsert: setOnInsert
      },
      { upsert: true }
    );
    if (result.upsertedCount) upserted += 1;
    else if (result.modifiedCount) updated += 1;
  }
  return { upserted, updated };
}

function fallbackSystemFields(): FieldDefinitionView[] {
  return [
    { id: "stakeholderGroup", key: "stakeholderGroup", label: "Stakeholder group", type: "dropdown", required: true, options: ["Facility", "Business Partner"], system: true, lockedOptions: true, copyToUser: true, filterable: true, order: 10 },
    { id: "companyId", key: "companyId", label: "Company ID", type: "text", required: true, options: [], system: true, lockedOptions: true, copyToUser: true, filterable: false, order: 20 },
    { id: "name", key: "name", label: "Organization name", type: "text", required: true, options: [], system: true, lockedOptions: true, copyToUser: true, filterable: false, order: 30 },
    { id: "belongsToBp", key: "belongsToBp", label: "Belongs to BP", type: "dropdown", required: false, options: [], system: true, lockedOptions: false, copyToUser: true, filterable: true, order: 40 },
    { id: "country", key: "country", label: "Country", type: "dropdown", required: false, options: [], system: true, lockedOptions: false, copyToUser: true, filterable: true, order: 50 },
    { id: "topic", key: "topic", label: "Topic", type: "dropdown", required: false, options: ["Freely Chosen Employment"], system: true, lockedOptions: false, copyToUser: true, filterable: true, order: 60 },
    { id: "nominatedProvider", key: "nominatedProvider", label: "Nominated provider", type: "dropdown", required: false, options: ["VECTRA"], system: true, lockedOptions: false, copyToUser: true, filterable: true, order: 70 }
  ];
}
