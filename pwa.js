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

// Daftarkan service worker segera setelah script dieksekusi.
// FCM membutuhkan registration aktif dan tidak perlu menunggu window.load.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(registration => {
    console.info('G-Smart service worker aktif:', registration.scope);
  }).catch(error => {
    console.warn('G-Smart service worker gagal didaftarkan:', error);
  });
}
