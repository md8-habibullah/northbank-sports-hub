/* Staff dashboard (demonstration).
   It reads the same browser store as the booking form, which stands in for the database a
   real site would have on a server. A real version would sit behind a staff login. */
(function () {
  'use strict';

  var D = window.NB_DATA;
  var NB = window.NB;
  var Store = window.NBStore;
  var Avail = window.NBAvail;
  var statsBox = document.getElementById('stats');
  if (!statsBox || !D || !NB || !Store || !Avail) return;

  var el = NB.el;
  var bookingBody = document.getElementById('st-bookings');
  var eventBody = document.getElementById('st-events');
  var messageList = document.getElementById('st-messages');
  var memberBody = document.getElementById('st-members');
  var fStatus = document.getElementById('f-status');
  var fType = document.getElementById('f-type');
  var fSearch = document.getElementById('f-search');
  var note = document.getElementById('st-note');

  if (!Store.persistent) document.getElementById('storage-warning').hidden = false;

  function say(text) { note.textContent = text; note.hidden = !text; }

  function when(b) {
    if (b.type === 'hire') return NB.formatDate(b.sel.date).replace(/^\w+, /, '') + ', ' + NB.pad(b.sel.start) + ':00 to ' + NB.pad(b.sel.start + b.sel.hours) + ':00';
    var ev = D.events[b.sel.event];
    return NB.formatDate(ev.date).replace(/^\w+, /, '') + ', ' + ev.startTime;
  }

  function stat(label, value) {
    return el('div', null, [el('dt', { text: label }), el('dd', { text: value })]);
  }

  function renderStats() {
    var all = Store.bookings.list();
    var confirmed = all.filter(function (b) { return b.status === 'confirmed'; });
    var cancelled = all.filter(function (b) { return b.status === 'cancelled'; });
    var expected = confirmed.reduce(function (sum, b) { return sum + b.total; }, 0) +
      cancelled.reduce(function (sum, b) { return sum + (b.fee || 0); }, 0);
    var unread = Store.messages.list().filter(function (m) { return m.status === 'new'; }).length;
    statsBox.textContent = '';
    [
      stat('Bookings', String(all.length)),
      stat('Confirmed', String(confirmed.length)),
      stat('Cancelled', String(cancelled.length)),
      stat('Takings at the desk', NB.money(expected)),
      stat('Unread messages', String(unread)),
      stat('Members', String(Store.members.list().length))
    ].forEach(function (n) { statsBox.appendChild(n); });
  }

  function cell(label, content, cls) {
    var td = el('td', { 'data-label': label, class: cls || null });
    if (typeof content === 'string') td.textContent = content; else td.appendChild(content);
    return td;
  }

  function renderBookings() {
    var q = fSearch.value.trim().toLowerCase();
    var rows = Store.bookings.list().filter(function (b) {
      if (fStatus.value && b.status !== fStatus.value) return false;
      if (fType.value && b.type !== fType.value) return false;
      if (q && [b.ref, b.title, b.person.name, b.person.email].join(' ').toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, c) { return c.created < a.created ? -1 : 1; });

    bookingBody.textContent = '';
    document.getElementById('st-bookings-empty').hidden = rows.length > 0;
    document.getElementById('st-bookings-wrap').hidden = rows.length === 0;

    rows.forEach(function (b) {
      var actions = el('div', { class: 'btn-row btn-row-tight' });
      if (b.status === 'confirmed') {
        actions.appendChild(el('button', {
          type: 'button', class: 'btn btn-small',
          text: b.checkedIn ? 'Checked in' : 'Check in', disabled: !!b.checkedIn,
          onclick: function () { Store.bookings.update(b.ref, { checkedIn: new Date().toISOString() }); say(b.ref + ' checked in.'); refresh(); }
        }));
        actions.appendChild(el('button', {
          type: 'button', class: 'btn btn-small', text: 'Cancel',
          onclick: function () {
            Store.bookings.update(b.ref, { status: 'cancelled', cancelledAt: new Date().toISOString(), fee: 0, cancelledBy: 'staff' });
            say(b.ref + ' cancelled by staff. The space is free again.');
            refresh();
          }
        }));
      }
      bookingBody.appendChild(el('tr', null, [
        el('th', { scope: 'row', 'data-label': 'Reference', text: b.ref }),
        cell('Customer', el('span', null, [b.person.name, el('br'), el('span', { class: 'cell-sub', text: b.person.email })])),
        cell('Booking', b.type === 'hire' ? b.title + ' hire' : b.title),
        cell('When', when(b)),
        cell('Total', b.total === 0 ? 'Free' : NB.money(b.total), 'num'),
        cell('Status', b.status === 'cancelled' ? 'Cancelled' + (b.fee ? ' (fee ' + NB.money(b.fee) + ')' : '') : (b.checkedIn ? 'Checked in' : 'Confirmed')),
        cell('Actions', actions.childNodes.length ? actions : 'None')
      ]));
    });
  }

  function renderEvents() {
    eventBody.textContent = '';
    Object.keys(D.events).forEach(function (id) {
      var ev = D.events[id];
      var st = Avail.eventStatus(id);
      var spectators = st.spectatorsSold + ' of ' + ev.capacity.spectators;
      var entries = ev.entry ? st.entriesSold + ' of ' + ev.capacity.entries + (st.entriesLeft === 0 ? ' (full)' : '') : 'No open entries';
      eventBody.appendChild(el('tr', null, [
        el('th', { scope: 'row', 'data-label': 'Event', text: ev.name }),
        cell('Date', NB.formatDate(ev.date).replace(/^\w+, /, '') + (st.finished ? ' (finished)' : '')),
        cell('Spectators', spectators),
        cell('Entries', entries)
      ]));
    });
  }

  function renderMessages() {
    var list = Store.messages.list().sort(function (a, c) { return c.created < a.created ? -1 : 1; });
    messageList.textContent = '';
    document.getElementById('st-messages-empty').hidden = list.length > 0;
    list.forEach(function (m) {
      var actions = el('div', { class: 'btn-row btn-row-tight' }, [
        m.status === 'new' ? el('button', { type: 'button', class: 'btn btn-small', text: 'Mark as read', onclick: function () { Store.messages.update(m.id, { status: 'read' }); refresh(); } }) : null,
        el('button', { type: 'button', class: 'btn btn-small', text: 'Delete', onclick: function () { Store.messages.remove(m.id); say('Message deleted.'); refresh(); } })
      ]);
      messageList.appendChild(el('li', { class: 'message' + (m.status === 'new' ? ' message-new' : '') }, [
        el('p', { class: 'message-head' }, [
          el('strong', { text: m.topic + ' from ' + m.name }),
          ' ',
          el('span', { class: 'status status-' + (m.status === 'new' ? 'confirmed' : 'past'), text: m.status === 'new' ? 'New' : 'Read' })
        ]),
        el('p', { class: 'message-meta', text: m.email + ', ' + new Date(m.created).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) }),
        el('p', { class: 'message-body', text: m.message }),
        actions
      ]));
    });
  }

  function renderMembers() {
    memberBody.textContent = '';
    Store.members.list().forEach(function (m) {
      var plan = D.plans[m.plan] ? D.plans[m.plan].label : m.plan;
      memberBody.appendChild(el('tr', null, [
        el('th', { scope: 'row', 'data-label': 'Number', text: m.number + (m.demo ? ' (demo)' : '') }),
        cell('Name', m.name),
        cell('Plan', plan),
        cell('Joined', new Date(m.joined).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))
      ]));
    });
  }

  /* Spreadsheets run text that starts with = + - or @ as a formula, so defuse those cells */
  function csvCell(value) {
    var s = String(value === null || value === undefined ? '' : value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function exportCsv() {
    var head = ['Reference', 'Status', 'Type', 'Booking', 'Date', 'Name', 'Email', 'Phone', 'Total (GBP)', 'Late fee (GBP)', 'Booked on'];
    var rows = Store.bookings.list().map(function (b) {
      return [b.ref, b.status, b.type, b.title, b.date, b.person.name, b.person.email, b.person.phone, b.total, b.fee || 0, b.created];
    });
    var csv = [head].concat(rows).map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'northbank-bookings.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { window.URL.revokeObjectURL(url); }, 1000);
    say('Exported ' + rows.length + ' booking' + (rows.length === 1 ? '' : 's') + ' to northbank-bookings.csv.');
  }

  function refresh() {
    renderStats();
    renderBookings();
    renderEvents();
    renderMessages();
    renderMembers();
  }

  [fStatus, fType].forEach(function (c) { c.addEventListener('change', renderBookings); });
  fSearch.addEventListener('input', renderBookings);
  document.getElementById('export-btn').addEventListener('click', exportCsv);

  var resetBtn = document.getElementById('reset-btn');
  var resetPanel = document.getElementById('reset-panel');
  resetBtn.addEventListener('click', function () { resetPanel.hidden = false; document.getElementById('reset-yes').focus(); });
  document.getElementById('reset-no').addEventListener('click', function () { resetPanel.hidden = true; resetBtn.focus(); });
  document.getElementById('reset-yes').addEventListener('click', function () {
    Store.reset();
    resetPanel.hidden = true;
    say('Demo data reset. All bookings, messages and members were cleared and the demo member NBM-0001 was restored.');
    refresh();
  });

  refresh();
}());
