/**
 * ══════════════════════════════════════════════════════════════════
 * JAVED FOOD POINT — ULTRA-PERFORMANCE HERO CANVAS SCROLL ENGINE
 * 101-Frame Gourmet Double Smash Burger Assembly Sequence
 * 
 * Performance Architecture:
 * 1. Responsive WebP Asset Serving (Desktop 1280x720, Mobile 800x450)
 * 2. Instant First Paint (Frame 0 Preload + HTML5 head link)
 * 3. Connection-Aware Controlled Concurrency Pool (2 - 8 workers)
 * 4. Direction-Aware Lookahead Priority Queue (forward vs backward scroll)
 * 5. Nearest-Loaded Frame Fallback (Zero blank canvas, zero stutter)
 * 6. Non-Blocking Idle-Scheduled Background Loader (requestIdleCallback)
 * 7. Off-Main-Thread Native Image Decoding (img.decode())
 * 8. GPU-Optimized Canvas Buffer Capping & Redundant Paint Elimination
 * ══════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  // ── CONSTANTS & ASSET DIRECTORIES ──
  const TOTAL_FRAMES = 101; // Frame000000 to Frame000100
  const DESKTOP_DIR = 'burger-frames/';
  const MOBILE_DIR = 'burger-frames/mobile/';
  const FRAME_PREFIX = 'Frame';
  const PRIMARY_EXT = '.webp';
  const FALLBACK_EXT = '.png';

  const NATIVE_WIDTH = 1280;
  const NATIVE_HEIGHT = 720;
  const BURGER_SUBJECT_WIDTH = 720;

  // ── CONNECTION-AWARE SETTINGS ──
  function getNetworkProfile() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) {
      return {
        concurrency: 6,
        initialBuffer: 8,
        priorityRadius: 10,
        idleBatchSize: 4
      };
    }

    if (conn.saveData) {
      return {
        concurrency: 2,
        initialBuffer: 3,
        priorityRadius: 4,
        idleBatchSize: 1
      };
    }

    const effectiveType = conn.effectiveType || '';
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      return {
        concurrency: 2,
        initialBuffer: 3,
        priorityRadius: 4,
        idleBatchSize: 1
      };
    } else if (effectiveType === '3g') {
      return {
        concurrency: 4,
        initialBuffer: 6,
        priorityRadius: 7,
        idleBatchSize: 2
      };
    } else {
      // 4g or fast broadband
      const downlink = conn.downlink || 10;
      const isUltra = downlink >= 8;
      return {
        concurrency: isUltra ? 8 : 6,
        initialBuffer: isUltra ? 10 : 8,
        priorityRadius: isUltra ? 12 : 9,
        idleBatchSize: 4
      };
    }
  }

  let networkProfile = getNetworkProfile();

  if (navigator.connection && typeof navigator.connection.addEventListener === 'function') {
    navigator.connection.addEventListener('change', () => {
      networkProfile = getNetworkProfile();
    });
  }

  // ── RESPONSIVE DETECTION ──
  function isMobileViewport() {
    return window.innerWidth < 768;
  }

  function getFrameUrl(index, forceFallback = false) {
    const padded = String(index).padStart(6, '0');
    if (forceFallback) {
      return `${DESKTOP_DIR}${FRAME_PREFIX}${padded}${FALLBACK_EXT}`;
    }
    const isMobile = isMobileViewport();
    const dir = isMobile ? MOBILE_DIR : DESKTOP_DIR;
    return `${dir}${FRAME_PREFIX}${padded}${PRIMARY_EXT}`;
  }

  // ── STATE & CACHE ──
  const frameCache = new Array(TOTAL_FRAMES).fill(null);
  const loadPromises = new Array(TOTAL_FRAMES).fill(null);
  const loadingSet = new Set();
  const priorityQueue = [];

  let loadedCount = 0;
  let activeFrameIndex = 0;
  let scrollDirection = 1; // 1 = forward/down, -1 = backward/up
  let lastRenderedImage = null;
  let lastRenderedIndex = -1;
  let isInitialFrameRendered = false;
  let renderRafId = null;
  let idleScheduleTimer = null;
  let scrollTriggerInstance = null;
  let isReducedMotion = false;
  let activeWorkers = 0;

  // ── DOM ELEMENTS ──
  let canvas = null;
  let ctx = null;
  let heroSection = null;
  let heroStage = null;
  let progressTextEl = null;
  let progressPctEl = null;
  let progressBarEl = null;
  let loaderHintEl = null;
  let loadPctTextEl = null;
  let badge1El = null;
  let badge2El = null;
  let badge3El = null;

  /**
   * Direction-aware nearest loaded frame search (Fast Scroll Fallback).
   * If target is missing, grabs the closest frame in the direction of motion
   * so there is zero flicker and zero blank canvas.
   */
  function getNearestLoadedImage(targetIndex, direction = 1) {
    if (frameCache[targetIndex]) return frameCache[targetIndex];

    const primaryDir = direction >= 0 ? -1 : 1;
    const secondaryDir = -primaryDir;

    let dist = 1;
    while (dist < TOTAL_FRAMES) {
      const pIdx = targetIndex + (dist * primaryDir);
      if (pIdx >= 0 && pIdx < TOTAL_FRAMES && frameCache[pIdx]) {
        return frameCache[pIdx];
      }
      const sIdx = targetIndex + (dist * secondaryDir);
      if (sIdx >= 0 && sIdx < TOTAL_FRAMES && frameCache[sIdx]) {
        return frameCache[sIdx];
      }
      dist++;
    }
    return null;
  }

  /**
   * Render frame to canvas with DPR scaling, aspect-ratio preservation,
   * optical centering, and redundant redraw skipping.
   */
  function drawFrame(frameIndex) {
    if (!canvas || !ctx) return;

    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw === 0 || ch === 0) return;

    // High-DPI handling: cap DPR at 2x and max 1920x1080 buffer
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetBufferWidth = Math.min(Math.round(cw * dpr), 1920);
    const targetBufferHeight = Math.min(Math.round(ch * dpr), 1080);

    const sizeChanged = (canvas.width !== targetBufferWidth || canvas.height !== targetBufferHeight);
    if (sizeChanged) {
      canvas.width = targetBufferWidth;
      canvas.height = targetBufferHeight;
    }

    const img = getNearestLoadedImage(frameIndex, scrollDirection);
    if (!img) return;

    // Skip redundant repaints if image and canvas dimensions haven't changed
    if (!sizeChanged && img === lastRenderedImage && frameIndex === lastRenderedIndex) {
      return;
    }

    // Fill background with burger frame dark tone
    ctx.fillStyle = '#0F0500';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const iw = img.naturalWidth || NATIVE_WIDTH;
    const ih = img.naturalHeight || NATIVE_HEIGHT;
    const imgRatio = iw / ih;
    const canvasRatio = cw / ch;

    let renderW, renderH, drawX, drawY;
    const isLandscape = (cw > ch && ch <= 600) || cw >= 992;

    if (isLandscape) {
      // Desktop / Landscape: 62% focal anchor for burger
      if (canvasRatio > imgRatio) {
        renderW = cw;
        renderH = cw / imgRatio;
      } else {
        renderH = ch;
        renderW = ch * imgRatio;
      }

      const horizontalCenter = cw * 0.62;
      drawX = horizontalCenter - (renderW * 0.5);
      drawY = (ch - renderH) / 2;
    } else {
      // Mobile / Portrait: centered between header block and actions
      const subjectFitScale = (cw * 0.90) / BURGER_SUBJECT_WIDTH;
      const fullCoverScale = Math.max(cw / iw, ch / ih);
      const chosenScale = Math.min(fullCoverScale, Math.max(cw / iw, subjectFitScale));

      renderW = iw * chosenScale;
      renderH = ih * chosenScale;
      drawX = (cw - renderW) / 2;

      const middleCenterY = ch * 0.46;
      drawY = middleCenterY - (renderH * 0.5);
    }

    const bufferScaleX = canvas.width / cw;
    const bufferScaleY = canvas.height / ch;

    ctx.drawImage(
      img,
      Math.round(drawX * bufferScaleX),
      Math.round(drawY * bufferScaleY),
      Math.round(renderW * bufferScaleX),
      Math.round(renderH * bufferScaleY)
    );

    lastRenderedImage = img;
    lastRenderedIndex = frameIndex;
  }

  /**
   * Request render on next animation frame to coalesce rapid scroll events.
   */
  function requestRenderFrame(frameIndex) {
    activeFrameIndex = frameIndex;
    if (renderRafId) return;
    renderRafId = window.requestAnimationFrame(() => {
      renderRafId = null;
      drawFrame(activeFrameIndex);
    });
  }

  /**
   * Load and decode a single frame using native off-thread decoding.
   */
  function loadFrame(index) {
    if (frameCache[index]) {
      return Promise.resolve(frameCache[index]);
    }
    if (loadPromises[index]) {
      return loadPromises[index];
    }

    loadingSet.add(index);

    loadPromises[index] = new Promise((resolve) => {
      const img = new Image();
      let settled = false;

      const finish = (success) => {
        if (settled) return;
        settled = true;
        loadingSet.delete(index);

        if (success) {
          frameCache[index] = img;
          loadedCount++;
          handleFrameLoaded(index);
          resolve(img);
        } else {
          // Automatic fallback to original PNG if WebP fails
          if (!img._retriedFallback) {
            img._retriedFallback = true;
            settled = false;
            loadingSet.add(index);
            img.src = getFrameUrl(index, true);

            if (typeof img.decode === 'function') {
              img.decode().then(() => finish(true)).catch(() => {
                if (img.complete && img.naturalWidth > 0) finish(true);
                else {
                  loadingSet.delete(index);
                  resolve(null);
                }
              });
            } else {
              img.onload = () => finish(true);
              img.onerror = () => {
                loadingSet.delete(index);
                resolve(null);
              };
            }
            return;
          }
          resolve(null);
        }
      };

      img.onerror = () => finish(false);
      img.src = getFrameUrl(index);

      if (typeof img.decode === 'function') {
        img.decode()
          .then(() => finish(true))
          .catch(() => {
            if (img.complete && img.naturalWidth > 0) {
              finish(true);
            } else {
              img.onload = () => finish(true);
            }
          });
      } else {
        img.onload = () => finish(true);
      }
    });

    return loadPromises[index];
  }

  /**
   * Handler when a frame completes loading.
   */
  function handleFrameLoaded(index) {
    // Instant first paint for Frame 0
    if (index === 0 && !isInitialFrameRendered) {
      isInitialFrameRendered = true;
      requestRenderFrame(0);
    } else {
      // Re-render if this newly loaded frame is the active frame
      // or provides a closer match than what is currently painted
      const bestImg = getNearestLoadedImage(activeFrameIndex, scrollDirection);
      if (bestImg && bestImg !== lastRenderedImage) {
        requestRenderFrame(activeFrameIndex);
      }
    }

    // Update non-blocking progress pill
    const pct = Math.round((loadedCount / TOTAL_FRAMES) * 100);
    if (loadPctTextEl) {
      loadPctTextEl.textContent = `${pct}%`;
    }

    if (pct >= 100 && loaderHintEl) {
      loaderHintEl.classList.add('fade-out');
      setTimeout(() => {
        if (loaderHintEl) loaderHintEl.style.display = 'none';
      }, 500);
    }
  }

  /**
   * Controlled concurrency worker pool.
   */
  function processQueue() {
    const maxConcurrency = networkProfile.concurrency;
    while (activeWorkers < maxConcurrency && priorityQueue.length > 0) {
      const nextIdx = priorityQueue.shift();
      if (frameCache[nextIdx] || loadingSet.has(nextIdx)) {
        continue;
      }

      activeWorkers++;
      loadFrame(nextIdx).finally(() => {
        activeWorkers--;
        processQueue();
      });
    }
  }

  /**
   * Direction-aware priority queue manager.
   * If scrolling DOWN, prioritizes targetFrame + lookahead forward.
   * If scrolling UP, prioritizes targetFrame + lookahead backward.
   */
  function prioritizeFramesNear(targetIndex, direction = 1) {
    const radius = networkProfile.priorityRadius;
    const prioritized = [];

    // 1. Target frame is absolute top priority
    if (!frameCache[targetIndex] && !loadingSet.has(targetIndex)) {
      prioritized.push(targetIndex);
    }

    // 2. Primary lookahead in scroll direction
    for (let r = 1; r <= radius; r++) {
      const idx = direction >= 0 ? targetIndex + r : targetIndex - r;
      if (idx >= 0 && idx < TOTAL_FRAMES && !frameCache[idx] && !loadingSet.has(idx)) {
        if (!prioritized.includes(idx)) prioritized.push(idx);
      }
    }

    // 3. Secondary trailing buffer (smaller radius in reverse direction)
    const trailingRadius = Math.min(3, Math.floor(radius / 3));
    for (let r = 1; r <= trailingRadius; r++) {
      const idx = direction >= 0 ? targetIndex - r : targetIndex + r;
      if (idx >= 0 && idx < TOTAL_FRAMES && !frameCache[idx] && !loadingSet.has(idx)) {
        if (!prioritized.includes(idx)) prioritized.push(idx);
      }
    }

    if (prioritized.length === 0) return;

    // Remove prioritized frames from current queue positions
    for (let i = priorityQueue.length - 1; i >= 0; i--) {
      if (prioritized.includes(priorityQueue[i])) {
        priorityQueue.splice(i, 1);
      }
    }

    // Prepend prioritized frames to front of queue
    priorityQueue.unshift(...prioritized);

    processQueue();
  }

  /**
   * Non-blocking background loader using requestIdleCallback.
   * Loads remaining unqueued frames silently in small batches.
   */
  function scheduleIdleBackgroundLoading() {
    if (loadedCount >= TOTAL_FRAMES) return;

    const scheduleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 100));

    scheduleCallback((deadline) => {
      const batchSize = networkProfile.idleBatchSize;
      let added = 0;

      for (let i = 0; i < TOTAL_FRAMES; i++) {
        if (!frameCache[i] && !loadingSet.has(i) && !priorityQueue.includes(i)) {
          priorityQueue.push(i);
          added++;
          if (added >= batchSize) break;
        }
      }

      if (added > 0) {
        processQueue();
      }

      if (loadedCount < TOTAL_FRAMES) {
        clearTimeout(idleScheduleTimer);
        idleScheduleTimer = setTimeout(scheduleIdleBackgroundLoading, 300);
      }
    });
  }

  /**
   * Progressive tiered preload strategy:
   * Tier 1: Frame 0 immediate (highest priority)
   * Tier 2: Initial window (1..initialBuffer) for instant scroll responsiveness
   * Tier 3: Idle background schedule for the remainder
   */
  function startProgressivePreloader() {
    // 1. Frame 0 immediate
    loadFrame(0);

    // 2. Initial buffer window
    const initialBuf = networkProfile.initialBuffer;
    for (let i = 1; i <= initialBuf && i < TOTAL_FRAMES; i++) {
      priorityQueue.push(i);
    }
    processQueue();

    // 3. Defer remaining sequence to idle time after initial window finishes
    setTimeout(scheduleIdleBackgroundLoading, 400);
  }

  /**
   * Update hero text highlights, progress bar, and badge states.
   */
  function updateHeroContent(progress, frameIndex) {
    const pct = Math.round(progress * 100);

    if (progressPctEl) {
      progressPctEl.textContent = `${pct}%`;
    }
    if (progressBarEl) {
      progressBarEl.style.width = `${pct}%`;
    }

    if (progressTextEl) {
      if (frameIndex < 15) {
        progressTextEl.textContent = 'Scroll to build your burger ↓';
      } else if (frameIndex < 40) {
        progressTextEl.textContent = '🔥 Flame-grilled beef patty landing';
      } else if (frameIndex < 65) {
        progressTextEl.textContent = '🧀 Melted cheddar & fresh tomatoes';
      } else if (frameIndex < 88) {
        progressTextEl.textContent = '🍔 Toasted sesame bun & signature sauce';
      } else {
        progressTextEl.textContent = '✨ Javed Double Smash Burger Ready!';
      }
    }

    if (badge1El) {
      if (frameIndex >= 15 && frameIndex <= 48) {
        badge1El.classList.add('badge-active');
      } else {
        badge1El.classList.remove('badge-active');
      }
    }

    if (badge2El) {
      if (frameIndex >= 45 && frameIndex <= 78) {
        badge2El.classList.add('badge-active');
      } else {
        badge2El.classList.remove('badge-active');
      }
    }

    if (badge3El) {
      if (frameIndex >= 75) {
        badge3El.classList.add('badge-active');
      } else {
        badge3El.classList.remove('badge-active');
      }
    }
  }

  /**
   * Initialize GSAP ScrollTrigger sequence.
   */
  function initGSAPScrollTrigger(retryCount = 0) {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      if (retryCount < 30) {
        setTimeout(() => initGSAPScrollTrigger(retryCount + 1), 100);
        return;
      }
      console.warn('GSAP or ScrollTrigger not loaded. Hero running in fallback mode.');
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const calculateScrollDistance = () => {
      const isMobile = window.innerWidth < 768;
      return isMobile ? window.innerHeight * 1.8 : window.innerHeight * 2.2;
    };

    scrollTriggerInstance = ScrollTrigger.create({
      trigger: heroSection,
      start: 'top top',
      end: () => `+=${calculateScrollDistance()}`,
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      scrub: 0.35,
      onUpdate: (self) => {
        const progress = self.progress;
        const targetFrame = Math.min(
          TOTAL_FRAMES - 1,
          Math.max(0, Math.round(progress * (TOTAL_FRAMES - 1)))
        );

        // Direction detection: 1 = forward/down, -1 = backward/up
        const dir = self.direction || (targetFrame >= activeFrameIndex ? 1 : -1);
        scrollDirection = dir;

        prioritizeFramesNear(targetFrame, dir);
        requestRenderFrame(targetFrame);
        updateHeroContent(progress, targetFrame);
      }
    });
  }

  /**
   * Debounced resize handler to prevent layout thrashing.
   */
  let resizeTimeout = null;
  function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      networkProfile = getNetworkProfile();
      requestRenderFrame(activeFrameIndex);
      if (typeof ScrollTrigger !== 'undefined' && ScrollTrigger.refresh) {
        ScrollTrigger.refresh();
      }
    }, 150);
  }

  /**
   * Initialize hero engine.
   */
  function initHero() {
    canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d', { alpha: false });

    heroSection = document.getElementById('hero');
    heroStage = heroSection ? heroSection.querySelector('.hero-stage') : null;
    progressTextEl = document.getElementById('heroProgressText');
    progressPctEl = document.getElementById('heroProgressPct');
    progressBarEl = document.getElementById('heroProgressBar');
    loaderHintEl = document.getElementById('heroLoaderHint');
    loadPctTextEl = document.getElementById('heroLoadPct');
    badge1El = document.getElementById('heroBadge1');
    badge2El = document.getElementById('heroBadge2');
    badge3El = document.getElementById('heroBadge3');

    // Immediate canvas sizing & dark fill
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw > 0 && ch > 0) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.min(Math.round(cw * dpr), 1920);
      canvas.height = Math.min(Math.round(ch * dpr), 1080);
      ctx.fillStyle = '#0F0500';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Instant First Paint: Draw Frame 0 immediately if already cached
    if (frameCache[0]) {
      isInitialFrameRendered = true;
      drawFrame(0);
    }

    // prefers-reduced-motion accessibility
    isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReducedMotion) {
      loadFrame(100).then(() => {
        requestRenderFrame(100);
      });
      return;
    }

    // Start progressive tiered preloading
    startProgressivePreloader();

    // Initialize ScrollTrigger immediately (never blocks UI)
    initGSAPScrollTrigger();

    // Event listeners
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });
  }

  // Preload Frame 0 at script evaluation time
  loadFrame(0);

  // Initialize as soon as DOM is ready
  if (document.getElementById('hero-canvas')) {
    initHero();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHero);
  } else {
    initHero();
  }

})();
