function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseProgressMeasure(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed > 1 ? parsed / 100 : parsed;
}

export function countScormInteractions(values: Record<string, string>): number {
  return Object.keys(values).filter((key) => /^cmi\.interactions\.\d+\.id$/.test(key)).length;
}

export function extractProgressFromScormMessage(data: unknown): number | undefined {
  if (!data || typeof data !== "object") return undefined;
  const payload = data as Record<string, unknown>;

  if (payload.type === "progress") {
    const raw = payload.progressMeasure ?? payload.progress ?? payload.value;
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) return undefined;
    return num > 1 ? num / 100 : num;
  }

  if (payload.type === "score") {
    const status = typeof payload.scormStatus === "string" ? payload.scormStatus.toLowerCase() : "";
    if (status && status !== "incomplete") return undefined;
    const num = Number(payload.score);
    if (!Number.isFinite(num) || num < 0) return undefined;
    return num > 1 ? num / 100 : num;
  }

  return undefined;
}

/** @deprecated Use extractProgressFromScormMessage */
export function extractProgressMeasureFromMessage(data: unknown): number | undefined {
  return extractProgressFromScormMessage(data);
}

export function computeActivitySteps(input: {
  previousSteps: number;
  previousInteractionCount: number;
  interactionCount: number;
  started: boolean;
  completed: boolean;
  now: Date;
  lastProgressBumpAt?: Date;
}): { activitySteps: number; lastProgressBumpAt?: Date } {
  let activitySteps = input.previousSteps;
  let lastProgressBumpAt = input.lastProgressBumpAt;

  if (input.interactionCount > input.previousInteractionCount) {
    activitySteps += input.interactionCount - input.previousInteractionCount;
  }

  if (input.started && !input.completed) {
    const lastBumpTime = lastProgressBumpAt?.getTime() ?? 0;
    if (input.now.getTime() - lastBumpTime >= 2 * 60 * 1000) {
      activitySteps += 1;
      lastProgressBumpAt = input.now;
    }
  }

  return { activitySteps, lastProgressBumpAt };
}

export function computeScormProgress(input: {
  completed: boolean;
  started: boolean;
  previous: number;
  progressMeasure?: number;
  scoreRaw?: number;
  scoreMin?: number;
  scoreMax?: number;
  activitySteps?: number;
}): number {
  if (input.completed) return 100;
  if (!input.started) return input.previous || 0;

  const fromProgress =
    input.progressMeasure !== undefined ? Math.round(clamp(input.progressMeasure, 0, 1) * 100) : undefined;

  let fromScore: number | undefined;
  if (input.scoreRaw !== undefined) {
    const min = input.scoreMin ?? 0;
    const max = input.scoreMax && input.scoreMax > min ? input.scoreMax : 100;
    fromScore = Math.round(((input.scoreRaw - min) / (max - min)) * 100);
  }

  const fromActivity =
    input.activitySteps !== undefined && input.activitySteps > 0
      ? Math.min(85, 10 + input.activitySteps * 5)
      : undefined;

  const baseline = Math.max(input.previous || 0, 10);
  const candidates = [fromProgress, fromScore, fromActivity].filter((value): value is number => value !== undefined);
  if (!candidates.length) return baseline;

  const best = Math.max(...candidates);
  return Math.max(baseline, clamp(best, 10, 99));
}
