class PresetManager {
  constructor() {
    this.presets = {
      'youtube': { width: 1280, height: 720, name: 'YouTube', ratio: '16:9' },
      'instagram': { width: 1080, height: 1080, name: 'Instagram Post', ratio: '1:1' },
      'instagram-story': { width: 1080, height: 1920, name: 'Instagram Story', ratio: '9:16' },
      'tiktok': { width: 1080, height: 1920, name: 'TikTok', ratio: '9:16' },
      'twitter': { width: 1200, height: 675, name: 'Twitter/X', ratio: '16:9' },
      'facebook': { width: 1200, height: 630, name: 'Facebook', ratio: '1.91:1' },
      'linkedin': { width: 1200, height: 627, name: 'LinkedIn', ratio: '1.91:1' },
      'custom': { width: 1920, height: 1080, name: 'Custom', ratio: '16:9' }
    };
    this.currentPreset = 'youtube';
  }

  getPreset(name) {
    return this.presets[name] || this.presets['youtube'];
  }

  calculateRatio(width, height) {
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    const ratioW = width / divisor;
    const ratioH = height / divisor;
    
    if (ratioW <= 21 && ratioH <= 21) {
      return `${ratioW}:${ratioH}`;
    }
    return `${(width / height).toFixed(2)}:1`;
  }
}

class VideoManager {
  constructor(videoElement) {
    this.video = videoElement;
    this.isLoaded = false;
    this.objectURL = null;
    this.onLoadCallback = null;
    this.onTimeUpdateCallback = null;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.video.addEventListener('loadedmetadata', () => this.handleMetadataLoaded());
    this.video.addEventListener('timeupdate', () => this.handleTimeUpdate());
    this.video.addEventListener('play', () => this.handlePlayStateChange(true));
    this.video.addEventListener('pause', () => this.handlePlayStateChange(false));
    this.video.addEventListener('error', (e) => this.handleError(e));
  }

  handleMetadataLoaded() {
    this.isLoaded = true;
    this.video.play().then(() => this.video.pause());
    if (this.onLoadCallback) {
      this.onLoadCallback({
        width: this.video.videoWidth,
        height: this.video.videoHeight,
        duration: this.video.duration
      });
    }
  }

  handleTimeUpdate() {
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback({
        currentTime: this.video.currentTime,
        duration: this.video.duration
      });
    }
  }

  handlePlayStateChange(isPlaying) {
    document.dispatchEvent(new CustomEvent('videoPlayStateChange', { detail: { isPlaying } }));
  }

  handleError(error) {
    console.error('Video error:', error);
    this.isLoaded = false;
  }

  loadFromFile(file) {
    this.cleanup();
    this.objectURL = URL.createObjectURL(file);
    this.video.src = this.objectURL;
    this.video.load();
  }

  loadFromURL(url) {
    this.cleanup();
    this.video.src = url;
    this.video.load();
  }

  cleanup() {
    if (this.objectURL) {
      URL.revokeObjectURL(this.objectURL);
      this.objectURL = null;
    }
    this.isLoaded = false;
  }

  seek(time) {
    if (!this.isLoaded) return;
    this.video.currentTime = Math.max(0, Math.min(time, this.video.duration));
  }

  seekRelative(delta) {
    if (!this.isLoaded) return;
    this.seek(this.video.currentTime + delta);
  }

  seekToStart() {
    this.seek(0);
  }

  seekToEnd() {
    if (!this.isLoaded) return;
    this.seek(this.video.duration);
  }

  togglePlayPause() {
    if (!this.isLoaded) return;
    if (this.video.paused) {
      this.video.play();
    } else {
      this.video.pause();
    }
  }

  getVideoInfo() {
    return {
      width: this.video.videoWidth,
      height: this.video.videoHeight,
      duration: this.video.duration,
      currentTime: this.video.currentTime
    };
  }
}

class YouTubeThumbnailFetcher {
  constructor() {
    this.qualities = [
      { name: 'Max Resolution', key: 'maxresdefault', width: 1280, height: 720 },
      { name: 'Standard', key: 'sddefault', width: 640, height: 480 },
      { name: 'High Quality', key: 'hqdefault', width: 480, height: 360 },
      { name: 'Medium Quality', key: 'mqdefault', width: 320, height: 180 },
      { name: 'Default', key: 'default', width: 120, height: 90 }
    ];
  }

  extractVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  getThumbnailUrls(videoId) {
    return this.qualities.map(q => ({
      ...q,
      url: `https://img.youtube.com/vi/${videoId}/${q.key}.jpg`
    }));
  }

