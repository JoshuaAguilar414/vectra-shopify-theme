import type { StaffPage, UserRole } from "@/lib/types";

export const STAFF_PAGES: Array<{ key: StaffPage; label: string; href: string; hint: string }> = [
  { key: "overview", label: "Overview", href: "/admin", hint: "Training dashboard and program stats" },
  { key: "participants", label: "Participants", href: "/admin/participants", hint: "Approved organization roster" },
  { key: "users", label: "Users", href: "/admin/users", hint: "Learners, invites, and account status" },
  { key: "courses", label: "Courses", href: "/admin/courses", hint: "Upload, edit, and assign courses" },
  { key: "reports", label: "Reports", href: "/admin/reports", hint: "Progress tables and CSV export" },
  { key: "settings", label: "Settings", href: "/admin/settings", hint: "Field definitions and user groups" }
];

export const SYSTEM_ROLE_KEYS = ["ADMIN", "COORDINATOR", "LEARNER"] as const;

export type RoleView = {
  id: string;
  key: UserRole;
  name: string;
  description: string;
  system: boolean;
  pages: StaffPage[];
  canManageRoster: boolean;
  canCreateStaff: boolean;
  canRemoveUsers: boolean;
};

export function isSystemRoleKey(key: string): boolean {
  return (SYSTEM_ROLE_KEYS as readonly string[]).includes(key);
}

export function isLearnerRole(key: string): boolean {
  return key === "LEARNER";
}

export function slugRoleKey(name: string): string {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return slug || "ROLE";
}
