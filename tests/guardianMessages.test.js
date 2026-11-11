import { describe, it, expect } from 'vitest';
import * as m from '../src/lib/guardianMessages';

describe('guardian messages', () => {
  it('normalises Zimbabwe numbers', () => {
    expect(m.normaliseNumber('0771 234 567')).toBe('263771234567');
    expect(m.normaliseNumber('+263771234567')).toBe('263771234567');
    expect(m.normaliseNumber('abc')).toBeNull();
    expect(m.formatNumber('0771234567')).toBe('+263 77 123 4567');
  });
  it('uses the first name only — never surname or candidate number', () => {
    const body = m.buildMessage('report-ready', { firstName: 'Pupil One', surname: 'Testsurname', candidateNumber: '0042' });
    expect(body).toContain('Pupil');
    expect(body).not.toContain('Testsurname');
    expect(body).not.toContain('0042');
  });
  it('blocks guardians without consent or a valid number', () => {
    expect(m.cannotMessageReason({ consentWhatsApp: false, whatsappNumber: '0771234567' })).toMatch(/consent/);
    expect(m.cannotMessageReason({ consentWhatsApp: true, whatsappNumber: '12' })).toMatch(/number/);
    expect(m.cannotMessageReason({ consentWhatsApp: true, whatsappNumber: '+263771234567' })).toBeNull();
  });
  it('builds an encoded wa.me link', () => {
    const link = m.whatsAppLink({ whatsappNumber: '0771234567' }, 'Hi & bye');
    expect(link.startsWith('https://wa.me/263771234567?text=')).toBe(true);
    expect(decodeURIComponent(link.split('text=')[1]).startsWith('Hi & bye')).toBe(true);
  });
});
