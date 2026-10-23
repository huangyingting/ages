import { EVENTS_EARLY } from './events-early.ts';
import { EVENTS_MIDDLE } from './events-middle.ts';
import { EVENTS_MODERN } from './events-modern.ts';
import { STORIES, autoStory } from './stories.ts';
import type { HistEvent, StoryStep } from './types.ts';

/** All events, sorted by year, with scripted stories attached. */
export const EVENTS: HistEvent[] = [...EVENTS_EARLY, ...EVENTS_MIDDLE, ...EVENTS_MODERN]
  .map(e => (STORIES[e.id] && !e.story ? { ...e, story: STORIES[e.id] } : e))
  .sort((a, b) => a.year - b.year);

export const EVENT = new Map(EVENTS.map(e => [e.id, e]));

/** The story to play for an event: its script, or the automatic fly-to/model/caption sequence. */
export const storyOf = (e: HistEvent): StoryStep[] => e.story ?? autoStory(e);
export const hasScript = (e: HistEvent): boolean => !!e.story;
