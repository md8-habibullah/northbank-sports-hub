/* Project Q&A page: live search, expand and collapse all, and links straight to a question. */
(function () {
  'use strict';

  var search = document.getElementById('qa-search');
  if (!search) return;

  var items = Array.prototype.slice.call(document.querySelectorAll('details.qa-item'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('.qa-group'));
  var count = document.getElementById('qa-count');
  var none = document.getElementById('qa-none');

  items.forEach(function (item) { item.setAttribute('data-text', item.textContent.toLowerCase()); });

  function update() {
    var terms = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    var shown = 0;
    items.forEach(function (item) {
      var text = item.getAttribute('data-text');
      var match = terms.every(function (t) { return text.indexOf(t) !== -1; });
      item.hidden = !match;
      if (match) shown++;
    });
    groups.forEach(function (g) {
      g.hidden = g.querySelectorAll('details.qa-item:not([hidden])').length === 0;
    });
    items.forEach(function (item) {
      if (terms.length && !item.hidden && shown <= 6) item.open = true;
    });
    count.textContent = terms.length
      ? 'Showing ' + shown + ' of ' + items.length + ' questions.'
      : items.length + ' questions in ' + groups.length + ' topics.';
    none.hidden = shown > 0;
  }

  search.addEventListener('input', update);

  document.getElementById('qa-open').addEventListener('click', function () {
    items.forEach(function (i) { if (!i.hidden) i.open = true; });
  });
  document.getElementById('qa-close').addEventListener('click', function () {
    items.forEach(function (i) { i.open = false; });
  });

  /* qa.html#some-question opens and shows that question */
  function openFromHash() {
    var id = window.location.hash.replace('#', '');
    if (!id) return;
    var target = document.getElementById(id);
    if (target && target.tagName === 'DETAILS') {
      target.open = true;
      target.scrollIntoView();
    }
  }
  window.addEventListener('hashchange', openFromHash);

  update();
  openFromHash();
}());
