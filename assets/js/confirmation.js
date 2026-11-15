/* Confirmation page: rebuilds the booking summary from the browser's session storage.
   The price is recalculated here from the shared price data, not read from the form. */
(function () {
  'use strict';

  var D = window.NB_DATA;
  var NB = window.NB;
  var found = document.getElementById('confirmation');
  var missing = document.getElementById('no-booking');
  if (!found || !missing || !D || !NB) return;

  var payload = null;
  try {
    var raw = window.sessionStorage.getItem('nb-booking');
    payload = raw ? JSON.parse(raw) : null;
  } catch (e) { payload = null; }

  var result = null;
  if (payload && payload.sel) {
    result = payload.mode === 'hire' ? NB.hire(payload.sel) : NB.tickets(payload.sel);
  }
  if (!result) {
    missing.hidden = false;
    return;
  }

  function makeRef(seed) {
    var h = 5381;
    for (var i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
    var s = h.toString(36).toUpperCase();
    while (s.length < 6) s = '0' + s;
    return 'NB-' + s.slice(-6);
  }

  function add(dl, term, value) {
    if (!value) return;
    var wrap = document.createElement('div');
    var dt = document.createElement('dt');
    var dd = document.createElement('dd');
    dt.textContent = term;
    dd.textContent = value;
    wrap.appendChild(dt);
    wrap.appendChild(dd);
    dl.appendChild(wrap);
  }

  var sel = payload.sel;
  var person = payload.person || {};
  var details = document.getElementById('summary-details');
  var f;

  if (payload.mode === 'hire') {
    f = D.facilities[sel.facility];
    add(details, 'What you booked', f.name + ' hire');
    add(details, 'Date', NB.formatDate(sel.date));
    add(details, 'Time', NB.pad(sel.start) + ':00 to ' + NB.pad(sel.start + sel.hours) + ':00 (' +
      sel.hours + ' hour' + (sel.hours > 1 ? 's' : '') + ')');
    add(details, 'How many', sel.units + ' ' + NB.plural(f.unit, sel.units));
    add(details, 'Extras', sel.equipment ? 'Equipment pack' : 'None');
    if (sel.member) add(details, 'Membership', 'Member discount applied. Bring your membership card.');
  } else {
    var ev = D.events[sel.event];
    add(details, 'What you booked', ev.name);
    add(details, 'Date', NB.formatDate(ev.date));
  }
  add(details, 'Name', person.name);
  add(details, 'Email', person.email);
  add(details, 'Phone', person.phone);
  add(details, 'Notes', person.notes);

  var list = document.getElementById('summary-lines');
  result.lines.forEach(function (l) {
    var li = document.createElement('li');
    var a = document.createElement('span');
    var b = document.createElement('span');
    a.textContent = l.label;
    b.textContent = NB.fmt(l.amount);
    li.appendChild(a);
    li.appendChild(b);
    list.appendChild(li);
  });
  document.getElementById('summary-total').textContent = result.total === 0 ? 'Free' : NB.money(result.total);
  document.getElementById('reference').textContent = makeRef((payload.created || '') + (person.name || '') + (person.email || ''));

  found.hidden = false;

  var print = document.getElementById('print-btn');
  if (print) print.addEventListener('click', function () { window.print(); });
}());
