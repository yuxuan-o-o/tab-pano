# Privacy Policy — Tab Pano

**Last updated: June 2026**

Tab Pano is a Chrome extension that replaces your new tab page with a panoramic view of all your open tabs.

## Data We Collect

**We collect no data.**

Tab Pano does not have a server, does not require an account, and does not collect, transmit, or store any personal information outside of your own browser.

## What Stays on Your Device

The following data is stored locally in your browser only, and never leaves your device:

- **Tab metadata** (titles, URLs, favicons) — read at runtime to display your tabs; never stored persistently
- **Extension settings** (layout, view, style, mode, background preference) — stored in `chrome.storage.local`
- **Saved tabs** — stored in `chrome.storage.local`
- **Quick links** — stored in `chrome.storage.local`
- **Uploaded wallpapers** — stored in `chrome.storage.local`
- **AI API key** — if you choose to use the AI organize feature, your API key (Claude, OpenAI, or Gemini) is stored in `localStorage`. It is used solely to make direct requests from your browser to the AI provider you chose. It is never sent to us or any third party.

## AI Feature

If you use the "Organize with AI" feature, your tab titles and URLs are sent directly from your browser to the AI provider whose API key you entered (Anthropic, OpenAI, or Google). This request is made by your browser — not routed through any Tab Pano server (there is none). Please refer to your chosen provider's privacy policy for how they handle API requests.

## Permissions

Tab Pano requests the following Chrome permissions:

- **tabs** — to read your open tabs and display them
- **windows** — to group tabs by window and move groups to new windows
- **storage / unlimitedStorage** — to store settings and wallpapers locally
- **search** — to delegate searches to your browser's default search engine when you press Enter in the search bar
- **host_permissions (`<all_urls>`)** — required by the content script to capture OG images for the Image View feature; no browsing data is collected or transmitted

## Contact

Tab Pano is open source. For questions or concerns, please open an issue at:
[https://github.com/yuxuan-o-o/tab-out](https://github.com/yuxuan-o-o/tab-out)
