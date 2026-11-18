// Meta tracking helpers for the browser side.
// The Meta Pixel base code itself is placed in the <head> of every page.
// For AddToCart and InitiateCheckout, the same event is also sent to the server
// with the same event ID, so Meta gets the browser and server copies and counts them once.

(function () {
  const PIXEL_ID = '1722516656187525';
  const SERVER_EVENTS = ['AddToCart', 'InitiateCheckout'];

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  }

  function setCookie(name, value, days) {
    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }

  // When a visitor arrives from a Facebook ad, the URL contains ?fbclid=...
  // Meta expects it in the format fb.1.<timestamp_ms>.<fbclid>, stored as the _fbc cookie.
  function captureClickId() {
    const fbclid = new URLSearchParams(window.location.search).get('fbclid');
    if (fbclid) {
      setCookie('_fbc', `fb.1.${Date.now()}.${fbclid}`, 90);
    }
  }

  // Unique ID shared by the browser event and the server Conversion API event.
  function newEventId() {
    return crypto.randomUUID();
  }

  // Sends the event to the server. keepalive lets it finish even if the page changes (for example, Buy Now).
  function sendToServer(eventName, eventId, data) {
    try {
      fetch('/api/tracking/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          eventName,
          eventId,
          path: window.location.pathname + window.location.search,
          data
        })
      }).catch(() => {});
    } catch (err) {
      // Tracking must never break the shop
    }
  }

  // Fires a standard event in the browser and, for supported events, on the server.
  // serverData is optional. When it is missing, the browser params are used.
  // Returns the eventId.
  function track(eventName, params = {}, eventId = newEventId(), serverData = null) {
    if (typeof window.fbq === 'function') {
      window.fbq('track', eventName, params, { eventID: eventId });
    }

    if (SERVER_EVENTS.includes(eventName)) {
      sendToServer(eventName, eventId, serverData || params);
    }

    return eventId;
  }

  captureClickId();

  window.PicasoTracking = {
    PIXEL_ID,
    getCookie,
    newEventId,
    track
  };
})();