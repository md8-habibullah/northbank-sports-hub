#!/usr/bin/env node
/* Tests for the booking logic (Node.js, no packages needed).

   Run from the project folder:   node tools/test_logic.js

   It loads the real files from assets/js into a fake browser, with a fixed "today" and a fake
   localStorage, then checks the price rules, the saved data, availability, cancellation rules and
   the calendar file. It also reads pricing.html and fails if a price on that page differs from
   the prices in assets/js/data.js, which the booking form uses. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error('FAIL  ' + name + '\n      ' + e.message);
  }
}

/* A fresh fake browser with the site's scripts loaded. "now" is fixed so results never change. */
function load(options) {
  options = options || {};
  const NOW = (options.now || new Date(2026, 10, 16, 10, 0, 0)).getTime(); // Monday 16 Nov 2026, 10:00

  class FakeDate extends Date {
    constructor(...args) {
      if (args.length === 0) super(NOW); else super(...args);
    }
    static now() { return NOW; }
  }

  const data = {};
  const localStorage = options.blocked
    ? {
        getItem() { throw new Error('blocked'); },
        setItem() { throw new Error('blocked'); },
        removeItem() { throw new Error('blocked'); }
      }
    : {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
        setItem: (k, v) => { data[k] = String(v); },
        removeItem: (k) => { delete data[k]; }
      };

  const ctx = { console, Date: FakeDate, crypto: require('crypto').webcrypto, localStorage };
  ctx.window = ctx;
  vm.createContext(ctx);
  ['data', 'pricing', 'store', 'availability', 'calendar'].forEach((name) => {
    const file = path.join(ROOT, 'assets', 'js', name + '.js');
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: name + '.js' });
  });
  return { w: ctx, saved: data };
}

function hireBooking(w, sel, extra) {
  const result = w.NB.hire(sel);
  return Object.assign({
    ref: w.NBStore.bookings.makeRef(), type: 'hire', status: 'confirmed', created: '2026-11-16T10:00:00.000Z',
    date: sel.date, person: { name: 'Test', email: 't@example.com', phone: '', notes: '' },
    sel: sel, title: result.title, lines: result.lines, total: result.total
  }, extra || {});
}

function eventBooking(w, sel, extra) {
  const result = w.NB.tickets(sel);
  return Object.assign({
    ref: w.NBStore.bookings.makeRef(), type: 'event', status: 'confirmed', created: '2026-11-16T10:00:00.000Z',
    date: w.NB_DATA.events[sel.event].date, person: { name: 'Test', email: 't@example.com', phone: '', notes: '' },
    sel: sel, title: result.title, lines: result.lines, total: result.total
  }, extra || {});
}

const WED = '2026-12-02'; // a Wednesday
const SAT = '2026-12-05'; // a Saturday

/* ---- Price rules ----------------------------------------------------------------------- */
test('pitch Wednesday 16:00 to 18:00 is one off-peak hour and one peak hour: 90', () => {
  const { w } = load();
  const r = w.NB.hire({ facility: 'pitch', date: WED, start: 16, hours: 2, units: 1, equipment: false, member: false });
  assert.strictEqual(r.total, 90);
  assert.strictEqual(r.lines.length, 2);
});

test('member discount is 15% of hire: 76.50, and the equipment pack is not discounted', () => {
  const { w } = load();
  const base = { facility: 'pitch', date: WED, start: 16, hours: 2, units: 1 };
  assert.strictEqual(w.NB.hire(Object.assign({ equipment: false, member: true }, base)).total, 76.5);
  assert.strictEqual(w.NB.hire(Object.assign({ equipment: true, member: true }, base)).total, 82.5);
  assert.strictEqual(w.NB.hire(Object.assign({ equipment: true, member: false }, base)).total, 96);
});

