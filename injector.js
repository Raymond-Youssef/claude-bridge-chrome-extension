// injector.js — runs in content script context
// Injects pageScript.js into the actual page context so it can access
// __REACT_DEVTOOLS_GLOBAL_HOOK__ and other page globals.

const script = document.createElement('script');
script.src = chrome.runtime.getURL('pageScript.js');
document.documentElement.appendChild(script);

// Listen for messages from the page script and forward to background
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'ELEMENT_BRIDGE_CAPTURE') return;

  chrome.runtime.sendMessage({
    type: 'ELEMENT_CAPTURED',
    payload: event.data.payload
  });
});

// Listen for disable message from background (DevTools panel closed)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'DISABLE_INSPECT') {
    window.postMessage({ type: 'ELEMENT_BRIDGE_TOGGLE', enabled: false }, '*');
  }
});
