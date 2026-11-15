/* Events page: shows how many places are left for each event, and marks finished events.
   Numbers come from the seeded sales in data.js plus any bookings saved in this browser. */
(function () {
  'use strict';

  var D = window.NB_DATA;
  var Avail = window.NBAvail;
  var NB = window.NB;
  if (!D || !Avail || !NB) return;

  var lines = document.querySelectorAll('[data-places]');
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var id = line.getAttribute('data-places');
    var ev = D.events[id];
    var st = Avail.eventStatus(id);
    if (!ev || !st) continue;

    var article = line.closest('article');
    var button = article ? article.querySelector('.fixture-side .btn') : null;

    if (st.finished) {
      line.textContent = 'This event has finished.';
      line.className = 'places places-full';
      if (button) button.hidden = true;
      continue;
    }

    var parts = [st.spectatorsLeft + ' to watch'];
    var low = st.spectatorsLeft <= 20;
    if (ev.entry) {
      if (st.entriesLeft === 0) {
        parts.push('entries full');
        low = true;
      } else {
        parts.push(st.entriesLeft + ' to play');
        if (st.entriesLeft <= 3) low = true;
      }
    }
    line.textContent = 'Places left: ' + parts.join(', ') + '.';
    line.className = 'places' + (low ? ' places-low' : '');
  }
}());
