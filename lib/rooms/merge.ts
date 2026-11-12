import { normalizeProgress } from "../player";
import type { BrickSet, SetProgress } from "../types";

/** Keep the newer progress for each player. Never drop another player's entry. */
export function mergePlayerProgress(
  current: Record<string, SetProgress> | undefined,
  incoming: Record<string, SetProgress> | undefined,
): Record<string, SetProgress> {
  const merged: Record<string, SetProgress> = {};
  for (const [playerId, progress] of Object.entries(current ?? {})) {
    merged[playerId] = normalizeProgress(progress);
  }
  for (const [playerId, progress] of Object.entries(incoming ?? {})) {
    const next = normalizeProgress(progress);
    const previous = merged[playerId];
    if (!previous || next.updatedAt >= previous.updatedAt) merged[playerId] = next;
  }
  return merged;
}

/**
 * The newer set snapshot supplies pages, steps, sections, and the combine step.
 * Progress is merged per player so a simultaneous check on another phone is not erased.
 */
export function mergeSetSnapshot(current: BrickSet, incoming: BrickSet): BrickSet {
  const useIncoming = incoming.updatedAt >= current.updatedAt;
  const primary = useIncoming ? incoming : current;
  const secondary = useIncoming ? current : incoming;
  return {
    ...primary,
    progressByPlayer: mergePlayerProgress(primary.progressByPlayer, secondary.progressByPlayer),
    sections: primary.sections ?? secondary.sections ?? [],
    combine: primary.combine ?? secondary.combine,
  };
}
