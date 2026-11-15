/* Booking summary page. The reference in the address (confirmation.html?ref=NB-XXXXXX)
   is looked up in the browser store, so the page still works after a reload or a later visit. */
(function () {
  'use strict';

  var D = window.NB_DATA;
  var NB = window.NB;
  var Store = window.NBStore;
  var Cal = window.NBCalendar;
  var found = document.getElementById('confirmation');
  var missing = document.getElementById('no-booking');
  if (!found || !missing || !D || !NB || !Store) return;

  var ref = '';
  try { ref = new URLSearchParams(window.location.search).get('ref') || ''; } catch (e) { ref = ''; }
  var b = ref ? Store.bookings.find(ref) : null;
  if (!b) {
    missing.hidden = false;
    return;
  }

  var details = document.getElementById('summary-details');
  function add(term, value) {
    if (!value) return;
    details.appendChild(NB.el('div', null, [NB.el('dt', { text: term }), NB.el('dd', { text: value })]));
  }

  document.getElementById('reference').textContent = b.ref;

  var status = document.getElementById('status-line');
  status.textContent = b.status === 'cancelled' ? 'Cancelled' : 'Confirmed';
  status.className = 'status status-' + b.status;

  if (b.type === 'hire') {
    var f = D.facilities[b.sel.facility];
    add('What you booked', f.name + ' hire');
    add('Date', NB.formatDate(b.sel.date));
    add('Time', NB.pad(b.sel.start) + ':00 to ' + NB.pad(b.sel.start + b.sel.hours) + ':00 (' +
      b.sel.hours + ' hour' + (b.sel.hours > 1 ? 's' : '') + ')');
    add('How many', b.sel.units + ' ' + NB.plural(f.unit, b.sel.units));
    add('Extras', b.sel.equipment ? 'Equipment pack' : 'None');
    if (b.sel.memberNumber) add('Member number', b.sel.memberNumber + '. Bring your membership card.');
  } else {
    var ev = D.events[b.sel.event];
    add('What you booked', ev.name);
    add('Date', ev.date === ev.endDate
      ? NB.formatDate(ev.date)
      : NB.formatDate(ev.date) + ' to ' + NB.formatDate(ev.endDate));
    add('Time', ev.startTime + ' to ' + ev.endTime + (ev.date === ev.endDate ? '' : ' each day'));
    add('Where', ev.where);
  }
  add('Name', b.person.name);
  add('Email', b.person.email);
  add('Phone', b.person.phone);
  add('Notes', b.person.notes);
  add('Booked on', new Date(b.created).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' }));

  var list = document.getElementById('summary-lines');
  b.lines.forEach(function (l) {
    list.appendChild(NB.el('li', null, [NB.el('span', { text: l.label }), NB.el('span', { text: NB.fmt(l.amount) })]));
  });
  document.getElementById('summary-total').textContent = b.total === 0 ? 'Free' : NB.money(b.total);

  var policy = NB.cancellation(b);
  var note = document.getElementById('cancel-note');
  if (b.status === 'cancelled') {
    note.textContent = 'This booking was cancelled' + (b.fee ? '. ' + NB.money(b.fee) + ' is still payable as a late cancellation fee.' : ' with nothing to pay.');
  } else {
    note.textContent = policy.message;
  }

  document.getElementById('manage-link').setAttribute('href', 'my-bookings.html#' + b.ref);

  var calBtn = document.getElementById('cal-btn');
  if (b.status === 'cancelled' || !Cal) {
    calBtn.hidden = true;
  } else {
    calBtn.addEventListener('click', function () { Cal.download(b); });
  }

  var print = document.getElementById('print-btn');
  if (print) print.addEventListener('click', function () { window.print(); });

  found.hidden = false;
}());