test('weekends are peak all day, and units multiply the price', () => {
  const { w } = load();
  const r = w.NB.hire({ facility: 'pitch', date: SAT, start: 9, hours: 2, units: 2, equipment: false, member: false });
  assert.strictEqual(r.total, 2 * 2 * 52);
});

test('badminton courts are charged per court', () => {
  const { w } = load();
  const r = w.NB.hire({ facility: 'badminton', date: WED, start: 18, hours: 1, units: 3, equipment: false, member: false });
  assert.strictEqual(r.total, 3 * 14);
});

test('hire rejects more units than the facility has', () => {
  const { w } = load();
  assert.strictEqual(w.NB.hire({ facility: 'tennis', date: WED, start: 18, hours: 1, units: 5 }), null);
});

test('opening hours, closed days and past dates are refused', () => {
  const { w } = load();
  assert.strictEqual(w.NB.slotProblem(WED, 9, 2), null);
  assert.strictEqual(w.NB.slotProblem(WED, 6, 1).field, 'start');
  assert.strictEqual(w.NB.slotProblem(WED, 21, 2).field, 'start');
  assert.strictEqual(w.NB.slotProblem(SAT, 19, 2).field, 'start');
  assert.strictEqual(w.NB.slotProblem('2026-12-25', 10, 1).field, 'date');
  assert.strictEqual(w.NB.slotProblem('2026-12-26', 10, 1).field, 'date');
  assert.strictEqual(w.NB.slotProblem('2026-11-15', 10, 1).field, 'date');
  assert.strictEqual(w.NB.slotProblem('2026-11-16', 10, 1), null);
});

test('event tickets and entries are added up', () => {
  const { w } = load();
  const r = w.NB.tickets({ event: 'winter-cup', adult: '2', concession: '0', family: '1', under12: '3', entries: '1' });
  assert.strictEqual(r.total, 2 * 6 + 15 + 0 + 60);
  assert.strictEqual(r.count, 2 + 1 + 3 + 1);
});

test('free events have free spectator tickets, but entries still cost money', () => {
  const { w } = load();
  assert.strictEqual(w.NB.tickets({ event: 'open-day', adult: '3', concession: '0', family: '0', under12: '0', entries: '0' }).total, 0);
  assert.strictEqual(w.NB.tickets({ event: 'swim', adult: '1', concession: '0', family: '0', under12: '0', entries: '2' }).total, 20);
});

test('money formatting', () => {
  const { w } = load();
  assert.strictEqual(w.NB.money(90), '£90');
  assert.strictEqual(w.NB.money(76.5), '£76.50');
  assert.strictEqual(w.NB.fmt(0), 'Free');
  assert.strictEqual(w.NB.fmt(-13.5), '−£13.50');
});

