import { EVENTS_EARLY } from './events-early.ts';
import { EVENTS_MIDDLE } from './events-middle.ts';
import { EVENTS_MODERN } from './events-modern.ts';
import { importedEvents } from './jiangshan.ts';
import { STORIES, autoStory } from './stories.ts';
import type { HistEvent, StoryStep } from './types.ts';

const CURATED = [...EVENTS_EARLY, ...EVENTS_MIDDLE, ...EVENTS_MODERN];

/** All events (curated textbook events + the imported chronicle), sorted by year, with scripted stories attached. */
export const EVENTS: HistEvent[] = [...CURATED, ...importedEvents(CURATED)]
  .map(e => (STORIES[e.id] && !e.story ? { ...e, story: STORIES[e.id] } : e))
  .sort((a, b) => a.year - b.year || a.weight - b.weight);

export const EVENT = new Map(EVENTS.map(e => [e.id, e]));

/** The story to play for an event: its script, or the automatic fly-to/model/caption sequence. */
export const storyOf = (e: HistEvent): StoryStep[] => e.story ?? autoStory(e);
export const hasScript = (e: HistEvent): boolean => !!e.story;
