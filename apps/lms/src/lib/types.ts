import type { ObjectId } from "mongodb";

export type SystemRole = "ADMIN" | "COORDINATOR" | "LEARNER";
export type UserRole = string;
export type UserStatus = "INVITED" | "ACTIVE" | "INACTIVE";
export type StaffPage = "overview" | "participants" | "users" | "courses" | "reports" | "settings";
export type CourseType = "SCORM_12" | "MINDSMITH_LINK";
export type AssignmentStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
export type StakeholderGroup = "Business Partner" | "Facility";
export type FieldType = "text" | "dropdown";

/** @deprecated Prefer LearnerProfileDocument — kept for transitional helpers */
export type UserDocument = LearnerProfileDocument;

export interface FieldDefinitionDocument {
  _id?: ObjectId;
  shopId: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface LearnerProfileDocument {
  _id?: ObjectId;
  shopId: string;
  shopifyCustomerId?: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffProfileDocument {
  _id?: ObjectId;
  shopId: string;
  shopifyStaffId?: string;
  shopifyCustomerId?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  bootstrap?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParticipantDocument {
  _id?: ObjectId;
  shopId: string;
  stakeholderGroup: StakeholderGroup;
  companyId: string;
  name: string;
  belongsToBp: string;
  country: string;
  topic: string;
  nominatedProvider: string;
  customFields?: Record<string, string>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseDocument {
  _id?: ObjectId;
  shopId: string;
  title: string;
  description: string;
  type: CourseType;
  active: boolean;
  externalUrl?: string;
  launchPath?: string;
  originalFilename?: string;
  storagePrefix?: string;
  shopifyProductId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScormData {
  lessonLocation?: string;
  lessonStatus?: string;
  scoreRaw?: number;
  scoreMin?: number;
  scoreMax?: number;
  progressMeasure?: number;
  interactionCount?: number;
  activitySteps?: number;
  lastProgressBumpAt?: Date;
  suspendData?: string;
  totalTime?: string;
  sessionTime?: string;
  exit?: string;
}

export interface AssignmentDocument {
  _id?: ObjectId;
  shopId: string;
  userId: ObjectId;
  courseId: ObjectId;
  status: AssignmentStatus;
  progress: number;
  score?: number;
  scormData: ScormData;
  assignedAt: Date;
  lastActivityAt?: Date;
  completedAt?: Date;
  reminderSentAt?: Date;
  updatedAt: Date;
}

export interface RoleDocument {
  _id?: ObjectId;
  shopId: string;
  key: UserRole;
  name: string;
  description: string;
  system: boolean;
  pages: StaffPage[];
  canManageRoster: boolean;
  canCreateStaff: boolean;
  canRemoveUsers: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionPermissions {
  staff: boolean;
  manageRoster: boolean;
  manageCourses: boolean;
  manageUsers: boolean;
  createStaff: boolean;
  removeUsers: boolean;
  viewReports: boolean;
  manageSettings: boolean;
}

export interface LmsActor {
  shopId: string;
  customerId?: string;
  email?: string;
  staff: boolean;
  staffRole?: UserRole;
  learnerProfileId?: string;
  tags: string[];
  permissions: SessionPermissions;
}
