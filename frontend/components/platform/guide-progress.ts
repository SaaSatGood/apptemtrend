export type GuideProgress = { hook: string | null; scenes: number[] };

export function readGuideProgress(kitId: string): GuideProgress {
  try {
    const value = JSON.parse(localStorage.getItem(`temtrend-guide:${kitId}`) || "null") as Partial<GuideProgress> | null;
    return { hook: typeof value?.hook === "string" ? value.hook : null, scenes: Array.isArray(value?.scenes) ? value.scenes.filter((item): item is number => Number.isInteger(item) && item >= 0) : [] };
  } catch { return { hook: null, scenes: [] }; }
}

export function saveGuideProgress(kitId: string, value: GuideProgress) {
  try { localStorage.setItem(`temtrend-guide:${kitId}`, JSON.stringify(value)); } catch { /* Optional local progress. */ }
}
