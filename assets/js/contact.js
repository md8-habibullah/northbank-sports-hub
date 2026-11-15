/* Contact form: saves the message in the browser store, where the staff dashboard can read it.
   Nothing is emailed or sent anywhere. */
(function () {
  'use strict';

  var Store = window.NBStore;
  var form = document.querySelector('form[data-demo-form]');
  var done = document.getElementById('contact-success');
  if (!form || !done || !Store) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    var name = form.elements['contact-name'].value.trim();
    Store.messages.add({
      name: name,
      email: form.elements['contact-email'].value.trim(),
      topic: form.elements.topic.value,
      message: form.elements.message.value.trim()
    });

    var who = done.querySelector('[data-name]');
    if (who) who.textContent = name || 'there';
    done.hidden = false;
    form.hidden = true;
    done.focus();
  });
}());
