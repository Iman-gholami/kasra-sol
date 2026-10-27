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
it('starts Persian months on the right Tehran day across the year', () => {
  assert.deepEqual(persianMonthStart(new Date('2026-04-20T21:00:00Z')), { start: '2026-04-21', label: 'اردیبهشت ۱۴۰۵' });
  assert.deepEqual(persianMonthStart(new Date('2026-12-21T12:00:00Z')), { start: '2026-11-22', label: 'آذر ۱۴۰۵' });
  assert.deepEqual(persianMonthStart(new Date('2027-03-20T12:00:00Z')), { start: '2027-02-20', label: 'اسفند ۱۴۰۵' });
  assert.equal(tehranDate(new Date('2026-06-30T23:59:00Z')), '2026-07-01');
});
