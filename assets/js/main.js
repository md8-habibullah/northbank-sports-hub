/* Northbank Sports Hub: navigation, event filter, contact form demo, footer year.
   Every page works without this file; it only adds convenience. */
(function () {
  'use strict';

  /* ---- Mobile navigation ---------------------------------------------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) setOpen(false);
    });
  }

  /* ---- Footer year ----------------------------------------------------- */
  var years = document.querySelectorAll('[data-year]');
  for (var i = 0; i < years.length; i++) years[i].textContent = String(new Date().getFullYear());

  /* ---- Events filter ---------------------------------------------------- */
  var filter = document.querySelector('[data-filter]');
  if (filter) {
    var buttons = filter.querySelectorAll('button[data-sport]');
    var items = document.querySelectorAll('[data-event]');
    var status = document.getElementById('filter-status');

    var apply = function (sport) {
      var shown = 0;
      for (var b = 0; b < buttons.length; b++) {
        buttons[b].setAttribute('aria-pressed', String(buttons[b].getAttribute('data-sport') === sport));
      }
      for (var n = 0; n < items.length; n++) {
        var match = sport === 'all' || items[n].getAttribute('data-sport') === sport;
        items[n].hidden = !match;
        if (match) shown++;
      }
      if (status) {
        status.textContent = 'Showing ' + shown + ' of ' + items.length + ' events' +
          (sport === 'all' ? '.' : ' for ' + sport + '.');
      }
    };

    for (var k = 0; k < buttons.length; k++) {
      buttons[k].addEventListener('click', function () {
        apply(this.getAttribute('data-sport'));
      });
    }
  }

  /* ---- Contact form (demo: nothing is sent) ----------------------------- */
  var contact = document.querySelector('form[data-demo-form]');
  if (contact) {
    var done = document.getElementById('contact-success');
    contact.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!contact.checkValidity()) {
        contact.reportValidity();
        return;
      }
      var name = (contact.elements.name && contact.elements.name.value || '').trim();
      var who = done.querySelector('[data-name]');
      if (who) who.textContent = name || 'there';
      done.hidden = false;
      contact.hidden = true;
      done.focus();
    });
  }
}());
