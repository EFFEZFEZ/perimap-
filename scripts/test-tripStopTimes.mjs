import assert from 'node:assert/strict';
import { hasMeaningfulGtfsTime, isLastStopOfTrip } from '../public/js/utils/tripStopTimes.mjs';

assert.equal(hasMeaningfulGtfsTime('06:50:00'), true);
assert.equal(hasMeaningfulGtfsTime('  '), false);
assert.equal(hasMeaningfulGtfsTime(undefined), false);

const stopTimes = [
  { stop_id: 'A', departure_time: '06:00:00' },
  { stop_id: 'B', departure_time: '06:10:00' },
  { stop_id: 'TOURNY', arrival_time: '06:20:00', departure_time: '' }
];

assert.equal(isLastStopOfTrip(stopTimes, 'TOURNY'), true);
assert.equal(isLastStopOfTrip(stopTimes, 'B'), false);

console.log('[test-tripStopTimes] OK');
