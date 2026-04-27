import scoresJson from '@hyperunicorn/data/scores';
import eventsJson from '@hyperunicorn/data/events';
import type { EventStream, ScoreOutput, UserProfile } from '@hyperunicorn/core';

export const scores = scoresJson as unknown as ScoreOutput;
export const events = eventsJson as unknown as EventStream;

export function userById(id: string): UserProfile | undefined {
  return events.users.find((u) => u.id === id);
}

export function scoreById(id: string) {
  return scores.scores.find((s) => s.user === id);
}
