
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;
  function dark() {
    var set = root.getAttribute('data-theme');
    if (set) return set === 'dark';
    return window.matchMedia &&
           window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function label() {
    btn.textContent = dark() ? 'Light' : 'Dark';
    btn.setAttribute('aria-label',
      dark() ? 'Switch to the light theme' : 'Switch to the dark theme');
  }
  btn.addEventListener('click', function () {
    var next = dark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('rr-theme', next); } catch (e) {}
    label();
    // Charts read their colours from CSS at draw time, so they have to be told.
    window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
  });
  // An untouched page follows the OS, so it has to follow a change to it too.
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () {
      if (!root.getAttribute('data-theme')) {
        label();
        window.dispatchEvent(new CustomEvent('themechange'));
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
  label();
})();
