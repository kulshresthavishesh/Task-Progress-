// theme.js - loaded in <head> so the saved theme is applied before the page paints (no flash).
(function () {
  var saved = null;
  try { saved = localStorage.getItem('tp-theme'); } catch (e) {}
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', saved || (prefersDark ? 'dark' : 'light'));
})();

function getTheme() {
  return document.documentElement.getAttribute('data-theme');
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('tp-theme', theme); } catch (e) {}
  window.dispatchEvent(new CustomEvent('themechange', { detail: theme })); // charts listen to this
}

function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}
