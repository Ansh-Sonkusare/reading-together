self.addEventListener('push', (event) => {
  const note = event.data?.json();
  if (!note) return;
  event.waitUntil(self.registration.showNotification(note.title, { body: note.body, icon: '/favicon.ico', data: { url: note.url } }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url === url);
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});