/* ---- The Prices page must match data.js ------------------------------------------------- */
(function pricesPage() {
  const { w } = load();
  const D = w.NB_DATA;
  const html = fs.readFileSync(path.join(ROOT, 'pricing.html'), 'utf8');

  function bodyRows(caption) {
    const start = html.indexOf('<caption>' + caption + '</caption>');
    assert.ok(start >= 0, 'pricing.html has no table captioned "' + caption + '"');
    const end = html.indexOf('</table>', start);
    const body = html.slice(html.indexOf('<tbody>', start), end);
    return body.split('<tr>').slice(1).map((row) => ({
      label: row.replace(/<span[^>]*><\/span>/g, '').match(/<th[^>]*>([^<]*)<\/th>/)[1].trim(),
      cells: (row.match(/<td[^>]*>.*?<\/td>/g) || []).map((c) => c.replace(/<[^>]+>/g, '').trim())
    }));
  }
  const poundsIn = (text) => (text.match(/£(\d+(?:\.\d+)?)/g) || []).map((s) => Number(s.slice(1)));

  test('Prices page: hire prices match data.js', () => {
    const rows = bodyRows('Facility hire, price per hour');
    const facilities = Object.keys(D.facilities).map((k) => D.facilities[k]);
    assert.strictEqual(rows.length, facilities.length);
    rows.forEach((row, i) => {
      assert.deepStrictEqual(poundsIn(row.cells[1]).concat(poundsIn(row.cells[2])), [facilities[i].offpeak, facilities[i].peak],
        row.label);
    });
  });

  test('Prices page: spectator tickets match data.js', () => {
    const rows = bodyRows('Spectator tickets, per person');
    const keys = Object.keys(D.tickets);
    assert.strictEqual(rows.length, keys.length);
    rows.forEach((row, i) => {
      const shown = /free/i.test(row.cells[1]) ? 0 : poundsIn(row.cells[1])[0];
      assert.strictEqual(shown, D.tickets[keys[i]].price, row.label);
    });
  });

  test('Prices page: entry fees match data.js', () => {
    const rows = bodyRows('Entry fees for people taking part');
    const entering = Object.keys(D.events).filter((id) => D.events[id].entry);
    assert.strictEqual(rows.length, entering.length);
    rows.forEach((row, i) => {
      assert.strictEqual(row.label, D.events[entering[i]].name);
      assert.strictEqual(poundsIn(row.cells[1])[0], D.events[entering[i]].entry.price, row.label);
    });
  });

  test('Prices page: membership fees, discount and equipment pack match data.js', () => {
    const rows = bodyRows('Membership plans');
    ['member', 'family', 'student'].forEach((key, i) => {
      assert.strictEqual(poundsIn(rows[i + 1].cells[0])[0], D.plans[key].price, key);
    });
    assert.ok(html.indexOf(Math.round(D.memberDiscount * 100) + '% off hire') >= 0, 'member discount text');
    assert.ok(new RegExp('Equipment pack</dt><dd>£' + D.equipment + ' ').test(html), 'equipment pack price');
  });
}());

/* ---- Saved data ------------------------------------------------------------------------ */
test('bookings: add, find (any case), update, remove, and data is stored as JSON', () => {
  const { w, saved } = load();
  const S = w.NBStore;
  const b = hireBooking(w, { facility: 'tennis', date: WED, start: 18, hours: 1, units: 1, equipment: false, member: false });
  assert.ok(/^NB-[A-HJKMNP-Z2-9]{6}$/.test(b.ref), b.ref);
  S.bookings.add(b);
  assert.strictEqual(S.bookings.find(b.ref.toLowerCase()).ref, b.ref);
  S.bookings.update(b.ref, { status: 'cancelled', fee: 5 });
  assert.strictEqual(S.bookings.find(b.ref).status, 'cancelled');
  assert.strictEqual(JSON.parse(saved['nb:bookings']).length, 1);
  S.bookings.remove(b.ref);
  assert.strictEqual(S.bookings.list().length, 0);
  assert.strictEqual(S.bookings.find('NB-NOPE00'), null);
});

test('booking references are unique', () => {
  const { w } = load();
  const seen = {};
  for (let i = 0; i < 300; i++) {
    const ref = w.NBStore.bookings.makeRef();
    assert.ok(!seen[ref], 'repeated ' + ref);
    seen[ref] = true;
    w.NBStore.bookings.add({ ref: ref, status: 'confirmed', type: 'hire', sel: {} });
  }
});

test('members: demo member exists, new numbers count up from NBM-1001, reset restores the demo', () => {
  const { w } = load();
  const S = w.NBStore;
  assert.strictEqual(S.members.find('nbm-0001').demo, true);
  assert.strictEqual(S.members.add({ plan: 'member', name: 'A', email: 'a@example.com' }).number, 'NBM-1001');
  assert.strictEqual(S.members.add({ plan: 'family', name: 'B', email: 'b@example.com' }).number, 'NBM-1002');
  assert.strictEqual(S.members.find('NBM-1002').name, 'B');
  assert.strictEqual(S.members.find('NBM-9999'), null);
  S.bookings.add({ ref: 'NB-AAAAAA', status: 'confirmed', type: 'hire', sel: {} });
  S.messages.add({ name: 'M', email: 'm@example.com', topic: 'A booking', message: 'Hello' });
  S.reset();
  assert.strictEqual(S.members.list().length, 1);
  assert.strictEqual(S.members.list()[0].number, 'NBM-0001');
  assert.strictEqual(S.bookings.list().length, 0);
  assert.strictEqual(S.messages.list().length, 0);
});

