# ThumbCraft - Professional Video Thumbnail Generator

A modern, feature-rich video thumbnail generator built with pure HTML, Tailwind CSS, and JavaScript. Create stunning thumbnails for YouTube, Instagram, TikTok, Twitter, and other social media platforms.

## Features

### Video Sources
- **Local Files** - Upload videos from your device (MP4, WebM, MOV, AVI)
- **YouTube URLs** - Fetch existing thumbnails directly from any YouTube video
- **Direct URLs** - Load videos from any direct video file URL

### YouTube Thumbnail Fetcher
Paste any YouTube video URL to instantly fetch all available thumbnail sizes:
- Max Resolution (1280x720)
- Standard Definition (640x480)
- High Quality (480x360)
- Medium Quality (320x180)

### Platform Presets
- **YouTube** - 1280x720 (16:9)
- **Instagram Post** - 1080x1080 (1:1)
- **Instagram Story/Reels** - 1080x1920 (9:16)
- **TikTok** - 1080x1920 (9:16)
- **Twitter/X** - 1200x675 (16:9)
- **Facebook** - 1200x630
- **LinkedIn** - 1200x627
- **Custom** - Any size you need

### Video Controls
- Precise frame-by-frame navigation
- Seek by seconds or minutes
- Timeline scrubbing
- Keyboard shortcuts for power users

### Export Options
- **PNG** - Lossless quality
- **JPEG** - Smaller file size
- **WebP** - Modern format with excellent compression
- Adjustable quality slider (50-100%)
- Single image or batch ZIP download

### Auto Capture
- Generate thumbnails at regular intervals
- Percentage-based (2%, 4%, 5%, 10%)
- Time-based (1s, 5s, 10s, 30s, 1m)

### Modern UI/UX
- Dark glassmorphism design
- Smooth animations
- Responsive layout
- Keyboard shortcuts

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause video |
| `←` | Seek -1 second |
| `→` | Seek +1 second |
| `Shift + ←` | Seek -5 seconds |
| `Shift + →` | Seek +5 seconds |
| `C` | Capture current frame |

## Technology Stack

- **HTML5** - Semantic markup
- **Tailwind CSS** - Utility-first styling (via CDN)
- **Vanilla JavaScript** - No framework dependencies
- **JSZip** - Batch export functionality
- **FileSaver.js** - Download handling

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Usage

### For Local/URL Videos
1. Load a video from your device or via direct URL
2. Navigate to the desired frame using video controls
3. Select a platform preset or set custom dimensions
4. Click "Capture Frame" to take a thumbnail
5. Download individual images or batch export as ZIP

### For YouTube Videos
1. Select the "YouTube" tab
2. Paste any YouTube video URL (youtube.com/watch?v=... or youtu.be/...)
3. Click "Fetch Thumbnails" to see all available sizes
4. Click any thumbnail to add it to your gallery
5. Download or batch export as needed

## Local Development

Simply serve the files with any static HTTP server:

```bash
python -m http.server 5000
```

Then open `http://localhost:5000` in your browser.

## License

MIT License - See LICENSE file for details.
