/** The history course: one lesson per textbook unit (统编版初中 and 高中纲要上). Authoring guide: docs/design/course.md. */
import type { Book, Lesson } from '../types.ts';
import { G7A } from './g7a.ts';
import { G7B } from './g7b.ts';
import { G8A } from './g8a.ts';
import { G8B } from './g8b.ts';
import { HS1 } from './hs1.ts';

export const LESSONS: Lesson[] = [...G7A, ...G7B, ...G8A, ...G8B, ...HS1];
export const LESSON = new Map(LESSONS.map(l => [l.id, l]));
/** the lessons of a unit, in order */
export const unitLessons = (book: Book, unit: number): Lesson[] => LESSONS.filter(l => l.book === book && l.unit === unit);