test('messages: add, mark read, delete', () => {
  const { w } = load();
  const m = w.NBStore.messages.add({ name: 'Sam', email: 's@example.com', topic: 'Membership', message: 'Hi' });
  assert.strictEqual(m.status, 'new');
  w.NBStore.messages.update(m.id, { status: 'read' });
  assert.strictEqual(w.NBStore.messages.list()[0].status, 'read');
  w.NBStore.messages.remove(m.id);
  assert.strictEqual(w.NBStore.messages.list().length, 0);
});

test('blocked storage: reports it, and still works in memory', () => {
  const { w } = load({ blocked: true });
  assert.strictEqual(w.NBStore.persistent, false);
  w.NBStore.bookings.add({ ref: 'NB-MEMORY', status: 'confirmed', type: 'hire', sel: {} });
  assert.strictEqual(w.NBStore.bookings.find('NB-MEMORY').ref, 'NB-MEMORY');
});

test('damaged saved data does not crash the store', () => {
  const { w, saved } = load();
  saved['nb:bookings'] = '{not json';
  assert.strictEqual(w.NBStore.bookings.list().length, 0);
  saved['nb:bookings'] = '{"a":1}';
  assert.strictEqual(w.NBStore.bookings.list().length, 0);
});

/* ---- Availability ---------------------------------------------------------------------- */
test('availability is repeatable and always between 0 and the maximum', () => {
  const { w } = load();
  const A = w.NBAvail;
  let full = 0;
  let free = 0;
  Object.keys(w.NB_DATA.facilities).forEach((key) => {
    const max = w.NB_DATA.facilities[key].max;
    for (let d = 0; d < 28; d++) {
      const date = w.NB.addDays('2026-11-17', d);
      for (let h = 7; h < 22; h++) {
        const n = A.freeUnits(key, date, h);
        assert.ok(n >= 0 && n <= max, key + ' ' + date + ' ' + h + ' -> ' + n);
        assert.strictEqual(n, A.freeUnits(key, date, h));
        if (n === 0) full++; else free++;
      }
    }
  });
  assert.ok(full > 50 && free > 500, 'a believable mix of full and free slots: ' + full + ' full, ' + free + ' free');
});

/* Find an hour where nothing is booked yet, so the effect of one booking can be seen */
function emptyHour(w, facility, units) {
  for (let d = 0; d < 60; d++) {
    const date = w.NB.addDays('2026-11-17', d);
    for (let h = 7; h < 21; h++) {
      if (w.NBAvail.freeUnits('basketball', date, h) === 1 && w.NBAvail.freeUnits('badminton', date, h) === 6 &&
          w.NBAvail.freeUnits(facility, date, h) >= units) return { date: date, hour: h };
    }
  }
  throw new Error('no empty hour found');
}

test('a real booking uses up space, and cancelling it gives the space back', () => {
  const { w } = load();
  let spot = null;
  for (let d = 0; d < 60 && !spot; d++) {
    const date = w.NB.addDays('2026-11-17', d);
    for (let h = 7; h < 21; h++) if (w.NBAvail.freeUnits('pitch', date, h) === 2) { spot = { date: date, hour: h }; break; }
  }
  assert.ok(spot, 'a day with both pitches free');
  const b = hireBooking(w, { facility: 'pitch', date: spot.date, start: spot.hour, hours: 1, units: 2, equipment: false, member: false });
  w.NBStore.bookings.add(b);
  assert.strictEqual(w.NBAvail.freeUnits('pitch', spot.date, spot.hour), 0);
  w.NBStore.bookings.update(b.ref, { status: 'cancelled' });
  assert.strictEqual(w.NBAvail.freeUnits('pitch', spot.date, spot.hour), 2);
});