  async checkThumbnailAvailability(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve({ available: true, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ available: false });
      img.src = url;
    });
  }

  async fetchAvailableThumbnails(url) {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    const thumbnailUrls = this.getThumbnailUrls(videoId);
    const results = [];

    for (const thumb of thumbnailUrls) {
      const check = await this.checkThumbnailAvailability(thumb.url);
      if (check.available && check.width > 120) {
        results.push({
          ...thumb,
          actualWidth: check.width,
          actualHeight: check.height
        });
      }
    }

    return { videoId, thumbnails: results };
  }
}

class ThumbnailGenerator {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.thumbnails = [];
    this.selectedIndex = -1;
  }

  capture(video, width, height, format = 'png', quality = 0.92) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.context.drawImage(video, 0, 0, width, height);
    
    const mimeType = this.getMimeType(format);
    const dataURL = this.canvas.toDataURL(mimeType, quality);
    
    const thumbnail = {
      id: Date.now() + Math.random(),
      dataURL,
      time: video.currentTime,
      width,
      height,
      format,
      size: this.calculateSize(dataURL)
    };
    
    this.thumbnails.push(thumbnail);
    return thumbnail;
  }

  getMimeType(format) {
    const types = {
      'png': 'image/png',
      'jpeg': 'image/jpeg',
      'webp': 'image/webp'
    };
    return types[format] || 'image/png';
  }

  calculateSize(dataURL) {
    const base64 = dataURL.split(',')[1];
    const bytes = atob(base64).length;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  remove(index) {
    this.thumbnails.splice(index, 1);
    if (this.selectedIndex === index) {
      this.selectedIndex = -1;
    } else if (this.selectedIndex > index) {
      this.selectedIndex--;
    }
  }

  select(index) {
    this.selectedIndex = index;
    return this.thumbnails[index];
  }

  getSelected() {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.thumbnails.length) {
      return this.thumbnails[this.selectedIndex];
    }
    return null;
  }

  clear() {
    this.thumbnails = [];
    this.selectedIndex = -1;
  }

  getCount() {
    return this.thumbnails.length;
  }

  getAll() {
    return this.thumbnails;
  }
}

class ExportManager {
  constructor() {
    this.format = 'png';
    this.quality = 0.92;
  }

  setFormat(format) {
    this.format = format;
  }

  setQuality(quality) {
    this.quality = quality / 100;
  }

  getExtension() {
    return this.format === 'jpeg' ? 'jpg' : this.format;
  }

  downloadSingle(thumbnail) {
    const link = document.createElement('a');
    link.href = thumbnail.dataURL;
    const timestamp = thumbnail.time.toFixed(2).replace('.', '_');
    link.download = `thumbnail_${timestamp}_${thumbnail.width}x${thumbnail.height}.${this.getExtension()}`;
    link.click();
  }

