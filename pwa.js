let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.documentElement.classList.add('pwa-installable');
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  document.documentElement.classList.remove('pwa-installable');
});

window.gsmartInstallPWA = async () => {
  if (!deferredInstallPrompt) return false;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  return true;
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(error => {
      console.warn('G-Smart service worker gagal didaftarkan:', error);
    });
  });
}
