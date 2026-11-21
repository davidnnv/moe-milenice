// Sets light/dark theme before the page paints (external file so the CSP needs no inline scripts).
try {
  var t = localStorage.getItem('moe-theme');
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
} catch (e) {}
