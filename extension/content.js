// Tab Out — content script
// Extracts the best representative image for each tab and sends it to
// the background worker (stored as "ogimg_<tabId>") for the Grid view.
//
// Priority per site type:
//   Social media (X, Instagram)                    → first post / video image from DOM
//   Content & design platforms (Medium, Substack,
//     Behance, Dribbble, Pinterest, YouTube…)      → og:image  (= cover / featured image)
//   Everything else (tools, dashboards, docs…)     → og:image if present,
//                                                     otherwise screenshot (captureVisibleTab)

(function () {
  const host = location.hostname.replace(/^www\./, '');
  const path = location.pathname;

  // ── 1. Social media: DOM extraction ───────────────────────────────────────

  // X / Twitter ── individual tweet pages
  if (host === 'x.com' || host === 'twitter.com') {
    if (/\/status\/\d+/.test(path)) poll(findTweetMedia, 7000);
    return; // don't fall through to OG for X
  }

  // Instagram ── individual post or reel pages  (/p/xxx  /reel/xxx)
  if (host === 'instagram.com') {
    if (/^\/(p|reel|tv)\//.test(path)) poll(findInstagramMedia, 7000);
    return;
  }

  // YouTube ── watch pages (og:image is the video thumbnail — perfect, use it)
  // Reddit  ── post pages (og:image is the post image when one exists — use it)
  // → fall through to OG handling below

  // ── 2. OG / Twitter card meta tags (Medium, Substack, Behance, Dribbble,
  //        Pinterest, YouTube, Reddit, and most content sites) ─────────────────
  const ogUrl = readOgMeta();
  if (ogUrl) send(ogUrl);
  // If no OG image, don't scrape the DOM — the background worker's
  // captureVisibleTab screenshot is a better fallback for tools / dashboards.

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  function send(url) {
    try {
      const resolved = new URL(url, location.href).href;
      chrome.runtime.sendMessage({ type: 'og_image', url: resolved });
    } catch { /* malformed URL — skip */ }
  }

  /** Read OG / Twitter card image meta tags. */
  function readOgMeta() {
    const selectors = [
      'meta[property="og:image"]',
      'meta[property="og:image:url"]',
      'meta[name="twitter:image"]',
      'meta[name="twitter:image:src"]',
    ];
    for (const sel of selectors) {
      const val = document.querySelector(sel)?.content?.trim();
      if (val) return val;
    }
    return null;
  }

  /**
   * Poll fn() every `interval` ms until it returns a URL or `timeout` ms pass.
   * Designed for SPAs where content loads asynchronously after document_idle.
   */
  function poll(fn, timeout, interval = 400) {
    const url = fn();
    if (url) { send(url); return; }
    const start = Date.now();
    const timer = setInterval(() => {
      const found = fn();
      if (found) { clearInterval(timer); send(found); return; }
      if (Date.now() - start > timeout) clearInterval(timer);
    }, interval);
  }

  // ── X / Twitter ────────────────────────────────────────────────────────────
  function findTweetMedia() {
    // Photo inside the tweet
    const photo = document.querySelector('[data-testid="tweetPhoto"] img');
    if (photo?.src) return photo.src.replace(/(name=)\w+/, '$1large');

    // Video poster frame
    const video = document.querySelector(
      '[data-testid="videoPlayer"] video[poster],' +
      'article[data-testid="tweet"] video[poster]'
    );
    if (video?.poster) return video.poster;

    // Generic fallback inside the tweet article
    const img = document.querySelector(
      'article[data-testid="tweet"] img[src*="pbs.twimg.com/media"]'
    );
    if (img?.src) return img.src.replace(/(name=)\w+/, '$1large');

    return null;
  }

  // ── Instagram ──────────────────────────────────────────────────────────────
  function findInstagramMedia() {
    // Instagram renders the main media in an <article> as the first large <img>
    const article = document.querySelector('article');
    if (!article) return null;

    // Video with poster
    const video = article.querySelector('video[poster]');
    if (video?.poster) return video.poster;

    // First image that isn't a tiny avatar/icon (check src pattern)
    const imgs = article.querySelectorAll('img[src]');
    for (const img of imgs) {
      if (!img.src || img.src.includes('s150x150') || img.src.includes('s32x32')) continue;
      if (img.src.includes('cdninstagram.com') || img.src.includes('fbcdn.net')) return img.src;
    }
    return null;
  }

})();
