// Fallback reader for file:// urls, used when the service worker cannot fetch them itself.
function xhrText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload = () => resolve(xhr.responseText);
    xhr.onerror = () => reject(new Error(`Cannot read ${url}`));
    xhr.send();
  });
}

chrome.runtime.onMessage.addListener((msg: { target?: string; url?: string }, _sender, sendResponse) => {
  if (msg.target !== 'offscreen' || !msg.url) return false;
  xhrText(msg.url).then(
    (text) => sendResponse({ ok: true, text }),
    (err: Error) => sendResponse({ ok: false, error: err.message }),
  );
  return true;
});