test('the sports hall is shared: basketball and badminton block each other', () => {
  const { w } = load();
  const spot = emptyHour(w, 'basketball', 1);
  const A = w.NBAvail;
  const bball = hireBooking(w, { facility: 'basketball', date: spot.date, start: spot.hour, hours: 1, units: 1, equipment: false, member: false });
  w.NBStore.bookings.add(bball);
  assert.strictEqual(A.freeUnits('basketball', spot.date, spot.hour), 0);
  assert.strictEqual(A.freeUnits('badminton', spot.date, spot.hour), 0);
  w.NBStore.bookings.update(bball.ref, { status: 'cancelled' });
  assert.strictEqual(A.freeUnits('badminton', spot.date, spot.hour), 6);
  w.NBStore.bookings.add(hireBooking(w, { facility: 'badminton', date: spot.date, start: spot.hour, hours: 1, units: 1, equipment: false, member: false }));
  assert.strictEqual(A.freeUnits('badminton', spot.date, spot.hour), 5);
  assert.strictEqual(A.freeUnits('basketball', spot.date, spot.hour), 0);
});

test('a multi-hour booking is limited by its busiest hour', () => {
  const { w } = load();
  const spot = emptyHour(w, 'tennis', 1);
  const A = w.NBAvail;
  const before = A.freeForSlot('tennis', spot.date, spot.hour, 2);
  w.NBStore.bookings.add(hireBooking(w, { facility: 'tennis', date: spot.date, start: spot.hour + 1, hours: 1, units: 1, equipment: false, member: false }));
  assert.ok(A.freeForSlot('tennis', spot.date, spot.hour, 2) <= before);
  assert.strictEqual(A.freeForSlot('tennis', spot.date, spot.hour, 2), Math.min(A.freeUnits('tennis', spot.date, spot.hour), A.freeUnits('tennis', spot.date, spot.hour + 1)));
});

test('start-time list marks closed and passed hours', () => {
  const { w } = load();
  const today = w.NBAvail.startOptions('pitch', '2026-11-16', 1, 1); // "now" is 10:00 on this day
  assert.strictEqual(today[10 - 7].past, true);
  assert.strictEqual(today[11 - 7].past, false);
  assert.strictEqual(today[7 - 7].ok, false); // passed
  const sat = w.NBAvail.startOptions('pitch', SAT, 1, 1);
  assert.strictEqual(sat[7 - 7].closed, true); // weekends open at 08:00
  assert.strictEqual(sat[20 - 7].closed, true); // and close at 20:00
  const twoHours = w.NBAvail.startOptions('pitch', WED, 2, 1);
  assert.strictEqual(twoHours[21 - 7].closed, true); // 21:00 to 23:00 runs past closing
});

test('events: places left start from the seeded sales, and real bookings use them up', () => {
  const { w } = load();
  const A = w.NBAvail;
  assert.strictEqual(A.eventStatus('winter-cup').entriesLeft, 2);
  assert.strictEqual(A.eventStatus('winter-cup').spectatorsLeft, 250 - 138);
  assert.strictEqual(A.eventStatus('champs').entriesLeft, 0);
  assert.strictEqual(A.eventStatus('open-day').entriesLeft, null);
  const b = eventBooking(w, { event: 'winter-cup', adult: '1', concession: '0', family: '1', under12: '1', entries: '2' });
  w.NBStore.bookings.add(b);
  assert.strictEqual(A.eventStatus('winter-cup').entriesLeft, 0);
  assert.strictEqual(A.eventStatus('winter-cup').spectatorsLeft, 250 - 138 - (1 + 4 + 1));
  w.NBStore.bookings.update(b.ref, { status: 'cancelled' });
  assert.strictEqual(A.eventStatus('winter-cup').entriesLeft, 2);
});

