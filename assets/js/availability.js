/* Availability: how many pitches, courts, lanes or event places are free.

   Two things use up space:
   1. Real bookings made in this browser (read from the store).
   2. Simulated "other customers", worked out from a fixed formula so the same date and time
      always gives the same answer. This makes the demo behave like a busy centre.

   The sports hall is shared: when basketball is booked, no badminton court is free, and
   when any badminton court is booked, the basketball court is not free. */
(function () {
  'use strict';

  var D = window.NB_DATA;
  var NB = window.NB;
  var Store = window.NBStore;
  if (!D || !NB || !Store) return;

  /* A small, fast text hash. The same text always gives the same number from 0 up to 1. */
  function fraction(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
  }

  /* Evenings on weekdays and the middle of the day at weekends are the busy times */
  function isBusy(date, hour) {
    return NB.isWeekend(date) ? (hour >= 10 && hour < 16) : (hour >= 17 && hour < 21);
  }

  /* The sports hall is one space, so basketball and badminton are worked out together */
  function simulatedHall(date, hour) {
    var chance = isBusy(date, hour) ? 0.6 : 0.25;
    if (fraction('hall|' + date + '|' + hour) >= chance) return { basketball: 0, badminton: 0 };
    if (fraction('which|' + date + '|' + hour) < 0.3) return { basketball: 1, badminton: 0 };
    return { basketball: 0, badminton: 1 + Math.floor(fraction('count|' + date + '|' + hour) * 6) };
  }

  function simulatedUsed(facility, date, hour) {
    if (facility === 'basketball' || facility === 'badminton') return simulatedHall(date, hour)[facility];
    var f = D.facilities[facility];
    var chance = isBusy(date, hour) ? 0.55 : 0.2;
    if (fraction('use|' + facility + '|' + date + '|' + hour) >= chance) return 0;
    if (f.max === 1) return 1;
    return Math.min(f.max, 1 + Math.floor(fraction('n|' + facility + '|' + date + '|' + hour) * f.max));
  }

  /* Units of a facility taken by real bookings at one hour */
  function bookedUnits(facility, date, hour) {
    var total = 0;
    Store.bookings.list().forEach(function (b) {
      if (b.type !== 'hire' || b.status !== 'confirmed') return;
      var s = b.sel;
      if (s.facility === facility && s.date === date && hour >= s.start && hour < s.start + s.hours) total += s.units;
    });
    return total;
  }

  function used(facility, date, hour) {
    return simulatedUsed(facility, date, hour) + bookedUnits(facility, date, hour);
  }

  /* How many units of a facility are free at one hour */
  function freeUnits(facility, date, hour) {
    var max = D.facilities[facility].max;
    if (facility === 'basketball') {
      return used('basketball', date, hour) === 0 && used('badminton', date, hour) === 0 ? 1 : 0;
    }
    if (facility === 'badminton') {
      return used('basketball', date, hour) > 0 ? 0 : Math.max(0, max - used('badminton', date, hour));
    }
    return Math.max(0, max - used(facility, date, hour));
  }

  /* Free units for a whole booking: the smallest number free in any of its hours */
  function freeForSlot(facility, date, start, hours) {
    var least = D.facilities[facility].max;
    for (var h = start; h < start + hours; h++) least = Math.min(least, freeUnits(facility, date, h));
    return least;
  }

  /* Every possible start time for a booking, with why it can or cannot be chosen */
  function startOptions(facility, date, hours, units) {
    var open = NB.isWeekend(date) ? D.hours.weekend : D.hours.weekday;
    var now = new Date();
    var today = NB.todayStr();
    var list = [];
    for (var hour = 7; hour <= 21; hour++) {
      var closed = hour < open.open || hour + hours > open.close;
      var past = date < today || (date === today && hour <= now.getHours());
      var free = closed ? 0 : freeForSlot(facility, date, hour, hours);
      list.push({ hour: hour, closed: closed, past: past, free: free, ok: !closed && !past && free >= units });
    }
    return list;
  }

  /* ---- Events ---------------------------------------------------------- */
  function people(sel) {
    var n = function (k) { return parseInt(sel[k], 10) || 0; };
    return n('adult') + n('concession') + n('under12') + 4 * n('family');
  }

  function eventStatus(id) {
    var ev = D.events[id];
    if (!ev) return null;
    var spectators = ev.base.spectators;
    var entries = ev.base.entries || 0;
    Store.bookings.list().forEach(function (b) {
      if (b.type !== 'event' || b.status !== 'confirmed' || b.sel.event !== id) return;
      spectators += people(b.sel);
      entries += parseInt(b.sel.entries, 10) || 0;
    });
    var finished = ev.endDate < NB.todayStr();
    return {
      finished: finished,
      spectatorsLeft: Math.max(0, ev.capacity.spectators - spectators),
      spectatorsSold: spectators,
      entriesLeft: ev.entry ? Math.max(0, ev.capacity.entries - entries) : null,
      entriesSold: ev.entry ? entries : null
    };
  }

  window.NBAvail = {
    freeUnits: freeUnits,
    freeForSlot: freeForSlot,
    startOptions: startOptions,
    eventStatus: eventStatus,
    people: people
  };
}());
