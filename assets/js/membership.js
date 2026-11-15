/* Membership sign-up on the prices page. It creates a member number and saves it in the
   browser store; the booking form then checks member numbers against the same list.
   No payment is taken. */
(function () {
  'use strict';

  var D = window.NB_DATA;
  var Store = window.NBStore;
  var form = document.getElementById('join-form');
  if (!form || !D || !Store) return;

  var done = document.getElementById('join-success');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (!Store.persistent) {
      done.className = 'form-error';
      done.textContent = 'Your browser is blocking site storage, so the membership cannot be saved. Allow site data for this page and try again.';
      done.hidden = false;
      return;
    }

    var record = Store.members.add({
      plan: form.elements.plan.value,
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim()
    });
    var plan = D.plans[record.plan];

    done.className = 'form-ok';
    done.textContent = '';
    var title = document.createElement('h3');
    title.textContent = 'Welcome, ' + record.name;
    var number = document.createElement('p');
    number.appendChild(document.createTextNode('Your member number is '));
    var strong = document.createElement('strong');
    strong.className = 'member-number';
    strong.textContent = record.number;
    number.appendChild(strong);
    number.appendChild(document.createTextNode(' (' + plan.label + ' plan).'));
    var how = document.createElement('p');
    how.appendChild(document.createTextNode('Type it into the member number box when you '));
    var link = document.createElement('a');
    link.href = 'booking.html';
    link.textContent = 'book a facility';
    how.appendChild(link);
    how.appendChild(document.createTextNode(' to take 15% off hire. This is a demonstration, so no payment was taken and the number only works in this browser.'));
    done.appendChild(title);
    done.appendChild(number);
    done.appendChild(how);
    done.hidden = false;
    form.hidden = true;
    done.focus();
  });
}());
