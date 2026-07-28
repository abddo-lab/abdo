/**
 * CAI Browser Operator — Injected Script
 * Runs in page context for detection and communication
 */

(function() {
  // Mark extension as loaded
  const marker = document.createElement('div');
  marker.id = '__cai_extension_loaded__';
  marker.setAttribute('data-version', '1.1.0');
  marker.setAttribute('data-capabilities', 'navigate,click,type,scroll,screenshot,extract,evaluate,cookies,history,downloads');
  marker.style.display = 'none';
  document.documentElement.appendChild(marker);

  // Respond to detection requests
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === '__cai_detect__') {
      window.postMessage({
        type: '__cai_extension_pong__',
        version: '1.1.0',
        capabilities: ['navigate','click','type','scroll','screenshot','extract','evaluate','cookies','history','downloads']
      }, '*');
    }
  });

  // Notify page that extension is ready
  window.postMessage({
    type: '__cai_extension_ready__',
    version: '1.1.0'
  }, '*');
})();
