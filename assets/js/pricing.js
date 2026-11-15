/* Shared price rules for the booking page and the confirmation page.
   Prices come from data.js, so they always match the Prices page. */
(function () {
  'use strict';

  var D = window.NB_DATA;
  if (!D) return;

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function money(n) {
    var r = Math.round(n * 100) / 100;
    return '£' + (r % 1 === 0 ? r.toFixed(0) : r.toFixed(2));
  }

  /* Show a line amount: 0 reads as Free, discounts read as a minus */
  function fmt(n) {
    if (n === 0) return 'Free';
    return n < 0 ? '−' + money(-n) : money(n);
  }

  function parseDate(s) {
    var p = String(s).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function addDays(s, days) {
    var d = parseDate(s);
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function isWeekend(s) {
    var day = parseDate(s).getDay();
    return day === 0 || day === 6;
  }

  function formatDate(s) {
    return parseDate(s).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  function plural(unit, n) {
    if (n === 1) return unit;
    return unit === 'pitch' ? 'pitches' : unit + 's';
  }

  /* Returns null when the slot is fine, or {field, message} when it is not */
  function slotProblem(date, start, hours) {
    if (date < todayStr()) {
      return { field: 'date', message: 'Choose today or a later date.' };
    }
    if (D.closedDates.indexOf(date) !== -1) {
      return { field: 'date', message: 'We are closed on 25 and 26 December. Choose another date.' };
    }
    var h = isWeekend(date) ? D.hours.weekend : D.hours.weekday;
    if (start < h.open || start + hours > h.close) {
      return {
        field: 'start',
        message: (isWeekend(date) ? 'At weekends' : 'Monday to Friday') + ' we are open ' +
          pad(h.open) + ':00 to ' + pad(h.close) + ':00. Choose a start time and length that finish by ' +
          pad(h.close) + ':00.'
      };
    }
    return null;
  }

  /* Facility hire. sel: {facility, date, start, hours, units, equipment, member} */
  function hire(sel) {
    var f = D.facilities[sel.facility];
    if (!f || !sel.date || !sel.start || !sel.hours || !sel.units || sel.units > f.max) return null;

    var weekend = isWeekend(sel.date);
    var off = 0;
    var peak = 0;
    for (var i = 0; i < sel.hours; i++) {
      if (weekend || sel.start + i >= D.peakFrom) peak++; else off++;
    }

    var lines = [];
    var subtotal = 0;
    var unitWord = plural(f.unit, sel.units);

    function add(count, rate, name) {
      if (!count) return;
      var amount = count * rate * sel.units;
      subtotal += amount;
      lines.push({
        label: count + ' ' + name + ' hour' + (count > 1 ? 's' : '') + ', ' + sel.units + ' ' + unitWord + ' at ' + money(rate),
        amount: amount
      });
    }
    add(off, f.offpeak, 'off-peak');
    add(peak, f.peak, 'peak');

    var total = subtotal;
    if (sel.member) {
      var discount = Math.round(subtotal * D.memberDiscount * 100) / 100;
      total -= discount;
      lines.push({ label: 'Member discount, ' + Math.round(D.memberDiscount * 100) + '% off hire', amount: -discount });
    }
    if (sel.equipment) {
      total += D.equipment;
      lines.push({ label: 'Equipment pack', amount: D.equipment });
    }
    return { title: f.name, lines: lines, total: total };
  }

  /* Event tickets and entries. sel: {event, adult, concession, family, under12, entries} */
  function tickets(sel) {
    var ev = D.events[sel.event];
    if (!ev) return null;

    var lines = [];
    var total = 0;
    var count = 0;

    ['adult', 'concession', 'family', 'under12'].forEach(function (key) {
      var n = parseInt(sel[key], 10) || 0;
      if (n <= 0) return;
      var t = D.tickets[key];
      var amount = ev.free ? 0 : n * t.price;
      total += amount;
      count += n;
      lines.push({ label: n + ' × ' + t.label + ' ticket' + (n > 1 ? 's' : ''), amount: amount });
    });

    var entries = parseInt(sel.entries, 10) || 0;
    if (entries > 0 && ev.entry) {
      var amountEntry = entries * ev.entry.price;
      total += amountEntry;
      count += entries;
      lines.push({
        label: entries + ' ' + (entries > 1 ? ev.entry.plural : ev.entry.unit) + ' entering at ' + money(ev.entry.price),
        amount: amountEntry
      });
    }
    return { title: ev.name, lines: lines, total: total, count: count };
  }

  /* The moment a booking starts, as a Date */
  function startOf(b) {
    var d;
    if (b.type === 'hire') {
      d = parseDate(b.sel.date);
      d.setHours(b.sel.start, 0, 0, 0);
    } else {
      var ev = D.events[b.sel.event];
      var t = ev.startTime.split(':');
      d = parseDate(ev.date);
      d.setHours(+t[0], +t[1], 0, 0);
    }
    return d;
  }

  /* Cancellation rules from the terms page: hire needs 48 hours' notice, events 7 days'.
     Later than that, the booking can still be cancelled but the full price is still due. */
  function cancellation(b, now) {
    if (b.status === 'cancelled') return { allowed: false, message: 'This booking is already cancelled.' };
    var hoursLeft = (startOf(b) - (now || new Date())) / 3600000;
    if (hoursLeft <= 0) {
      return { allowed: false, message: 'This booking has already started or finished, so it cannot be cancelled.' };
    }
    var notice = b.type === 'hire' ? 48 : 168;
    var noticeText = b.type === 'hire' ? '48 hours' : '7 days';
    if (hoursLeft >= notice) {
      return { allowed: true, fee: 0, message: 'Free cancellation: you are more than ' + noticeText + ' ahead.' };
    }
    return {
      allowed: true,
      fee: b.total,
      message: 'Late cancellation: it is less than ' + noticeText + ' away, so ' +
        (b.total ? money(b.total) + ' is still payable at the front desk.' : 'nothing is payable, but please free the place for others.')
    };
  }

  /* Tiny helper for building page content safely: text always goes in as text, never as HTML */
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (k === 'text') n.textContent = v;
        else if (k === 'class') n.className = v;
        else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
        else if (v === true) n.setAttribute(k, '');
        else if (v !== false && v !== null && v !== undefined) n.setAttribute(k, v);
      });
    }
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  window.NB = {
    money: money, fmt: fmt, pad: pad, parseDate: parseDate, todayStr: todayStr, addDays: addDays,
    isWeekend: isWeekend, formatDate: formatDate, plural: plural,
    slotProblem: slotProblem, hire: hire, tickets: tickets,
    startOf: startOf, cancellation: cancellation, el: el
  };
}());
