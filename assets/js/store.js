/* The Hub's "back end", kept inside the browser.
   Bookings, members and messages are saved in localStorage as JSON, so they survive
   reloads and closing the tab. If the browser blocks storage (some private windows),
   everything still works but is kept in memory until the page is closed.
   Nothing here is ever sent to a server. */
(function () {
  'use strict';

  var PREFIX = 'nb:';
  var memory = {};
  var persistent = true;

  try {
    window.localStorage.setItem(PREFIX + 'probe', '1');
    window.localStorage.removeItem(PREFIX + 'probe');
  } catch (e) {
    persistent = false;
  }

  function read(key, fallback) {
    var raw = memory[key];
    if (persistent) {
      try { raw = window.localStorage.getItem(PREFIX + key); } catch (e) { raw = memory[key]; }
    }
    if (raw === null || raw === undefined) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function write(key, value) {
    var raw = JSON.stringify(value);
    if (persistent) {
      try { window.localStorage.setItem(PREFIX + key, raw); return true; } catch (e) { persistent = false; }
    }
    memory[key] = raw;
    return false;
  }

  function collection(name) {
    var value = read(name, []);
    return Array.isArray(value) ? value : [];
  }

  /* Codes avoid look-alike characters (no 0/O, 1/I/L) so they are easy to read out */
  var ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  function randomCode(length) {
    var out = '';
    var bytes = new Uint32Array(length);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 4294967296);
    }
    for (var j = 0; j < length; j++) out += ALPHABET.charAt(bytes[j] % ALPHABET.length);
    return out;
  }

  function same(a, b) {
    return String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();
  }

  /* ---- Bookings ------------------------------------------------------- */
  var bookings = {
    list: function () { return collection('bookings'); },
    find: function (ref) {
      var all = collection('bookings');
      for (var i = 0; i < all.length; i++) if (same(all[i].ref, ref)) return all[i];
      return null;
    },
    makeRef: function () {
      var ref;
      do { ref = 'NB-' + randomCode(6); } while (bookings.find(ref));
      return ref;
    },
    add: function (booking) {
      var all = collection('bookings');
      all.push(booking);
      return write('bookings', all);
    },
    update: function (ref, patch) {
      var all = collection('bookings');
      for (var i = 0; i < all.length; i++) {
        if (same(all[i].ref, ref)) {
          for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) all[i][k] = patch[k];
          write('bookings', all);
          return all[i];
        }
      }
      return null;
    },
    remove: function (ref) {
      var all = collection('bookings').filter(function (b) { return !same(b.ref, ref); });
      return write('bookings', all);
    }
  };

  /* ---- Members -------------------------------------------------------- */
  var members = {
    list: function () { return collection('members'); },
    find: function (number) {
      var all = collection('members');
      for (var i = 0; i < all.length; i++) if (same(all[i].number, number)) return all[i];
      return null;
    },
    add: function (person) {
      var all = collection('members');
      var top = 1000;
      all.forEach(function (m) {
        var n = parseInt(String(m.number).replace(/\D/g, ''), 10);
        if (n > top) top = n;
      });
      var number = 'NBM-' + String(top + 1);
      var record = {
        number: number, plan: person.plan, name: person.name, email: person.email,
        joined: new Date().toISOString()
      };
      all.push(record);
      write('members', all);
      return record;
    }
  };

  /* ---- Messages from the contact form --------------------------------- */
  var messages = {
    list: function () { return collection('messages'); },
    add: function (msg) {
      var all = collection('messages');
      var record = {
        id: 'MSG-' + randomCode(5), created: new Date().toISOString(), status: 'new',
        name: msg.name, email: msg.email, topic: msg.topic, message: msg.message
      };
      all.push(record);
      write('messages', all);
      return record;
    },
    update: function (id, patch) {
      var all = collection('messages');
      for (var i = 0; i < all.length; i++) {
        if (all[i].id === id) {
          for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) all[i][k] = patch[k];
          write('messages', all);
          return all[i];
        }
      }
      return null;
    },
    remove: function (id) {
      return write('messages', collection('messages').filter(function (m) { return m.id !== id; }));
    }
  };

  /* ---- Seed data and reset -------------------------------------------- */
  function seed() {
    if (read('seeded', 0) === 1) return;
    var demo = window.NB_DATA && window.NB_DATA.demoMember;
    if (demo && !members.find(demo.number)) {
      var all = collection('members');
      all.push({ number: demo.number, plan: demo.plan, name: demo.name, email: 'demo@example.com', joined: '2026-01-01T00:00:00.000Z', demo: true });
      write('members', all);
    }
    write('seeded', 1);
  }

  function reset() {
    ['bookings', 'members', 'messages', 'seeded'].forEach(function (key) {
      delete memory[key];
      try { window.localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
    });
    seed();
  }

  seed();

  window.NBStore = {
    get persistent() { return persistent; },
    bookings: bookings,
    members: members,
    messages: messages,
    reset: reset
  };
}());
