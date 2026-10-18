import { it } from 'node:test';
import assert from 'node:assert/strict';
import { persianMonthStart, tehranDate } from '../src/admin/calendar';

it('uses Tehran local dates, not the server time zone', () => {
  assert.equal(tehranDate(new Date('2026-03-20T20:29:00Z')), '2026-03-20');
  assert.equal(tehranDate(new Date('2026-03-20T20:31:00Z')), '2026-03-21');
});
it('starts the month on the first day of the current Solar Hijri month', () => {
  assert.deepEqual(persianMonthStart(new Date('2026-10-17T10:00:00Z')), { start: '2026-09-23', label: 'مهر ۱۴۰۵' });
  assert.equal(persianMonthStart(new Date('2026-09-22T20:00:00Z')).start, '2026-08-23', 'last day of Shahrivar');
  assert.equal(persianMonthStart(new Date('2026-03-20T20:31:00Z')).start, '2026-03-21', 'Nowruz begins a new year');
});
