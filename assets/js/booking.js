/* Booking form: shows or hides the right fields, checks the slot against opening hours,
   keeps a live price estimate, and passes the booking to the summary page.
   Nothing leaves the browser. */
(function () {
  'use strict';

  var D = window.NB_DATA;
  var NB = window.NB;
  var form = document.getElementById('booking-form');
  if (!form || !D || !NB) return;

  var $ = function (id) { return document.getElementById(id); };

  var hireFields = $('hire-fields');
  var eventFields = $('event-fields');
  var facility = $('facility');
  var date = $('date');
  var start = $('start');
  var hours = $('hours');
  var units = $('units');
  var unitsHint = $('units-hint');
  var equipment = $('equipment');
  var member = $('member');
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

  date.min = NB.todayStr();
  date.max = NB.addDays(NB.todayStr(), 365);

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

  function syncEvent() {
    var ev = D.events[eventSel.value];
    if (!ev) return;
    if (ev.entry) {
      entries.disabled = false;
      entriesLabel.textContent = ev.entry.label + 's entering';
      entriesHint.textContent = NB.money(ev.entry.price) + ' per ' + ev.entry.unit + '.';
    } else {
      entries.disabled = true;
      entries.value = '0';
      entriesLabel.textContent = 'Entries';
      entriesHint.textContent = 'This event has no open entries.';
    }
    eventNote.textContent = ev.free
      ? 'Watching this event is free. Reserve your places so we know how many people to expect.'
      : 'Spectator ticket prices are shown below.';
  }

  function checkSlot() {
    date.setCustomValidity('');
    start.setCustomValidity('');
    if (!date.value || !start.value || !hours.value) return null;
    var problem = NB.slotProblem(date.value, +start.value, +hours.value);
    if (problem) (problem.field === 'date' ? date : start).setCustomValidity(problem.message);
    return problem;
  }

  function checkTickets(count) {
    tix.adult.setCustomValidity(count > 0 ? '' : 'Add at least one ticket or entry.');
  }

  function selection() {
    if (mode() === 'hire') {
      return {
        mode: 'hire',
        sel: {
          facility: facility.value, date: date.value, start: +start.value, hours: +hours.value,
          units: +units.value || 0, equipment: equipment.checked, member: member.checked
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

  function row(label, amount) {
    var li = document.createElement('li');
    var a = document.createElement('span');
    var b = document.createElement('span');
    a.textContent = label;
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
    var cur = selection();
    var result = null;
    if (cur.mode === 'hire') {
      syncFacility();
      var problem = checkSlot();
      showError(problem ? problem.message : '');
      result = problem ? null : NB.hire(cur.sel);
    } else {
      syncEvent();
      showError('');
      result = NB.tickets(selection().sel);
      checkTickets(result ? result.count : 0);
    }
    render(result);
    return result;
  }

  function setMode2(m) {
    var isHire = m === 'hire';
    hireFields.hidden = !isHire;
    hireFields.disabled = !isHire;
    eventFields.hidden = isHire;
    eventFields.disabled = isHire;
    update();
  }

  form.addEventListener('input', update);
  form.addEventListener('change', function (e) {
    if (e.target && e.target.name === 'mode') setMode2(mode()); else update();
  });

  /* Pre-select from links such as booking.html?event=winter-cup or ?facility=pitch */
  try {
    var qs = new URLSearchParams(window.location.search);
    var ev = qs.get('event');
    var fac = qs.get('facility');
    if (ev && D.events[ev]) {
      setMode('event');
      eventSel.value = ev;
    } else if (fac && D.facilities[fac]) {
      setMode('hire');
      facility.value = fac;
    }
  } catch (e) { /* older browsers: keep the defaults */ }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var result = update();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (!result) { showError('Check your choices, then try again.'); return; }

    var cur = selection();
    var payload = {
      mode: cur.mode,
      sel: cur.sel,
      person: {
        name: $('name').value.trim(),
        email: $('email').value.trim(),
        phone: $('phone').value.trim(),
        notes: $('notes').value.trim()
      },
      created: new Date().toISOString()
    };
    try {
      window.sessionStorage.setItem('nb-booking', JSON.stringify(payload));
    } catch (err) {
      showError('Your browser is blocking storage, so we cannot show your summary. Please call 020 7946 0123 to book.');
      return;
    }
    window.location.href = 'confirmation.html';
  });

  setMode2(mode());
}());
