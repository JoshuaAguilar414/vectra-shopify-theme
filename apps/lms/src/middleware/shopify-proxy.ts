import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { getShopDb } from "@/db";
import { getRoleByKey } from "@/lib/roles";
import type { LmsActor, SessionPermissions, StaffProfileDocument } from "@/lib/types";
import { linkCustomerToLearner } from "@/lib/learners";

declare global {
  namespace Express {
    interface Request {
      lms?: LmsActor;
    }
  }
}

const STAFF_TAGS = new Set(["lms-admin", "lms-coordinator"]);

function emptyPermissions(staff = false): SessionPermissions {
  return {
    staff,
    manageRoster: staff,
    manageCourses: staff,
    manageUsers: staff,
    createStaff: staff,
    removeUsers: staff,
    viewReports: staff,
    manageSettings: staff
  };
}

/** Verify Shopify app proxy signature (query string HMAC-SHA256). */
export function verifyShopifyProxySignature(query: Record<string, unknown>, secret: string): boolean {
  const signature = String(query.signature || "");
  if (!signature || !secret) return false;

  const message = Object.keys(query)
    .filter((key) => key !== "signature" && key !== "hmac")
    .sort()
    .map((key) => {
      const value = query[key];
      return `${key}=${Array.isArray(value) ? value.join(",") : String(value)}`;
    })
    .join("");

  const digest = crypto.createHmac("sha256", secret).update(message).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(signature, "utf8"));
  } catch {
    return false;
  }
}

function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

export async function resolveProxyActor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const bypass = process.env.LMS_DEV_BYPASS === "true";
    const secret = process.env.SHOPIFY_API_SECRET || "";
    const query = req.query as Record<string, unknown>;

    let shopId = String(query.shop || req.headers["x-lms-shop"] || "").trim().toLowerCase();
    let customerId = String(query.logged_in_customer_id || req.headers["x-lms-customer-id"] || "").trim();
    let tags = parseTags(String(req.headers["x-lms-customer-tags"] || ""));
    let staffBypass = String(req.headers["x-lms-staff"] || "").toLowerCase() === "true";

    const signatureOk = secret ? verifyShopifyProxySignature(query, secret) : false;

    if (!signatureOk) {
      if (!bypass) {
        res.status(401).json({ error: "Invalid app proxy signature" });
        return;
      }
      if (!shopId) shopId = (process.env.LMS_DEV_SHOP || "dev.myshopify.com").toLowerCase();
    } else {
      // Signed proxy: do not trust client staff header unless also tagged
      staffBypass = false;
    }

    if (!shopId) {
      res.status(400).json({ error: "Missing shop" });
      return;
    }

    const db = await getShopDb(shopId);
    let staff = false;
    let staffRole: string | undefined;
    let permissions = emptyPermissions(false);
    let learnerProfileId: string | undefined;
    let email: string | undefined;

    if (customerId) {
      const staffProfile = await db.collection<StaffProfileDocument>("staffProfiles").findOne({
        shopId,
        shopifyCustomerId: customerId
      });
      if (staffProfile) {
        staff = true;
        staffRole = staffProfile.role;
        email = staffProfile.email;
        const role = await getRoleByKey(db, shopId, staffProfile.role);
        permissions = {
          staff: true,
          manageRoster: Boolean(role?.canManageRoster || staffProfile.role === "ADMIN"),
          manageCourses: true,
          manageUsers: true,
          createStaff: Boolean(role?.canCreateStaff || staffProfile.role === "ADMIN"),
          removeUsers: Boolean(role?.canRemoveUsers || staffProfile.role === "ADMIN"),
          viewReports: true,
          manageSettings: staffProfile.role === "ADMIN" || Boolean(role?.pages?.includes("settings"))
        };
      }

      const tagStaff = tags.some((tag) => STAFF_TAGS.has(tag));
      if (!staff && (tagStaff || (bypass && staffBypass))) {
        staff = true;
        staffRole = tags.includes("lms-admin") ? "ADMIN" : "COORDINATOR";
        permissions = emptyPermissions(true);
        if (staffRole === "ADMIN") {
          permissions.createStaff = true;
          permissions.removeUsers = true;
          permissions.manageRoster = true;
          permissions.manageSettings = true;
        } else {
          permissions.manageRoster = false;
          permissions.createStaff = false;
          permissions.removeUsers = false;
          permissions.manageSettings = false;
        }
      }

      const learner = await linkCustomerToLearner(db, shopId, customerId, email);
      if (learner?._id) {
        learnerProfileId = learner._id.toHexString();
        email = email || learner.email;
      }
    } else if (bypass && staffBypass) {
      staff = true;
      staffRole = "ADMIN";
      permissions = emptyPermissions(true);
    }

    req.lms = {
      shopId,
      customerId: customerId || undefined,
      email,
      staff,
      staffRole,
      learnerProfileId,
      tags,
      permissions
    };
    next();
  } catch (error) {
    console.error("resolveProxyActor failed", error);
    res.status(500).json({ error: "Auth resolution failed" });
  }
}

export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  if (!req.lms?.staff) {
    res.status(403).json({ error: "Staff access required (lms-admin / lms-coordinator)" });
    return;
  }
  next();
}

export function requireLearner(req: Request, res: Response, next: NextFunction): void {
  if (!req.lms?.learnerProfileId && !req.lms?.staff) {
    res.status(403).json({ error: "Learner profile required" });
    return;
  }
  next();
}

export function requireRosterAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.lms?.staff || !req.lms.permissions.manageRoster) {
    res.status(403).json({ error: "Only administrators can manage the participant roster." });
    return;
  }
  next();
}
