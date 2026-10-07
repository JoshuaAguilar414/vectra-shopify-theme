# VECTRA Shopify LMS — Features & Capabilities

**Product:** VECTRA Academy Learning Management System (Shopify edition)  
**Parity source:** Current LMS in this repo (`docs/Features-and-Capabilities.md`, `app/`, `lib/`)  
**Auth:** Out of scope — documented only as Shopify Customer Accounts lifecycle  

See also: [Shopify-LMS-Overview.md](./Shopify-LMS-Overview.md) · [Shopify-LMS-Architecture.md](./Shopify-LMS-Architecture.md) · [Shopify-LMS-Data-Model.md](./Shopify-LMS-Data-Model.md)

---

## 1. Executive summary

VECTRA Shopify LMS delivers SCORM 1.2 training to Facility and Business Partner learners, tracks progress and completion, and gives staff tools to manage rosters, users, courses, assignments, and compliance reporting.

Identity is Shopify Customer Accounts. All learning operations run in a custom embedded Shopify app with learner surfaces exposed through the Online Store theme and App Proxy.

Enrollment v1 is free admin assignment (no checkout required).

---

## 2. User roles & permissions

### LMS roles (app-managed)

| Role | Access |
|------|--------|
| **Learner** | Dashboard, assigned courses, SCORM player, profile (display name) |
| **Coordinator** | Staff screens allowed by role pages; roster read-only by default; cannot create staff or remove users |
| **Admin** | Full LMS control: roster write, staff creation, user removal, settings, all coordinator capabilities |
| **Custom roles** | Configurable pages + capability flags (same model as current `roles` collection) |

### Staff pages

| Page key | Screen |
|----------|--------|
| `overview` | Admin overview |
| `participants` | Participant roster |
| `users` | Learners & staff |
| `courses` | Courses & assignments |
| `reports` | Progress reports |
| `settings` | Field definitions & roles |

### Capability flags

| Flag | Meaning |
|------|---------|
| `canManageRoster` | Create / edit / import / bulk-delete participants |
| `canCreateStaff` | Create Coordinator / Admin / custom staff roles |
| `canRemoveUsers` | Single and bulk user delete |
| Derived | `manageCourses`, `manageUsers`, `viewReports`, `manageSettings`, `staff` |

ADMIN and LEARNER page sets remain system-locked. COORDINATOR and custom roles are editable in Settings.

### Stakeholder groups (learners)

- **Facility** — organization linked to a facility training site  
- **Business Partner** — company-level participation on the VECTRA roster  

Registration / invitation gating (when used) requires Company ID + stakeholder group matching the approved participant roster.

### Shopify staff vs LMS roles

| Layer | Purpose |
|-------|---------|
| Shopify staff permissions | Who can open the embedded app in Admin |
| LMS role document | Which LMS pages and capabilities that person has inside the app |

A Shopify staff user must still map to an LMS staff profile with an LMS role.

---

## 3. Authentication & account lifecycle (Shopify only)

The LMS app does **not** implement login, password hashing, activation tokens, or reset tokens.

| Lifecycle step | Owner | LMS app responsibility |
|----------------|-------|------------------------|
| Customer invite / activation | Shopify | Create/link `learnerProfiles` when staff invites a learner |
| Login / logout / session | Shopify | Accept authenticated customer at App Proxy |
| Password recovery | Shopify | None |
| Account status | App + Shopify | App stores `INVITED` / `ACTIVE` / `INACTIVE` for LMS gating; deactivate blocks learner surfaces even if Customer exists |
| Resend invite | Shopify + app | Staff action triggers Shopify customer invite / notification path and refreshes LMS invite state |
| Bootstrap admins | App install / env | Seed LMS Admin profiles for designated staff emails |

### Email split

| Email type | Owner |
|------------|-------|
| Account invite / activation / password reset | Shopify |
| Assignment not-started reminders | LMS app ESP (Brevo / Resend / SendGrid / SMTP) |

---

## 4. Participant roster (approved organizations)

Source of truth for which organizations and Company IDs may be invited or validated.

| Feature | Admin | Coordinator |
|---------|-------|-------------|
| View roster | Yes | Yes (read-only unless role grants write) |
| Add organization | Yes | No (default) |
| Edit organization | Yes | No |
| Remove organization | Yes | No |
| Import CSV / XLSX | Yes | No |
| Bulk remove selected | Yes | No |

### Roster fields

| Field | Description |
|-------|-------------|
| Stakeholder group | Facility or Business Partner |
| Company ID | Identifier used at invite / validation |
| Organization name | Official name on the roster |
| Belongs to BP | Business partner affiliation |
| Country | Organization country |
| Topic | Training topic (e.g. Freely Chosen Employment) |
| Nominated provider | Training provider (normalize VECTRA uppercase) |
| Custom fields | From Settings field definitions |

### Import

- **CSV** and **XLSX** (first worksheet)
- Required headers (parity): `Stakeholder`, `ID`, `Name`, `Belongs to BP`, `Country`, `Topic`, `Nominated Provider`
- Dynamic columns for configured custom fields

