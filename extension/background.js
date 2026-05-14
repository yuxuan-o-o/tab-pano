// ── Tab Out — Background Service Worker ─────────────────────────────────────
// Captures a JPEG thumbnail whenever a tab becomes active, then stores it in
// chrome.storage.local so the new-tab grid view can show real page previews.
//
// Storage key: "thumb_<tabId>"  →  data:image/jpeg;base64,…
// Resolution:  480 × 270 px (16:9), JPEG quality 0.50
// (≈ 15–40 KB per tab; 200 tabs ≈ 3–8 MB)

const THUMB_W = 480;
const THUMB_H = 270;
const THUMB_Q = 0.50; // JPEG quality

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert an OffscreenCanvas blob → base64 data-URL (no FileReader in SW). */
async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes  = new Uint8Array(buffer);
  let binary   = '';
  const CHUNK  = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

/** Resize a full-page JPEG dataUrl to THUMB_W × THUMB_H (cover crop). */
async function resizeToThumbnail(dataUrl) {
  try {
    const resp   = await fetch(dataUrl);
    const blob   = await resp.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(THUMB_W, THUMB_H);
    const ctx    = canvas.getContext('2d');

    // Cover: scale so the smaller dimension fills the canvas, then center-crop
    const scale = Math.max(THUMB_W / bitmap.width, THUMB_H / bitmap.height);
    const sw    = bitmap.width  * scale;
    const sh    = bitmap.height * scale;
    ctx.drawImage(bitmap, (THUMB_W - sw) / 2, (THUMB_H - sh) / 2, sw, sh);

    const outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: THUMB_Q });
    return await blobToDataUrl(outBlob);
  } catch {
    return dataUrl; // fall back to original if resize fails
  }
}

// ── Core capture ─────────────────────────────────────────────────────────────

let pendingCapture = null; // debounce rapid tab switches

async function captureTab(tabId, windowId) {
  // Debounce: if another capture is queued, cancel it
  if (pendingCapture) clearTimeout(pendingCapture);

  pendingCapture = setTimeout(async () => {
    pendingCapture = null;
    try {
      const dataUrl  = await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 60 });
      const resized  = await resizeToThumbnail(dataUrl);
      await chrome.storage.local.set({ [`thumb_${tabId}`]: resized });
    } catch {
      // Not capturable (chrome://, PDF, etc.) — silently ignore
    }
  }, 900); // wait 900 ms for the page to settle after switching
}

// ── OG image listener ────────────────────────────────────────────────────────
// content.js sends the og:image URL it finds on each page.
// app.js sends a batch list of tabs that need OG images fetched in the background.

chrome.runtime.onMessage.addListener((msg, sender) => {
  // From content script: single tab's OG image
  if (msg.type === 'og_image' && sender.tab?.id && msg.url) {
    chrome.storage.local.set({ [`ogimg_${sender.tab.id}`]: msg.url });
  }

  // From newtab page: batch-fetch OG images for uncached tabs
  if (msg.type === 'fetch_og_images' && Array.isArray(msg.tabs)) {
    fetchOgImagesForTabs(msg.tabs); // fire-and-forget
  }
});

// ── Background OG fetch ───────────────────────────────────────────────────────
// For tabs the user hasn't visited since installing the extension.
// We fetch just enough HTML to extract the og:image meta tag, then store the URL.

async function fetchOgImagesForTabs(tabs) {
  for (const { id, url } of tabs) {
    await fetchOgImageForTab(id, url);
    await sleep(250); // stagger: ~4 fetches/sec, avoids hammering the network
  }
}

async function fetchOgImageForTab(tabId, url) {
  if (!url?.startsWith('http')) return;
  // Skip if already cached (another fetch may have landed in the meantime)
  const existing = await chrome.storage.local.get([`ogimg_${tabId}`, `thumb_${tabId}`]);
  if (existing[`ogimg_${tabId}`] || existing[`thumb_${tabId}`]) return;

  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',        // send user's cookies → gets authenticated content
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
    if (!res.ok || !res.body) return;

    // Stream only the first 60 KB — enough to cover the <head> on any site
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let html = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (html.length > 60_000 || html.includes('</head>')) {
        reader.cancel().catch(() => {});
        break;
      }
    }

    const imgUrl = parseOgImage(html);
    if (!imgUrl) return;

    const resolved = new URL(imgUrl, url).href;
    await chrome.storage.local.set({ [`ogimg_${tabId}`]: resolved });
  } catch { /* network error, blocked, CORS, etc. — silently skip */ }
}

/** Extract og:image from raw HTML text using regex (DOMParser unavailable in SW). */
function parseOgImage(html) {
  const patterns = [
    /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    /name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]?.trim()) {
      // Decode HTML entities that may appear in meta content attributes
      return m[1].trim().replace(/&amp;/g, '&').replace(/&#38;/g, '&');
    }
  }
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Listeners ─────────────────────────────────────────────────────────────────

// Fired when the user switches to a tab (already loaded)
chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  captureTab(tabId, windowId);
});

// Fired when a page finishes loading while it's the active tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    captureTab(tabId, tab.windowId);
  }
});

// Clean up both thumbnail and OG image when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove([`thumb_${tabId}`, `ogimg_${tabId}`]);
});
