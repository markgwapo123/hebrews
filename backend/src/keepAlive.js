const KEEP_ALIVE_INTERVAL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10 * 1000;

/**
 * Sends a lightweight request to this Render service's public health endpoint.
 * This can help keep a Free web service active by generating inbound HTTP traffic,
 * but Render may change how inactivity is evaluated; a paid instance is the
 * only reliable always-on option.
 */
export function startKeepAlive() {
  if (process.env.NODE_ENV !== 'production') return;

  const baseUrl = process.env.RENDER_EXTERNAL_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    console.warn('Keep-alive disabled: RENDER_EXTERNAL_URL is not available.');
    return;
  }

  let requestInProgress = false;

  const timer = setInterval(async () => {
    if (requestInProgress) return;
    requestInProgress = true;

    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        method: 'GET',
        headers: { 'User-Agent': 'Hebrews-Keep-Alive/1.0' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (response.ok) {
        console.log(`Keep-alive check succeeded (HTTP ${response.status}).`);
      } else {
        console.warn(`Keep-alive check returned HTTP ${response.status}.`);
      }

      // Consume the response body so the connection can be reused/closed cleanly.
      await response.arrayBuffer();
    } catch (error) {
      console.warn('Keep-alive check failed:', error.message);
    } finally {
      requestInProgress = false;
    }
  }, KEEP_ALIVE_INTERVAL_MS);

  timer.unref?.();
  console.log('Keep-alive enabled: checking /api/health every 5 minutes.');
}
