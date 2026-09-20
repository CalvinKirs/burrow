import { localize } from './i18n';

localize();

// Content scripts cannot run on file:// pages until the user flips this switch by hand.
void chrome.extension.isAllowedFileSchemeAccess().then((allowed) => {
  document.getElementById('ok')!.hidden = !allowed;
  document.getElementById('missing')!.hidden = allowed;
});

document.getElementById('details')!.addEventListener('click', () => {
  void chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
});

document.getElementById('options')!.addEventListener('click', () => void chrome.runtime.openOptionsPage());
