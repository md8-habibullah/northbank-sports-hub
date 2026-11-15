/* Calendar export: turns a booking into an .ics file that opens in Google Calendar,
   Apple Calendar, Outlook and others. The file is built in the browser. */
(function () {
  'use strict';

  var D = window.NB_DATA;
  var NB = window.NB;
  if (!D || !NB) return;

  var PLACE = 'Northbank Sports Hub, 12 Riverside Walk, Northbank, NB1 4AB';

  function stamp(dateStr, hour, minute) {
    return dateStr.replace(/-/g, '') + 'T' + NB.pad(hour) + NB.pad(minute) + '00';
  }

  function utcNow() {
    var d = new Date();
    return d.getUTCFullYear() + NB.pad(d.getUTCMonth() + 1) + NB.pad(d.getUTCDate()) + 'T' +
      NB.pad(d.getUTCHours()) + NB.pad(d.getUTCMinutes()) + NB.pad(d.getUTCSeconds()) + 'Z';
  }

  function clean(text) {
    return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }

  function parseTime(text) {
    var p = text.split(':');
    return { h: +p[0], m: +p[1] };
  }

  /* The list of {summary, start, end} slots a booking covers (a two-day event gives two) */
  function slots(b) {
    if (b.type === 'hire') {
      var f = D.facilities[b.sel.facility];
      return [{
        summary: f.name + ' hire',
        start: stamp(b.sel.date, b.sel.start, 0),
        end: stamp(b.sel.date, b.sel.start + b.sel.hours, 0)
      }];
    }
    var ev = D.events[b.sel.event];
    var s = parseTime(ev.startTime);
    var e = parseTime(ev.endTime);
    var out = [];
    var day = ev.date;
    while (day <= ev.endDate) {
      out.push({ summary: ev.name, start: stamp(day, s.h, s.m), end: stamp(day, e.h, e.m) });
      day = NB.addDays(day, 1);
    }
    return out;
  }

  function build(b) {
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Northbank Sports Hub//Booking//EN', 'CALSCALE:GREGORIAN'];
    slots(b).forEach(function (s, i) {
      lines.push(
        'BEGIN:VEVENT',
        'UID:' + b.ref + '-' + i + '@northbank-hub.example',
        'DTSTAMP:' + utcNow(),
        'DTSTART:' + s.start,
        'DTEND:' + s.end,
        'SUMMARY:' + clean(s.summary),
        'LOCATION:' + clean(PLACE),
        'DESCRIPTION:' + clean('Booking reference ' + b.ref + '. Pay at the front desk when you arrive.'),
        'END:VEVENT'
      );
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }

  function download(b) {
    var blob = new Blob([build(b)], { type: 'text/calendar;charset=utf-8' });
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = b.ref + '.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { window.URL.revokeObjectURL(url); }, 1000);
  }

  window.NBCalendar = { build: build, download: download };
}());
