/* Booking form.
   - Shows the right fields for hiring a facility or buying event tickets.
   - Checks the chosen time against opening hours, closed days and what is already booked.
   - Checks event places left, and verifies member numbers against the saved members.
   - Keeps a live price, then saves the booking in the browser store and opens its summary. */
(function () {
  'use strict';

  var D = window.NB_DATA;
  var NB = window.NB;
  var Store = window.NBStore;
  var Avail = window.NBAvail;
  var form = document.getElementById('booking-form');
  if (!form || !D || !NB || !Store || !Avail) return;

  var $ = function (id) { return document.getElementById(id); };

  var hireFields = $('hire-fields');
  var eventFields = $('event-fields');
  var facility = $('facility');
  var date = $('date');
  var start = $('start');
  var hours = $('hours');
  var units = $('units');
  var unitsHint = $('units-hint');
  var availBox = $('avail');
  var equipment = $('equipment');
  var member = $('member');
  var memberHint = $('member-hint');
  var eventSel = $('event');
  var entries = $('entries');
  var entriesLabel = $('entries-label');
  var entriesHint = $('entries-hint');
  var eventNote = $('event-note');
  var tix = { adult: $('t-adult'), concession: $('t-concession'), family: $('t-family'), under12: $('t-under12') };
  var lines = $('est-lines');
  var emptyMsg = $('est-empty');
  var total = $('est-total');
  var errBox = $('form-error');
  var memberDefaultHint = memberHint.innerHTML;

  if (!Store.persistent) $('storage-warning').hidden = false;

  date.min = NB.todayStr();
  date.max = NB.addDays(NB.todayStr(), 365);

  /* Remember each start-time label so it can be rebuilt as availability changes */
  Array.prototype.forEach.call(start.options, function (o) { o.setAttribute('data-label', o.textContent); });
  Array.prototype.forEach.call(eventSel.options, function (o) { o.setAttribute('data-label', o.textContent); });

  function mode() {
    var radios = form.querySelectorAll('input[name="mode"]');
    for (var i = 0; i < radios.length; i++) if (radios[i].checked) return radios[i].value;
    return 'hire';
  }

  function setMode(m) {
    var radios = form.querySelectorAll('input[name="mode"]');
    for (var i = 0; i < radios.length; i++) radios[i].checked = radios[i].value === m;
  }

  function showError(msg) { errBox.textContent = msg || ''; }

  /* ---- Hire ------------------------------------------------------------ */
  function syncFacility() {
    var f = D.facilities[facility.value];
    if (!f) return;
    units.max = String(f.max);
    if (+units.value > f.max) units.value = String(f.max);
    unitsHint.textContent = f.max === 1
      ? 'There is one ' + f.unit + ' to book.'
      : 'Up to ' + f.max + ' ' + NB.plural(f.unit, f.max) + ' at once.';
    units.disabled = f.max === 1;
    if (f.max === 1) units.value = '1';
  }

  function memberState() {
    var value = member.value.trim();
    if (!value) return { empty: true, record: null };
    return { empty: false, record: Store.members.find(value) };
  }

  function checkMember() {
    var state = memberState();
    member.setCustomValidity('');
    if (state.empty) {
      memberHint.innerHTML = memberDefaultHint;
    } else if (state.record) {
      memberHint.textContent = 'Member found: ' + state.record.name + '. 15% off hire is applied.';
    } else {
      var msg = 'We cannot find that member number. Check it, or clear the box to book without the discount.';
      memberHint.textContent = msg;
      member.setCustomValidity(msg);
    }
    return state.record;
  }

  function label(hour) { return NB.pad(hour) + ':00'; }

  function refreshStartOptions() {
    var options = start.options;
    var info = date.value ? Avail.startOptions(facility.value, date.value, +hours.value || 1, +units.value || 1) : null;
    for (var i = 0; i < options.length; i++) {
      var o = options[i];
      if (!o.value) continue;
      var base = o.getAttribute('data-label');
      if (!info) { o.disabled = false; o.textContent = base; continue; }
      var s = info[+o.value - 7];
      var f = D.facilities[facility.value];
      var text = base;
      if (s.closed) text += ', closed';
      else if (s.past) text += ', passed';
      else if (s.free === 0) text += ', full';
      else if (!s.ok) text += ', only ' + s.free + ' free';
      else text += f.max === 1 ? ', free' : ', ' + s.free + ' free';
      o.textContent = text;
      o.disabled = !s.ok;
    }
  }

  function suggestions(info) {
    var ok = info.filter(function (s) { return s.ok; }).slice(0, 4).map(function (s) { return label(s.hour); });
    return ok.length ? ' Free at ' + ok.join(', ') + '.' : ' Nothing else is free on this date, so try another day.';
  }

  /* Returns {message} when the choice cannot be booked, or null when it can */
  function checkHire() {
    date.setCustomValidity('');
    start.setCustomValidity('');
    units.setCustomValidity('');
    availBox.className = 'avail';
    availBox.textContent = '';
    if (!date.value || !start.value || !hours.value) return null;

    var s = +start.value;
    var h = +hours.value;
    var problem = NB.slotProblem(date.value, s, h);
    if (problem) {
      (problem.field === 'date' ? date : start).setCustomValidity(problem.message);
      return problem;
    }
    if (date.value === NB.todayStr() && s <= new Date().getHours()) {
      var past = { message: 'That start time has already passed today. Choose a later time.' };
      start.setCustomValidity(past.message);
      return past;
    }

    var f = D.facilities[facility.value];
    var wanted = +units.value || 1;
    var free = Avail.freeForSlot(facility.value, date.value, s, h);
    var span = label(s) + ' to ' + label(s + h);
    var hall = (facility.value === 'basketball' || facility.value === 'badminton')
      ? ' The sports hall is shared, so basketball and badminton cannot run at the same time.' : '';

    if (free === 0) {
      var full = { message: 'Fully booked from ' + span + '.' + suggestions(Avail.startOptions(facility.value, date.value, h, wanted)) + hall };
      start.setCustomValidity(full.message);
      availBox.className = 'avail avail-full';
      availBox.textContent = full.message;
      return full;
    }
    if (wanted > free) {
      var few = { message: 'Only ' + free + ' ' + NB.plural(f.unit, free) + ' free from ' + span + '. Choose fewer, or a different time.' };
      units.setCustomValidity(few.message);
      availBox.className = 'avail avail-full';
      availBox.textContent = few.message;
      return few;
    }
    availBox.className = 'avail ' + (free - wanted <= 1 && f.max > 1 ? 'avail-low' : 'avail-ok');
    availBox.textContent = f.max === 1
      ? 'The ' + f.unit + ' is free from ' + span + '.'
      : free + ' of ' + f.max + ' ' + NB.plural(f.unit, f.max) + ' free from ' + span + '.';
    return null;
  }

  /* ---- Event ----------------------------------------------------------- */
  function refreshEventOptions() {
    Array.prototype.forEach.call(eventSel.options, function (o) {
      var st = Avail.eventStatus(o.value);
      o.disabled = !!(st && st.finished);
      o.textContent = o.getAttribute('data-label') + (o.disabled ? ', finished' : '');
    });
    var current = eventSel.options[eventSel.selectedIndex];
    if (current && current.disabled) {
      for (var i = 0; i < eventSel.options.length; i++) {
        if (!eventSel.options[i].disabled) { eventSel.selectedIndex = i; break; }
      }
    }
  }

  function checkEvent() {
    tix.adult.setCustomValidity('');
    entries.setCustomValidity('');
    var ev = D.events[eventSel.value];
    var st = Avail.eventStatus(eventSel.value);
    if (!ev || !st) return null;

    if (ev.entry) {
      if (st.entriesLeft === 0) {
        entries.disabled = true;
        entries.value = '0';
        entriesLabel.textContent = ev.entry.label + 's entering';
        entriesHint.textContent = 'Entries are full. You can still book spectator tickets.';
      } else {
        entries.disabled = false;
        entries.max = String(st.entriesLeft);
        entriesLabel.textContent = ev.entry.label + 's entering';
        entriesHint.textContent = NB.money(ev.entry.price) + ' per ' + ev.entry.unit + '. ' +
          st.entriesLeft + ' ' + (st.entriesLeft === 1 ? ev.entry.unit : ev.entry.plural) + ' place' + (st.entriesLeft === 1 ? '' : 's') + ' left.';
      }
    } else {
      entries.disabled = true;
      entries.value = '0';
      entriesLabel.textContent = 'Entries';
      entriesHint.textContent = 'This event has no open entries.';
    }

    eventNote.textContent = (ev.free ? 'Watching is free. ' : '') + st.spectatorsLeft + ' spectator place' +
      (st.spectatorsLeft === 1 ? '' : 's') + ' left.';

    var sel = selection().sel;
    var wantedPeople = Avail.people(sel);
    var wantedEntries = parseInt(sel.entries, 10) || 0;
    if (wantedPeople > st.spectatorsLeft) {
      tix.adult.setCustomValidity('Only ' + st.spectatorsLeft + ' spectator places are left for this event.');
    }
    if (ev.entry && wantedEntries > st.entriesLeft) {
      entries.setCustomValidity('Only ' + st.entriesLeft + ' entry places are left for this event.');
    }
    return null;
  }

  /* ---- Shared ---------------------------------------------------------- */
  function selection() {
    if (mode() === 'hire') {
      var rec = checkMemberQuiet();
      return {
        mode: 'hire',
        sel: {
          facility: facility.value, date: date.value, start: +start.value, hours: +hours.value,
          units: +units.value || 0, equipment: equipment.checked, member: !!rec, memberNumber: rec ? rec.number : null
        }
      };
    }
    return {
      mode: 'event',
      sel: {
        event: eventSel.value, adult: tix.adult.value, concession: tix.concession.value,
        family: tix.family.value, under12: tix.under12.value, entries: entries.value
      }
    };
  }

  function checkMemberQuiet() { return memberState().record; }

  function row(text, amount) {
    var li = document.createElement('li');
    var a = document.createElement('span');
    var b = document.createElement('span');
    a.textContent = text;
    b.textContent = NB.fmt(amount);
    li.appendChild(a);
    li.appendChild(b);
    return li;
  }

  function render(result) {
    lines.textContent = '';
    if (!result || !result.lines.length) {
      emptyMsg.hidden = false;
      total.textContent = '£0';
      return;
    }
    emptyMsg.hidden = true;
    result.lines.forEach(function (l) { lines.appendChild(row(l.label, l.amount)); });
    total.textContent = result.total === 0 ? 'Free' : NB.money(result.total);
  }

  function update() {
    var result = null;
    if (mode() === 'hire') {
      syncFacility();
      checkMember();
      refreshStartOptions();
      var problem = checkHire();
      showError(problem && !availBox.textContent ? problem.message : '');
      result = problem ? null : NB.hire(selection().sel);
    } else {
      refreshEventOptions();
      checkEvent();
      showError('');
      result = NB.tickets(selection().sel);
      if (result && result.count === 0) tix.adult.setCustomValidity('Add at least one ticket or entry.');
      var st = Avail.eventStatus(eventSel.value);
      if (st && st.finished) eventSel.setCustomValidity('That event has finished.'); else eventSel.setCustomValidity('');
    }
    render(result);
    return result;
  }

  function applyMode() {
    var isHire = mode() === 'hire';
    hireFields.hidden = !isHire;
    hireFields.disabled = !isHire;
    eventFields.hidden = isHire;
    eventFields.disabled = isHire;
    update();
  }

  form.addEventListener('input', update);
  form.addEventListener('change', function (e) {
    if (e.target && e.target.name === 'mode') applyMode(); else update();
  });

  /* Pre-select from links such as booking.html?event=winter-cup or ?facility=pitch */
  try {
    var qs = new URLSearchParams(window.location.search);
    var evParam = qs.get('event');
    var facParam = qs.get('facility');
    if (evParam && D.events[evParam]) {
      setMode('event');
      eventSel.value = evParam;
    } else if (facParam && D.facilities[facParam]) {
      setMode('hire');
      facility.value = facParam;
    }
  } catch (e) { /* older browsers: keep the defaults */ }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var result = update();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (!result) { showError('Check your choices, then try again.'); return; }
    if (!Store.persistent) {
      showError('Your browser is blocking site storage, so the booking cannot be saved. Allow site data for this page, or call 020 7946 0123 to book.');
      return;
    }

    var cur = selection();
    var booking = {
      ref: Store.bookings.makeRef(),
      type: cur.mode,
      status: 'confirmed',
      created: new Date().toISOString(),
      date: cur.mode === 'hire' ? cur.sel.date : D.events[cur.sel.event].date,
      person: {
        name: $('name').value.trim(),
        email: $('email').value.trim(),
        phone: $('phone').value.trim(),
        notes: $('notes').value.trim()
      },
      sel: cur.sel,
      title: result.title,
      lines: result.lines,
      total: result.total
    };
    if (!Store.bookings.add(booking) && !Store.persistent) {
      showError('Your browser stopped us saving the booking. Please call 020 7946 0123 to book.');
      return;
    }
    window.location.href = 'confirmation.html?ref=' + encodeURIComponent(booking.ref);
  });

  applyMode();
}());