  async downloadAll(thumbnails, filename = 'thumbnails') {
    if (thumbnails.length === 0) return;
    
    const zip = new JSZip();
    const folder = zip.folder('thumbnails');
    
    thumbnails.forEach((thumb, index) => {
      const base64 = thumb.dataURL.split(',')[1];
      const timestamp = thumb.time.toFixed(2).replace('.', '_');
      const name = `thumbnail_${String(index + 1).padStart(3, '0')}_${timestamp}.${this.getExtension()}`;
      folder.file(name, base64, { base64: true });
    });
    
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${filename}.zip`);
  }
}

class UIController {
  constructor() {
    this.presetManager = new PresetManager();
    this.videoManager = new VideoManager(document.getElementById('video'));
    this.thumbnailGenerator = new ThumbnailGenerator(document.getElementById('canvas'));
    this.exportManager = new ExportManager();
    this.youtubeFetcher = new YouTubeThumbnailFetcher();
    
    this.autoSnapInterval = null;
    this.elements = this.cacheElements();
    
    this.setupEventListeners();
    this.setupVideoCallbacks();
  }

  cacheElements() {
    return {
      sourceFile: document.getElementById('source_file'),
      sourceUrl: document.getElementById('source_url'),
      sourceYoutube: document.getElementById('source_youtube'),
      fileInputSection: document.getElementById('file-input-section'),
      urlInputSection: document.getElementById('url-input-section'),
      youtubeInputSection: document.getElementById('youtube-input-section'),
      videoFile: document.getElementById('videofile'),
      videoUrl: document.getElementById('videourl'),
      youtubeUrl: document.getElementById('youtubeurl'),
      loadUrlBtn: document.getElementById('load-url-btn'),
      fetchYoutubeBtn: document.getElementById('fetch-youtube-btn'),
      youtubeThumbnails: document.getElementById('youtube-thumbnails'),
      youtubeThumbGrid: document.getElementById('youtube-thumb-grid'),
      videoPlaceholder: document.getElementById('video-placeholder'),
      videoControls: document.getElementById('video-controls'),
      videoInfo: document.getElementById('video-info'),
      infoSize: document.getElementById('info-size'),
      infoDuration: document.getElementById('info-duration'),
      infoPosition: document.getElementById('info-position'),
      timeline: document.getElementById('timeline'),
      playPauseBtn: document.getElementById('play-pause-btn'),
      playIcon: document.getElementById('play-icon'),
      pauseIcon: document.getElementById('pause-icon'),
      presetBtns: document.querySelectorAll('.preset-btn'),
      outputWidth: document.getElementById('output-width'),
      outputHeight: document.getElementById('output-height'),
      lockRatio: document.getElementById('lock-ratio'),
      ratioDisplay: document.getElementById('ratio-display'),
      snapBtn: document.getElementById('snap-btn'),
      autoSnapBtn: document.getElementById('auto-snap-btn'),
      snapInterval: document.getElementById('snap-interval'),
      exportFormat: document.getElementById('export-format'),
      exportQuality: document.getElementById('export-quality'),
      qualityValue: document.getElementById('quality-value'),
      thumbnailsGrid: document.getElementById('thumbnails-grid'),
      thumbCount: document.getElementById('thumb-count'),
      previewContainer: document.getElementById('preview-container'),
      previewImage: document.getElementById('preview-image'),
      saveSelectedBtn: document.getElementById('save-selected-btn'),
      saveAllBtn: document.getElementById('save-all-btn'),
      clearBtn: document.getElementById('clear-btn')
    };
  }

  setupEventListeners() {
    this.elements.sourceFile.addEventListener('change', () => this.toggleSourceInput('file'));
    this.elements.sourceUrl.addEventListener('change', () => this.toggleSourceInput('url'));
    this.elements.sourceYoutube.addEventListener('change', () => this.toggleSourceInput('youtube'));
    
    this.elements.videoFile.addEventListener('change', (e) => this.handleFileSelect(e));
    this.elements.loadUrlBtn.addEventListener('click', () => this.handleUrlLoad());
    this.elements.videoUrl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleUrlLoad();
    });
    
    this.elements.fetchYoutubeBtn.addEventListener('click', () => this.handleYoutubeFetch());
    this.elements.youtubeUrl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleYoutubeFetch();
    });
    
    this.elements.timeline.addEventListener('input', (e) => {
      const time = parseFloat(e.target.value);
      this.videoManager.seek(time);
    });
    
    this.elements.playPauseBtn.addEventListener('click', () => this.videoManager.togglePlayPause());
    
    document.querySelectorAll('[data-seek]').forEach(btn => {
      btn.addEventListener('click', () => this.handleSeek(btn.dataset.seek));
    });
    
    document.addEventListener('videoPlayStateChange', (e) => {
      this.updatePlayPauseButton(e.detail.isPlaying);
    });
    
    this.elements.presetBtns.forEach(btn => {
      btn.addEventListener('click', () => this.handlePresetSelect(btn));
    });
    
    this.elements.outputWidth.addEventListener('input', () => this.handleSizeChange('width'));
    this.elements.outputHeight.addEventListener('input', () => this.handleSizeChange('height'));
    
    this.elements.snapBtn.addEventListener('click', () => this.captureFrame());
    this.elements.autoSnapBtn.addEventListener('click', () => this.startAutoCapture());
    
    this.elements.exportFormat.addEventListener('change', (e) => {
      this.exportManager.setFormat(e.target.value);
    });
    
    this.elements.exportQuality.addEventListener('input', (e) => {
      this.elements.qualityValue.textContent = e.target.value;
      this.exportManager.setQuality(parseInt(e.target.value));
    });
    
    this.elements.saveSelectedBtn.addEventListener('click', () => this.saveSelected());
    this.elements.saveAllBtn.addEventListener('click', () => this.saveAll());
    this.elements.clearBtn.addEventListener('click', () => this.clearThumbnails());

    const fileInput = this.elements.videoFile;
    const dropZone = fileInput.parentElement;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('border-primary-500', 'bg-primary-500/10');
      });
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('border-primary-500', 'bg-primary-500/10');
      });
    });
    
    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith('video/')) {
        this.videoManager.loadFromFile(files[0]);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      
      switch(e.code) {
        case 'Space':
          e.preventDefault();
          this.videoManager.togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.videoManager.seekRelative(e.shiftKey ? -5 : -1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.videoManager.seekRelative(e.shiftKey ? 5 : 1);
          break;
        case 'KeyC':
          if (!e.ctrlKey && !e.metaKey) {
            this.captureFrame();
          }
          break;
      }
    });
  }

  setupVideoCallbacks() {
    this.videoManager.onLoadCallback = (info) => {
      this.elements.videoPlaceholder.classList.add('hidden');
      this.elements.videoControls.classList.remove('hidden');
      this.elements.videoInfo.classList.remove('hidden');
      
      this.elements.infoSize.textContent = `${info.width}x${info.height}`;
      this.elements.infoDuration.textContent = this.formatTime(info.duration);
      this.elements.timeline.max = info.duration;
      
      this.elements.snapBtn.disabled = false;
      this.elements.autoSnapBtn.disabled = false;
    };
    
    this.videoManager.onTimeUpdateCallback = (info) => {
      this.elements.timeline.value = info.currentTime;
      this.elements.infoPosition.textContent = this.formatTime(info.currentTime);
    };
  }

  toggleSourceInput(type) {
    this.elements.fileInputSection.classList.add('hidden');
    this.elements.urlInputSection.classList.add('hidden');
    this.elements.youtubeInputSection.classList.add('hidden');
    
    if (type === 'file') {
      this.elements.fileInputSection.classList.remove('hidden');
    } else if (type === 'url') {
      this.elements.urlInputSection.classList.remove('hidden');
    } else if (type === 'youtube') {
      this.elements.youtubeInputSection.classList.remove('hidden');
    }
  }

  handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      this.videoManager.loadFromFile(file);
    }
  }

  handleUrlLoad() {
    const url = this.elements.videoUrl.value.trim();
    if (url) {
      this.videoManager.loadFromURL(url);
    }
  }

  async handleYoutubeFetch() {
    const url = this.elements.youtubeUrl.value.trim();
    if (!url) return;

    this.elements.fetchYoutubeBtn.textContent = 'Fetching...';
    this.elements.fetchYoutubeBtn.disabled = true;

    try {
      const result = await this.youtubeFetcher.fetchAvailableThumbnails(url);
      this.displayYoutubeThumbnails(result);
    } catch (error) {
      alert('Could not fetch thumbnails. Please check the URL and try again.');
      console.error(error);
    } finally {
      this.elements.fetchYoutubeBtn.textContent = 'Fetch Thumbnails';
      this.elements.fetchYoutubeBtn.disabled = false;
    }
  }

  displayYoutubeThumbnails(result) {
    const grid = this.elements.youtubeThumbGrid;
    grid.innerHTML = '';

    if (result.thumbnails.length === 0) {
      grid.innerHTML = '<p class="col-span-2 text-slate-500 text-center py-4">No thumbnails found for this video.</p>';
      this.elements.youtubeThumbnails.classList.remove('hidden');
      return;
    }

    result.thumbnails.forEach((thumb) => {
      const card = document.createElement('div');
      card.className = 'relative rounded-xl overflow-hidden bg-black/30 cursor-pointer hover:ring-2 hover:ring-red-500 transition-all group';
      card.innerHTML = `
        <img src="${thumb.url}" alt="${thumb.name}" class="w-full h-auto">
        <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
          <p class="text-white text-sm font-medium">${thumb.name}</p>
          <p class="text-slate-300 text-xs">${thumb.actualWidth}x${thumb.actualHeight}</p>
        </div>
        <div class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
          <span class="px-4 py-2 bg-red-600 rounded-lg text-sm font-medium">Add to Gallery</span>
        </div>
      `;
      
      card.addEventListener('click', () => this.addYoutubeThumbnailToGallery(thumb));
      grid.appendChild(card);
    });

    this.elements.youtubeThumbnails.classList.remove('hidden');
  }

  async addYoutubeThumbnailToGallery(thumb) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      
      const format = this.elements.exportFormat.value;
      const quality = parseInt(this.elements.exportQuality.value) / 100;
      const mimeType = format === 'png' ? 'image/png' : format === 'jpeg' ? 'image/jpeg' : 'image/webp';
      const dataURL = canvas.toDataURL(mimeType, quality);
      
      const thumbnail = {
        id: Date.now() + Math.random(),
        dataURL,
        time: 0,
        width: img.naturalWidth,
        height: img.naturalHeight,
        format,
        size: this.calculateImageSize(dataURL),
        isYoutube: true,
        quality: thumb.name
      };
      
      this.thumbnailGenerator.thumbnails.push(thumbnail);
      this.addThumbnailToGrid(thumbnail);
      this.updateButtonStates();
      this.flashCapture();
    };
    
    img.onerror = () => {
      alert('Could not load this thumbnail. It may not be available in this resolution.');
    };
    
    img.src = thumb.url;
  }

  calculateImageSize(dataURL) {
    const base64 = dataURL.split(',')[1];
    const bytes = atob(base64).length;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  handleSeek(value) {
    if (value === 'start') {
      this.videoManager.seekToStart();
    } else if (value === 'end') {
      this.videoManager.seekToEnd();
    } else {
      this.videoManager.seekRelative(parseFloat(value));
    }
  }

  updatePlayPauseButton(isPlaying) {
    if (isPlaying) {
      this.elements.playIcon.classList.add('hidden');
      this.elements.pauseIcon.classList.remove('hidden');
    } else {
      this.elements.playIcon.classList.remove('hidden');
      this.elements.pauseIcon.classList.add('hidden');
    }
  }

  handlePresetSelect(btn) {
    this.elements.presetBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const preset = btn.dataset.preset;
    const width = parseInt(btn.dataset.width);
    const height = parseInt(btn.dataset.height);
    
    this.elements.outputWidth.value = width;
    this.elements.outputHeight.value = height;
    this.updateRatioDisplay();
  }

  handleSizeChange(changed) {
    if (!this.elements.lockRatio.checked) {
      this.updateRatioDisplay();
      return;
    }
    
    const width = parseInt(this.elements.outputWidth.value) || 1;
    const height = parseInt(this.elements.outputHeight.value) || 1;
    const currentRatio = width / height;
    
    if (changed === 'width') {
      const newHeight = Math.round(width / currentRatio);
      this.elements.outputHeight.value = newHeight;
    } else {
      const newWidth = Math.round(height * currentRatio);
      this.elements.outputWidth.value = newWidth;
    }
    
    this.updateRatioDisplay();
  }

  updateRatioDisplay() {
    const width = parseInt(this.elements.outputWidth.value) || 1;
    const height = parseInt(this.elements.outputHeight.value) || 1;
    this.elements.ratioDisplay.textContent = this.presetManager.calculateRatio(width, height);
  }

  captureFrame() {
    if (!this.videoManager.isLoaded) return;
    
    const width = parseInt(this.elements.outputWidth.value);
    const height = parseInt(this.elements.outputHeight.value);
    const format = this.elements.exportFormat.value;
    const quality = parseInt(this.elements.exportQuality.value) / 100;
    
    const thumbnail = this.thumbnailGenerator.capture(
      this.videoManager.video,
      width,
      height,
      format,
      quality
    );
    
    this.addThumbnailToGrid(thumbnail);
    this.updateButtonStates();
    
    this.flashCapture();
  }

  flashCapture() {
    const flash = document.createElement('div');
    flash.className = 'fixed inset-0 bg-white pointer-events-none capture-flash z-50';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 300);
  }

  startAutoCapture() {
    if (this.autoSnapInterval) {
      clearInterval(this.autoSnapInterval);
      this.autoSnapInterval = null;
      this.elements.autoSnapBtn.textContent = 'Auto Capture';
      return;
    }
    
    const intervalValue = this.elements.snapInterval.value;
    const duration = this.videoManager.video.duration;
    let positions = [];
    
    if (intervalValue.includes('%')) {
      const percent = parseFloat(intervalValue) / 100;
      const step = duration * percent;
      for (let t = step / 2; t < duration; t += step) {
        positions.push(t);
      }
    } else {
      const seconds = parseFloat(intervalValue);
      for (let t = seconds / 2; t < duration; t += seconds) {
        positions.push(t);
      }
    }
    
    this.clearThumbnails();
    let index = 0;
    
    this.elements.autoSnapBtn.textContent = 'Stop';
    
    const captureNext = () => {
      if (index >= positions.length) {
        clearInterval(this.autoSnapInterval);
        this.autoSnapInterval = null;
        this.elements.autoSnapBtn.textContent = 'Auto Capture';
        return;
      }
      
      this.videoManager.seek(positions[index]);
      setTimeout(() => {
        this.captureFrame();
        index++;
      }, 200);
    };
    
    this.autoSnapInterval = setInterval(captureNext, 400);
    captureNext();
  }

  addThumbnailToGrid(thumbnail) {
    const grid = this.elements.thumbnailsGrid;
    
    if (this.thumbnailGenerator.getCount() === 1) {
      grid.innerHTML = '';
    }
    
    const index = this.thumbnailGenerator.thumbnails.indexOf(thumbnail);
    
    const item = document.createElement('div');
    item.className = 'thumbnail-item animate-fade-in';
    item.dataset.index = index;
    
    item.innerHTML = `
      <img src="${thumbnail.dataURL}" alt="Thumbnail at ${thumbnail.time.toFixed(2)}s">
      <div class="thumb-info">${thumbnail.time.toFixed(2)}s</div>
      <div class="thumb-remove">×</div>
    `;
    
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('thumb-remove')) {
        this.selectThumbnail(index);
      }
    });
    
    item.querySelector('.thumb-remove').addEventListener('click', () => {
      this.removeThumbnail(index);
    });
    
    grid.appendChild(item);
    this.elements.thumbCount.textContent = `(${this.thumbnailGenerator.getCount()})`;
    
    this.selectThumbnail(index);
  }

  selectThumbnail(index) {
    document.querySelectorAll('.thumbnail-item').forEach(item => {
      item.classList.remove('selected');
    });
    
    const item = document.querySelector(`.thumbnail-item[data-index="${index}"]`);
    if (item) {
      item.classList.add('selected');
    }
    
    const thumbnail = this.thumbnailGenerator.select(index);
    if (thumbnail) {
      this.elements.previewContainer.classList.remove('hidden');
      this.elements.previewImage.src = thumbnail.dataURL;
      
      this.videoManager.seek(thumbnail.time);
    }
  }

  removeThumbnail(index) {
    this.thumbnailGenerator.remove(index);
    this.renderThumbnailGrid();
    this.updateButtonStates();
  }

  renderThumbnailGrid() {
    const grid = this.elements.thumbnailsGrid;
    grid.innerHTML = '';
    
    const thumbnails = this.thumbnailGenerator.getAll();
    
    if (thumbnails.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full text-center py-12 text-slate-500">
          <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <p>Captured thumbnails will appear here</p>
        </div>
      `;
      this.elements.previewContainer.classList.add('hidden');
      return;
    }
    
