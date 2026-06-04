# Tab Pano

**A beautiful new tab page that turns tab chaos into clarity.**

A remix of [Zara Zhang](https://x.com/zarazhangrui)'s [Tab Out](https://github.com/zarazhangrui/tab-out) — rebuilt and extended with new features for power users and designers. All credit to Zara for the original concept and foundation.

> made with ♥ by [Zara Zhang](https://x.com/zarazhangrui) · [AI](https://anthropic.com/product/claude-code) · [Yuxuan Hou](https://x.com/yuxuan_o_o)

---

## Preview

<div align="center">
<video src="https://github.com/user-attachments/assets/01961c42-9936-4640-8c61-bc39251e26c4" controls autoplay loop muted></video>
</div>

---

## What's new in this remix

### 1. Multi-window support
All your Chrome windows are consolidated into a single view. Each window gets its own section, so you always know exactly where every tab lives — no more hunting across windows.

### 2. List View & Image View
Switch between two viewing modes:
- **List view** — clean, compact, fast to scan
- **Image view** — shows OG images and screenshots for each tab, so you recognize pages visually rather than reading URLs. Especially useful for designers browsing visual inspiration.

### 3. Quick links
Pin your most-visited sites as icon shortcuts at the top. One click, always there.

### 4. Organize with AI
Domain-based grouping isn't always enough — a designer collecting inspiration from Dribbble, Pinterest, Behance, and random blogs needs smarter grouping. Click **Organize with AI** and your tabs get re-grouped semantically, based on what they're actually about.

Supports **Claude**, **OpenAI**, and **Gemini** — just paste your API key and Tab Out auto-detects the provider. Keys are stored locally and never leave your browser.

### 5. Save for later
Bookmark tabs you don't want to close but aren't ready to act on. They live in a dedicated **Saved** section at the top, separate from your open tabs.

### 6. View options
Customize how Tab Out looks and feels:
- **Layout** — one column or two columns
- **View** — list or image grid
- **Style** — glass (translucent) or solid
- **Mode** — light, dark, or auto (time-based)
- **Background** — solid color picker or upload your own wallpaper

---

## Install

1. Clone or download this repo
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the `extension/` folder
5. Open a new tab ✨

---

## Tech

Built as a Chrome Extension (Manifest V3). No build step, no dependencies — just HTML, CSS, and vanilla JS.

AI calls go directly from the browser to the provider API. Your key is stored in `localStorage` and never sent anywhere except the AI provider you choose.
