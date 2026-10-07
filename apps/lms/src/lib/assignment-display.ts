import type { AssignmentStatus } from "@/lib/types";

export function formatAssignmentStatus(status: AssignmentStatus | string): string {
  switch (status) {
    case "NOT_STARTED":
      return "Not started";
    case "IN_PROGRESS":
      return "In progress";
    case "COMPLETED":
      return "Completed";
    default:
      return String(status).replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }
}

export function assignmentStatusBarWidth(status: AssignmentStatus | string): number {
  switch (status) {
    case "COMPLETED":
      return 100;
    case "IN_PROGRESS":
      return 50;
    default:
      return 0;
  }
}
