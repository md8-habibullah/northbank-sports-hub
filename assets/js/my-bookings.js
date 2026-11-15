/* My bookings: lists the bookings saved in this browser, and lets you search,
   add to a calendar, and cancel them under the terms and conditions. */
(function () {
  'use strict';

  var D = window.NB_DATA;
  var NB = window.NB;
  var Store = window.NBStore;
  var Cal = window.NBCalendar;
  var upcomingBox = document.getElementById('bk-upcoming');
  if (!upcomingBox || !D || !NB || !Store) return;

  var pastBox = document.getElementById('bk-past');
  var upcomingList = document.getElementById('bk-upcoming-list');
  var pastList = document.getElementById('bk-past-list');
  var emptyBox = document.getElementById('bk-empty');
  var noMatch = document.getElementById('bk-nomatch');
  var search = document.getElementById('bk-search');
  var message = document.getElementById('bk-message');
  var resetBtn = document.getElementById('reset-btn');
  var resetPanel = document.getElementById('reset-panel');
  var resetYes = document.getElementById('reset-yes');
  var resetNo = document.getElementById('reset-no');

  if (!Store.persistent) document.getElementById('storage-warning').hidden = false;

  function whenText(b) {
    if (b.type === 'hire') {
      return NB.formatDate(b.sel.date) + ', ' + NB.pad(b.sel.start) + ':00 to ' + NB.pad(b.sel.start + b.sel.hours) + ':00';
    }
    var ev = D.events[b.sel.event];
    var day = ev.date === ev.endDate ? NB.formatDate(ev.date) : NB.formatDate(ev.date) + ' to ' + NB.formatDate(ev.endDate);
    return day + ', ' + ev.startTime + ' to ' + ev.endTime;
  }

  function whatText(b) {
    if (b.type === 'hire') {
      var f = D.facilities[b.sel.facility];
      return b.sel.units + ' ' + NB.plural(f.unit, b.sel.units) + (b.sel.equipment ? ', with equipment pack' : '');
    }
    return b.lines.map(function (l) { return l.label; }).join('; ');
  }

  function meta(term, value) {
    return NB.el('div', null, [NB.el('dt', { text: term }), NB.el('dd', { text: value })]);
  }

  function statusOf(b) {
    if (b.status === 'cancelled') return { key: 'cancelled', text: 'Cancelled' };
    if (NB.startOf(b) <= new Date()) return { key: 'past', text: 'Completed' };
    return { key: 'confirmed', text: 'Confirmed' };
  }

  function say(text) {
    message.textContent = text;
    message.hidden = !text;
  }

  function card(b) {
    var st = statusOf(b);
    var policy = NB.cancellation(b);
    var title = b.type === 'hire' ? b.title + ' hire' : b.title;

    var panel = NB.el('div', { class: 'cancel-panel', hidden: true }, [
      NB.el('p', { text: policy.message }),
      NB.el('p', { text: 'Do you want to cancel booking ' + b.ref + '?' })
    ]);
    var yes = NB.el('button', { type: 'button', class: 'btn btn-small btn-danger', text: 'Yes, cancel this booking' });
    var no = NB.el('button', { type: 'button', class: 'btn btn-small', text: 'Keep it' });
    panel.appendChild(NB.el('div', { class: 'btn-row' }, [yes, no]));

    var actions = NB.el('div', { class: 'btn-row' }, [
      NB.el('a', { class: 'btn btn-small', href: 'confirmation.html?ref=' + encodeURIComponent(b.ref), text: 'View summary' })
    ]);
    if (st.key === 'confirmed' && Cal) {
      actions.appendChild(NB.el('button', { type: 'button', class: 'btn btn-small', text: 'Add to calendar', onclick: function () { Cal.download(b); } }));
    }
    var cancelBtn = null;
    if (policy.allowed && st.key === 'confirmed') {
      cancelBtn = NB.el('button', { type: 'button', class: 'btn btn-small', 'aria-expanded': 'false', text: 'Cancel booking' });
      actions.appendChild(cancelBtn);
      cancelBtn.addEventListener('click', function () {
        panel.hidden = false;
        cancelBtn.setAttribute('aria-expanded', 'true');
        yes.focus();
      });
      no.addEventListener('click', function () {
        panel.hidden = true;
        cancelBtn.setAttribute('aria-expanded', 'false');
        cancelBtn.focus();
      });
      yes.addEventListener('click', function () {
        Store.bookings.update(b.ref, { status: 'cancelled', cancelledAt: new Date().toISOString(), fee: policy.fee });
        say('Booking ' + b.ref + ' cancelled. ' + (policy.fee ? NB.money(policy.fee) + ' is still payable at the front desk.' : 'Nothing to pay.') +
          ' The space is free for others again.');
        render();
        var again = document.getElementById(b.ref);
        if (again) again.focus();
      });
    }

    var note = null;
    if (b.status === 'cancelled') {
      note = 'Cancelled ' + new Date(b.cancelledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) +
        (b.fee ? '. Late cancellation fee: ' + NB.money(b.fee) + '.' : '. Nothing to pay.');
    } else if (st.key === 'confirmed') {
      note = policy.message;
    }

    return NB.el('article', { class: 'booking-card status-border-' + st.key, id: b.ref, tabindex: '-1' }, [
      NB.el('div', { class: 'booking-card-head' }, [
        NB.el('h3', { text: title }),
        NB.el('span', { class: 'status status-' + st.key, text: st.text })
      ]),
      NB.el('dl', { class: 'meta' }, [
        meta('Reference', b.ref), meta('When', whenText(b)), meta('What', whatText(b)),
        meta('Total', b.total === 0 ? 'Free' : NB.money(b.total))
      ]),
      note ? NB.el('p', { class: 'booking-note', text: note }) : null,
      actions,
      panel
    ]);
  }

  function matches(b, q) {
    if (!q) return true;
    var hay = [b.ref, b.title, b.person.name, b.person.email].join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function render() {
    var q = search.value.trim().toLowerCase();
    var all = Store.bookings.list();
    var shown = all.filter(function (b) { return matches(b, q); });
    var now = new Date();

    var upcoming = shown.filter(function (b) { return b.status === 'confirmed' && NB.startOf(b) > now; })
      .sort(function (a, c) { return NB.startOf(a) - NB.startOf(c); });
    var past = shown.filter(function (b) { return upcoming.indexOf(b) === -1; })
      .sort(function (a, c) { return NB.startOf(c) - NB.startOf(a); });

    upcomingList.textContent = '';
    pastList.textContent = '';
    upcoming.forEach(function (b) { upcomingList.appendChild(card(b)); });
    past.forEach(function (b) { pastList.appendChild(card(b)); });

    emptyBox.hidden = all.length > 0;
    noMatch.hidden = !(all.length > 0 && shown.length === 0);
    upcomingBox.hidden = upcoming.length === 0;
    pastBox.hidden = past.length === 0;
  }

  search.addEventListener('input', render);

  resetBtn.addEventListener('click', function () { resetPanel.hidden = false; resetYes.focus(); });
  resetNo.addEventListener('click', function () { resetPanel.hidden = true; resetBtn.focus(); });
  resetYes.addEventListener('click', function () {
    Store.reset();
    resetPanel.hidden = true;
    search.value = '';
    say('Demo data reset. All bookings, messages and members were cleared and the demo member NBM-0001 was restored.');
    render();
  });

  render();

  var hash = window.location.hash.replace('#', '');
  if (hash) {
    var target = document.getElementById(hash);
    if (target) { target.scrollIntoView(); target.focus(); }
  }
}());