    thumbnails.forEach((thumb, index) => {
      const item = document.createElement('div');
      item.className = 'thumbnail-item';
      item.dataset.index = index;
      
      if (index === this.thumbnailGenerator.selectedIndex) {
        item.classList.add('selected');
      }
      
      item.innerHTML = `
        <img src="${thumb.dataURL}" alt="Thumbnail at ${thumb.time.toFixed(2)}s">
        <div class="thumb-info">${thumb.time.toFixed(2)}s</div>
        <div class="thumb-remove">×</div>
      `;
      
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('thumb-remove')) {
          this.selectThumbnail(index);
        }
      });
      
      item.querySelector('.thumb-remove').addEventListener('click', () => {
        this.removeThumbnail(index);
      });
      
      grid.appendChild(item);
    });
    
    this.elements.thumbCount.textContent = `(${thumbnails.length})`;
  }

  clearThumbnails() {
    if (this.autoSnapInterval) {
      clearInterval(this.autoSnapInterval);
      this.autoSnapInterval = null;
      this.elements.autoSnapBtn.textContent = 'Auto Capture';
    }
    
    this.thumbnailGenerator.clear();
    this.renderThumbnailGrid();
    this.updateButtonStates();
  }

  updateButtonStates() {
    const count = this.thumbnailGenerator.getCount();
    const hasSelection = this.thumbnailGenerator.selectedIndex >= 0;
    
    this.elements.saveSelectedBtn.disabled = !hasSelection;
    this.elements.saveAllBtn.disabled = count === 0;
    this.elements.clearBtn.disabled = count === 0;
  }

  saveSelected() {
    const thumbnail = this.thumbnailGenerator.getSelected();
    if (thumbnail) {
      this.exportManager.downloadSingle(thumbnail);
    }
  }

  saveAll() {
    const thumbnails = this.thumbnailGenerator.getAll();
    this.exportManager.downloadAll(thumbnails);
  }

  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new UIController();
});