### List UX

- Search (company ID, name, country, …)
- Filter by stakeholder group, country, and filterable custom fields
- Pagination (10 / 25 / 50)
- Summary: total orgs, facilities, business partners

### Public helper

- Company ID + stakeholder group lookup for roster validation (equivalent of `GET /api/facilities`)

---

## 5. User management (learners & staff)

| Feature | Admin | Coordinator |
|---------|-------|-------------|
| Create & invite learner | Yes | Yes |
| Create staff | Yes | No |
| Import learners (CSV / XLSX) | Yes | Yes |
| Edit learner profile fields | Yes | Learners only (default) |
| Activate / deactivate | Yes | Learners only |
| Resend invite | Yes | Yes (learners) |
| Remove user (single) | Yes | No |
| Bulk remove selected | Yes | No |

### Learner invite / create flow (Shopify edition)

1. Staff enters name, corporate email, Company ID, stakeholder group, organization name.
2. App validates against participant roster.
3. App creates or links Shopify Customer.
4. App creates `learnerProfiles` row (`INVITED` or `ACTIVE`).
5. Shopify sends customer account invite (auth out of LMS scope).
6. Optional: auto-assign topic-matching active SCORM course.

### Learner import

Required headers (parity): `First Name`, `Last Name`, `Corporate Email`, `Company ID`, `Stakeholder Group`, `Organizational Name`

- Company ID + stakeholder group must match roster
- Invalid rows skipped; return error summary (up to 20 errors)

### User list UX

- Search: name, email, company ID, entity, role, status
- Filters: status, role, roster-derived fields
- Assigned-courses column
- Pagination + multi-page bulk selection
- Protections: cannot delete self; cannot delete bootstrap admins; unique email

### Statuses

| Status | Meaning |
|--------|---------|
| `INVITED` | Profile created; waiting for customer account activation |
| `ACTIVE` | Can use learner LMS surfaces |
| `INACTIVE` | Blocked from learner LMS surfaces |

---

## 6. Course management

| Feature | Description |
|---------|-------------|
| Upload SCORM 1.2 ZIP | Title + description + package |
| Edit course | Update title / description / active flag |
| Replace SCORM package | New ZIP on existing course |
| Remove course | Deletes course and cascades assignments |
| Course types | `SCORM_12` primary; `MINDSMITH_LINK` reserved (not operational path) |

### SCORM package handling

- ZIP extract + `imsmanifest` launch path detection
- Same-origin content serving through LMS API / App Proxy
- Storage: Cloudflare R2 (production); local disk for development
- Max upload size configurable (e.g. 100–500 MB)

### Supported SCORM capabilities

| Capability | Supported |
|------------|-----------|
| ZIP upload & manifest launch | Yes |
| Lesson status / completion | Yes |
| Score tracking | Yes |
| Bookmark / suspend data / resume | Yes |
| Progress percentage | Yes |
| SCORM 2004 sequencing | No |

**Authoring path:** Mindsmith (or similar) → export **SCORM 1.2 ZIP** → upload in Courses.

### Optional Shopify Product link

A course may store an optional Shopify Product GID / handle for catalog visibility. v1 enrollment does **not** require purchase.

---

## 7. Course assignment

| Feature | Description |
|---------|-------------|
| Single assign | One course → one learner |
| Unassign | Remove assignment |
| Bulk assign | By selected users, company ID, country, stakeholder group, or all active/invited learners |
| Auto-assign on invite/register | Active SCORM course whose title/description matches learner **topic** |

### Assignment statuses

| Status | Meaning |
|--------|---------|
| `NOT_STARTED` | Assigned, not launched |
| `IN_PROGRESS` | Started; progress saved |
| `COMPLETED` | Finished per SCORM completion rules |

Stored per assignment: progress %, score, SCORM data blob, assigned / last activity / completed / reminder timestamps.

---

## 8. Learner experience

### Dashboard

- Counts: assigned / in progress / completed
- Progress summary
- Link to My Courses

### My Courses

- Assigned courses with status badges and progress
- Actions: **Start course**, **Continue course**, **Review course**

### SCORM player

- In-browser SCORM 1.2 runtime
- LMS API bridge: Initialize, GetValue, SetValue, Commit, Finish
- Auto-save on commit and exit
- Resume from bookmark / suspend data
- Mindsmith `postMessage` progress bridge support
- Status transitions: Not Started → In Progress → Completed

### Profile

- Edit display name
- Read-only: email, entity, company ID, stakeholder group, LMS role
- Password / email changes: Shopify account settings (not LMS)

---

## 9. Reporting & analytics

### Progress reports

| Column | Description |
|--------|-------------|
| Learner name | Full name |
| Email | Corporate email |
| Entity | Organization |
| Country | Learner country |
| Topic (+ dynamic fields) | From profile / field definitions |
| Course | Course title |
| Status | Not Started / In Progress / Completed |
| Progress | Percentage |
| Score | When available |
| Last activity | Last progress save |
| Completed at | Completion timestamp |

### Report features

