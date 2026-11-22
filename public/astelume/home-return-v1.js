// Loaded only by the gateway HTML shell, never by the public home itself.
// Leave authentication and all non-home SPA links to the original application.
(() => {
  if (window.top !== window || location.origin !== 'https://astelume.cc.cd') return;
  const isLanding = url => url.origin === 'https://astelume.cc.cd' && url.pathname === '/' && !url.search;
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const anchor = event.target instanceof Element && event.target.closest('a[href]');
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    const url = new URL(anchor.href, location.href);
    if (!isLanding(url)) return;
    event.preventDefault();
    event.stopPropagation(); // Do not allow the app router to turn this exact external-to-SPA link back into pushState.
    location.assign('/' + url.hash);
  }, true);
  // Also handle Back/Forward or a programmatic router navigation to the home route.
  const ensureLandingDocument = () => {
    if (isLanding(location) && !document.getElementById('home')) location.reload();
  };
  window.addEventListener('popstate', ensureLandingDocument);
  window.addEventListener('pageshow', ensureLandingDocument);
  window.navigation?.addEventListener('currententrychange', ensureLandingDocument);
})();
