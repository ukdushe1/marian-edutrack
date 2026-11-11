import { describe, it, expect } from 'vitest';
import { normaliseRoles, effectiveRoles, primaryRoleLabel } from '../src/lib/roles';
import { navForRoles } from '../src/components/layout/navConfig';

describe('roles', () => {
  it('maps legacy names', () => expect(normaliseRoles(['head', 'tutor', 'teacher'])).toEqual(['vicePrincipal', 'classTeacher', 'teacher']));
  it('Principal implies admin and Vice Principal', () => expect(effectiveRoles(['principal'])).toEqual(expect.arrayContaining(['superAdmin', 'vicePrincipal'])));
  it('legacy Head is not an administrator', () => expect(effectiveRoles(['head'])).not.toContain('superAdmin'));
  it('labels', () => {
    expect(primaryRoleLabel(['tutor'])).toBe('Class Teacher');
    expect(primaryRoleLabel([])).toBe('No role yet');
  });
});

describe('menus', () => {
  const paths = (roles) => navForRoles(effectiveRoles(roles)).map((l) => l.path);
  it('admins see every staff page, with no duplicates', () => {
    const p = paths(['principal']);
    expect(new Set(p).size).toBe(p.length);
    expect(p).toEqual(expect.arrayContaining(['/admin/users', '/admin/backup', '/exams/term', '/markbook', '/boarding', '/head/analytics']));
  });
  it('a teacher who is also a class teacher gets both menus', () => {
    expect(paths(['teacher', 'classTeacher'])).toEqual(expect.arrayContaining(['/markbook', '/conduct', '/exam-tasks']));
  });
  it('a teacher does not see admin pages', () => expect(paths(['teacher'])).not.toContain('/admin/users'));
  it('no role → only Today', () => expect(paths([])).toEqual(['/']));
});
