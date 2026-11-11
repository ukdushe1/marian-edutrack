import { describe, it, expect, vi } from 'vitest';
import { firestoreMock } from './firebaseMock';
vi.mock('firebase/firestore', () => firestoreMock());
vi.mock('../src/firebase/config', () => ({ db: {}, default: {} }));
const { fillComment } = await import('../src/lib/commentBank');

describe('comment bank', () => {
  it('fills {name} with the first name, any case', () => {
    expect(fillComment('{name} did well, {NAME}!', { firstName: 'Pupil Two' })).toBe('Pupil did well, Pupil!');
  });
  it('prefers the preferred name', () => expect(fillComment('{name}', { firstName: 'A', preferredName: 'Bee' })).toBe('Bee'));
  it('falls back when no name', () => expect(fillComment('{name} tried.', {})).toBe('The student tried.'));
});
