/* Mvela AI chat widget. Add to any site:
   <script src="https://YOUR-API/widget.js" data-key="wk_..." async></script> */
(function () {
  var s = document.currentScript || document.querySelector('script[data-key][src*="widget.js"]');
  if (!s) return;
  var key = s.getAttribute('data-key');
  if (!key || window.__mvelaWidget) return;
  window.__mvelaWidget = true;
  var api = new URL(s.src).origin;

  fetch(api + '/api/widget/config?key=' + encodeURIComponent(key) + '&parent=' + encodeURIComponent(location.origin))
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (c) { if (c) build(c); })
    .catch(function () { /* stay invisible if the service is unreachable */ });

  function build(c) {
    var embedOrigin = new URL(c.embedUrl).origin;
    var small = function () { return window.innerWidth < 500; };
    var frame = document.createElement('iframe');
    frame.title = c.name + ' chat';
    frame.allow = 'microphone';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open chat');
    btn.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    btn.style.cssText = 'position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(15,23,42,.25);z-index:2147483000;background:' + c.color;
    var open = false, loaded = false;

    function layout() {
      frame.style.cssText = small()
        ? 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483001;background:#fff;display:' + (open ? 'block' : 'none')
        : 'position:fixed;right:20px;bottom:90px;width:380px;height:600px;max-height:calc(100vh - 110px);border:0;border-radius:16px;box-shadow:0 12px 40px rgba(15,23,42,.25);z-index:2147483001;background:#fff;display:' + (open ? 'block' : 'none');
      btn.style.display = open && small() ? 'none' : 'flex';
    }
    function toggle(v) {
      open = v;
      if (open && !loaded) { frame.src = c.embedUrl + '&parent=' + encodeURIComponent(location.origin); loaded = true; }
      btn.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
      layout();
    }
    btn.onclick = function () { toggle(!open); };
    window.addEventListener('resize', layout);
    window.addEventListener('message', function (e) { if (e.origin === embedOrigin && e.data === 'mvela-close') toggle(false); });
    document.body.appendChild(frame);
    document.body.appendChild(btn);
    layout();
  }
})();
