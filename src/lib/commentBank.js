/**
 * Comment bank — preset report comments.
 *
 * commentBank/{id}: { text, category, subject ('' = any subject, else a syllabus
 * code), active, createdBy, createdAt, updatedAt }
 * `{name}` in the text is replaced by the student's first name when picked.
 */
import { useEffect, useState } from 'react';
import { col, query, where, onSnapshot } from '../firebase/firestore';

export const CATEGORIES = [
  { key: 'excellent',        label: 'Excellent' },
  { key: 'good',             label: 'Good' },
  { key: 'satisfactory',     label: 'Satisfactory' },
  { key: 'needsImprovement', label: 'Needs improvement' },
];
export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

export const commentBankCol = () => col('commentBank');

/** Active comments, live. */
export function useCommentBank() {
  const [comments, setComments] = useState([]);
  useEffect(() => onSnapshot(query(commentBankCol(), where('active', '==', true)),
    (s) => setComments(s.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.text ?? '').localeCompare(b.text ?? '')))), []);
  return comments;
}

/** Fill {name} with the student's first name. */
export function fillComment(text, student) {
  const first = String(student?.preferredName || student?.firstName || '').trim().split(/\s+/)[0] || 'The student';
  return String(text ?? '').replace(/\{name\}/gi, first);
}