- Filter by status, course, country, and filterable fields
- Search across name, email, entity, course
- Pagination
- **CSV export** matching current filters

### Admin overview stats

- Approved organizations
- Learners by invited / active / inactive
- Courses count
- Completion by period (all / week / month / year)

---

## 10. Settings

### Field definitions

| Property | Description |
|----------|-------------|
| key / label | Stable key + display label |
| type | `text` or `dropdown` |
| required / options / order | Validation and UI |
| system / lockedOptions | System identity fields locked |
| copyToUser | Copy roster value onto learner profile |
| filterable | Available in list filters and reports |

Locked system identity fields (parity): `stakeholderGroup`, `companyId`, `name`.

### User groups (roles)

- CRUD custom roles
- Edit pages and capability flags
- System ADMIN / LEARNER locked

---

## 11. Reminders

| Feature | Description |
|---------|-------------|
| Scheduled job | Daily (or configured) reminder runner |
| Target | `NOT_STARTED` assignments older than `REMINDER_DAYS` (default 3) |
| Once-only | Tracked via `reminderSentAt` |
| Delivery | App ESP email with VECTRA product branding |
| Security | Shared secret / authenticated cron endpoint |

Auth-related emails are not sent by this job.

---

## 12. Branding & UI

| Surface | Branding approach |
|---------|-------------------|
| Online Store | VECTRA theme: logo, colors, fonts, footer |
| Embedded admin | App chrome using VECTRA product name |
| Reminder email | `LMS_PRODUCT_NAME` / mail-from name |
| Multi-client skins later | Theme presets or separate shops; shared app backend |

Default product copy: **VECTRA Academy** / **VECTRA International** / vendor VECTRA.

---

## 13. Admin & learner screen map

### Staff (embedded)

| Screen | Purpose |
|--------|---------|
| Overview | Stats + onboarding checklist |
| Participants | Roster management |
| Users | Learners & staff |
| Courses | Upload, edit, assign |
| Reports | Progress + CSV |
| Settings | Fields + roles |

### Learner (theme / App Proxy)

| Screen | Purpose |
|--------|---------|
| Dashboard | Overview counts |
| My Courses | Assignment list |
| Player | SCORM runtime |
| Profile | Display name + read-only fields |

### Not built by LMS app

| Screen | Owner |
|--------|-------|
| Login / logout | Shopify |
| Account activate / invite accept | Shopify |
| Forgot / reset password | Shopify |
| Customer account email change | Shopify |

---

## 14. Integrations

| Integration | Role |
|-------------|------|
| Shopify Admin / App Bridge | Embedded staff UI |
| Shopify Customer Accounts | Identity |
| Online Store theme + App Proxy | Learner UI host |
| MongoDB | LMS domain data |
| Cloudflare R2 | SCORM package storage |
| Brevo / Resend / SendGrid / SMTP | Assignment reminders |
| CSV / XLSX parsers | Roster and learner import |
| Mindsmith (external) | Authoring → SCORM 1.2 export |
| Cron / scheduler | Reminder job |

---

## 15. Feature parity checklist

| Current LMS capability | Shopify LMS v1 |
|------------------------|----------------|
| Roster CRUD + import + bulk delete | Yes (app) |
| Learner invite + import + status | Yes (app + Shopify Customer) |
| Staff create / role matrix | Yes (app) |
| Custom fields | Yes (app) |
| SCORM 1.2 upload / replace / delete | Yes (app + R2) |
| Assign / unassign / bulk / topic auto-assign | Yes (app) |
| Learner dashboard / courses / player | Yes (theme + proxy + app) |
| Progress / score / resume | Yes (app) |
| Reports + CSV | Yes (app) |
| Reminders | Yes (app job) |
| VECTRA branding | Yes (theme + config) |
| Email/password auth implementation | No — Shopify |
| Paid checkout enrollment | No — future optional |
| SCORM 2004 | No |
| Audit log UI | No (recommended follow-up) |
| Malware scan on ZIP | No (recommended follow-up) |

---

## 16. Recommended staff onboarding sequence

1. Install LMS app on the VECTRA Shopify store; seed Admin profiles.
2. Configure Settings field definitions and Coordinator role pages.
3. Import participant roster (Facilities / Business Partners + Company IDs).
4. Upload Freely Chosen Employment (or program) SCORM 1.2 course.
5. Invite or import learners (roster-gated).
6. Confirm topic auto-assign or run bulk assign.
7. Learners sign in via Shopify and complete training.
8. Export progress CSV from Reports.
9. Enable reminder cron with ESP configured.

---

## 17. Known limitations

1. SCORM 1.2 only; not certified; no 2004 sequencing.
2. Mindsmith published URLs are not an operational tracking path.
3. Pilot DB on a single host is fine; production should use Atlas (or equivalent) + backups.
4. Reminder ESP needs proper DNS auth (SPF/DKIM/DMARC).
5. No malware scanning on SCORM uploads by default.
6. No formal audit trail UI in v1.

---

**VECTRA Shopify LMS** — Feature inventory for Shopify edition.

*Document version: October 2026*