test('events: finished once the last day has passed', () => {
  const { w } = load({ now: new Date(2027, 0, 10, 10, 0, 0) }); // 10 Jan 2027
  assert.strictEqual(w.NBAvail.eventStatus('doubles').finished, true);
  assert.strictEqual(w.NBAvail.eventStatus('run').finished, true);
  assert.strictEqual(w.NBAvail.eventStatus('slam').finished, true); // 9 Jan, so over by 10 Jan
  assert.strictEqual(w.NBAvail.eventStatus('champs').finished, false); // 23 and 24 Jan
  assert.strictEqual(w.NBAvail.eventStatus('futsal').finished, false);
});

/* ---- Cancellation rules ---------------------------------------------------------------- */
test('hire: free at 48 hours or more, late fee under 48 hours, blocked once started', () => {
  const { w } = load();
  const now = new Date(2026, 10, 16, 10, 0, 0);
  const mk = (date, start) => hireBooking(w, { facility: 'pitch', date: date, start: start, hours: 1, units: 1, equipment: false, member: false });
  const free = w.NB.cancellation(mk('2026-11-18', 10), now);
  assert.strictEqual(free.allowed, true);
  assert.strictEqual(free.fee, 0);
  const late = mk('2026-11-18', 9);
  const lateResult = w.NB.cancellation(late, now);
  assert.strictEqual(lateResult.allowed, true);
  assert.strictEqual(lateResult.fee, late.total);
  assert.strictEqual(w.NB.cancellation(mk('2026-11-16', 9), now).allowed, false);
  const cancelled = mk('2026-11-25', 10);
  cancelled.status = 'cancelled';
  assert.strictEqual(w.NB.cancellation(cancelled, now).allowed, false);
});

test('events: free at 7 days or more, full price under 7 days', () => {
  const { w } = load();
  const b = eventBooking(w, { event: 'doubles', adult: '2', concession: '0', family: '0', under12: '0', entries: '1' }); // 13 Dec 09:00
  const early = w.NB.cancellation(b, new Date(2026, 11, 5, 10, 0, 0));
  assert.strictEqual(early.fee, 0);
  const late = w.NB.cancellation(b, new Date(2026, 11, 7, 10, 0, 0));
  assert.strictEqual(late.fee, b.total);
  assert.ok(/still payable/.test(late.message));
});

/* ---- Calendar file --------------------------------------------------------------------- */
test('calendar file: one entry for a hire, one per day for a two-day event, valid line endings', () => {
  const { w } = load();
  const hire = hireBooking(w, { facility: 'pitch', date: WED, start: 16, hours: 2, units: 1, equipment: false, member: false });
  const ics = w.NBCalendar.build(hire);
  assert.ok(ics.indexOf('BEGIN:VCALENDAR\r\n') === 0);
  assert.ok(/\r\nEND:VCALENDAR\r\n$/.test(ics));
  assert.strictEqual((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.ok(ics.indexOf('DTSTART:20261202T160000') >= 0 && ics.indexOf('DTEND:20261202T180000') >= 0);
  assert.ok(ics.indexOf('LOCATION:Northbank Sports Hub\\, 12 Riverside Walk') >= 0, 'commas are escaped');
  assert.ok(ics.indexOf(hire.ref) >= 0);

  const champs = eventBooking(w, { event: 'champs', adult: '1', concession: '0', family: '0', under12: '0', entries: '0' });
  const two = w.NBCalendar.build(champs);
  assert.strictEqual((two.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.ok(two.indexOf('DTSTART:20270123T090000') >= 0 && two.indexOf('DTSTART:20270124T090000') >= 0);
});

console.log((failed === 0 ? 'OK  ' : 'FAILED  ') + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
