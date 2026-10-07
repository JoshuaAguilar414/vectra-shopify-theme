import type { Document } from "mongodb";

/** Pipeline stages: join course and keep only active SCORM courses. */
export function withActiveCourseStages(): Document[] {
  return [
    { $lookup: { from: "courses", localField: "courseId", foreignField: "_id", as: "course" } },
    { $unwind: "$course" },
    { $match: { "course.active": true, "course.type": "SCORM_12" } }
  ];
}
