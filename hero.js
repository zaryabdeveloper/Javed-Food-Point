/**
 * ══════════════════════════════════════════════════════════════════
 * JAVED FOOD POINT — HERO CANVAS SCROLL ENGINE
 * 101-Frame Double Smash Burger Assembly Sequence
 * 
 * Tech Stack: HTML5 Canvas, GSAP 3, ScrollTrigger
 * ══════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  // ── CONSTANTS & CONFIGURATION ──
  const TOTAL_FRAMES = 101; // Frame000000.png to Frame000100.png
  const FRAME_DIR = 'burger-frames/';
  const FRAME_PREFIX = 'Frame';
  const FRAME_EXT = '.png';
  const NATIVE_WIDTH = 1280;
  const NATIVE_HEIGHT = 720;
  const BURGER_SUBJECT_WIDTH = 720; // Width of burger subject in frame

  // ── STATE ──
  const frameCache = new Array(TOTAL_FRAMES).fill(null);
  let loadedCount = 0;
  let activeFrameIndex = 0;
  let isInitialFrameRendered = false;
  let renderRafId = null;
  let scrollTriggerInstance = null;
  let isReducedMotion = false;

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
   * Constructs the padded filename for a given 0-based frame index.
   * e.g., 0 -> "Frame000000.png", 100 -> "Frame000100.png"
   */
  function getFrameFilename(index) {
    const padded = String(index).padStart(6, '0');
    return `${FRAME_DIR}${FRAME_PREFIX}${padded}${FRAME_EXT}`;
  }

  /**
   * Find the nearest available loaded frame image in cache.
   * Prioritizes backwards search (most natural during forward scroll),
   * then searches forward. Guarantees no blank canvas once Frame 0 loads.
   */
  function getNearestLoadedImage(targetIndex) {
    if (frameCache[targetIndex]) return frameCache[targetIndex];

    // Search backwards
    for (let i = targetIndex - 1; i >= 0; i--) {
      if (frameCache[i]) return frameCache[i];
    }
    // Search forwards
    for (let i = targetIndex + 1; i < TOTAL_FRAMES; i++) {
      if (frameCache[i]) return frameCache[i];
    }
    return null;
  }

  /**
   * Render a specific frame to the HTML5 canvas with DPR scaling,
   * aspect-ratio preservation (object-fit: cover logic), and centering.
   */
  function drawFrame(frameIndex) {
    if (!canvas || !ctx) return;

    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw === 0 || ch === 0) return;

    // High-DPI handling: cap at 2x for optimal mobile memory & performance
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetBufferWidth = Math.round(cw * dpr);
    const targetBufferHeight = Math.round(ch * dpr);

    if (canvas.width !== targetBufferWidth || canvas.height !== targetBufferHeight) {
      canvas.width = targetBufferWidth;
      canvas.height = targetBufferHeight;
    }

    // Fill background with exact dark tone from burger frames
    ctx.fillStyle = '#0F0500';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = getNearestLoadedImage(frameIndex);
    if (!img) return; // Wait for at least 1 frame

    const iw = img.naturalWidth || NATIVE_WIDTH;
    const ih = img.naturalHeight || NATIVE_HEIGHT;
    const imgRatio = iw / ih; // ~1.777778 (16:9)
    const canvasRatio = cw / ch;

    let renderW, renderH, drawX, drawY;

    const isLandscape = (cw > ch && ch <= 600) || cw >= 992;

    if (isLandscape) {
      // ── DESKTOP & WIDE / LANDSCAPE SCREENS ──
      // Standard object-fit: cover with right-biased focal centering
      // so burger is visible beside left-aligned hero text.
      if (canvasRatio > imgRatio) {
        renderW = cw;
        renderH = cw / imgRatio;
      } else {
        renderH = ch;
        renderW = ch * imgRatio;
      }

      const horizontalCenter = cw * 0.62; // 62% focal anchor
      drawX = horizontalCenter - (renderW * 0.5);
      drawY = (ch - renderH) / 2;
    } else {
      // ── MOBILE & TABLET PORTRAIT ──
      // Calculate responsive scale to ensure the burger subject fits horizontally
      // without getting clipped at screen edges, and centered in the middle visual window.
      const subjectFitScale = (cw * 0.90) / BURGER_SUBJECT_WIDTH;
      const fullCoverScale = Math.max(cw / iw, ch / ih);
      
      const chosenScale = Math.min(fullCoverScale, Math.max(cw / iw, subjectFitScale));

      renderW = iw * chosenScale;
      renderH = ih * chosenScale;
      drawX = (cw - renderW) / 2;
      
      // Center burger in the optical center between header block and bottom action block
      const middleCenterY = ch * 0.46;
      drawY = middleCenterY - (renderH * 0.5);
    }

    // Draw scaled frame to high-DPI buffer
    ctx.drawImage(
      img,
      Math.round(drawX * dpr),
      Math.round(drawY * dpr),
      Math.round(renderW * dpr),
      Math.round(renderH * dpr)
    );

    activeFrameIndex = frameIndex;
  }

  /**
   * Request a canvas draw on the next animation frame to prevent redundant repaints.
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
   * Preload a single frame and optionally decode it off the main thread.
   */
  function loadFrame(index) {
    return new Promise((resolve) => {
      if (frameCache[index]) {
        resolve(frameCache[index]);
        return;
      }

      const img = new Image();
      img.src = getFrameFilename(index);

      const onImageReady = async () => {
        try {
          if (typeof img.decode === 'function') {
            await img.decode();
          }
        } catch (err) {
          // Decode failure fallback: image is still usable via drawImage
        }
        frameCache[index] = img;
        loadedCount++;
        handleFrameLoaded(index);
        resolve(img);
      };

      img.onload = onImageReady;
      img.onerror = () => {
        // Resolve on error to avoid blocking the queue
        resolve(null);
      };
    });
  }

  /**
   * Called whenever a new frame finishes loading.
   */
  function handleFrameLoaded(index) {
    // If this is Frame 0, render immediately so Canvas is never blank
    if (index === 0 && !isInitialFrameRendered) {
      isInitialFrameRendered = true;
      requestRenderFrame(0);
    } else if (index === activeFrameIndex) {
      // Re-render current frame if it just loaded
      requestRenderFrame(index);
    }

    // Update loader indicator
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
   * Smart preloader:
   * 1. Priority 1: Frame 0 (immediate display)
   * 2. Priority 2: Keyframes every 10 frames (enables instant rough scrubbing)
   * 3. Priority 3: Worker queue with concurrency = 4 for remaining frames
   */
  async function startImagePreloader() {
    // Step 1: Load Frame 0 immediately
    await loadFrame(0);

    // Step 2: Keyframe indices
    const keyframes = [];
    for (let i = 10; i <= 100; i += 10) {
      keyframes.push(i);
    }

    // Step 3: All remaining frames
    const remainingFrames = [];
    for (let i = 1; i < TOTAL_FRAMES; i++) {
      if (!keyframes.includes(i)) {
        remainingFrames.push(i);
      }
    }

    const queue = [...keyframes, ...remainingFrames];
    const CONCURRENCY = 4; // Max concurrent network downloads
    let activeWorkers = 0;
    let qIndex = 0;

    function processQueue() {
      while (activeWorkers < CONCURRENCY && qIndex < queue.length) {
        const frameIdx = queue[qIndex++];
        activeWorkers++;
        loadFrame(frameIdx).finally(() => {
          activeWorkers--;
          processQueue();
        });
      }
    }

    processQueue();
  }

  /**
   * Update text highlights, assembly progress bar, and badge states
   * based on scroll progress (0.0 to 1.0) and frameIndex (0 to 100).
   */
  function updateHeroContent(progress, frameIndex) {
    const pct = Math.round(progress * 100);

    // Update Progress Pill
    if (progressPctEl) {
      progressPctEl.textContent = `${pct}%`;
    }
    if (progressBarEl) {
      progressBarEl.style.width = `${pct}%`;
    }

    // Dynamic descriptive status message
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

    // Floating Badge Active States based on current assembly stage
    if (badge1El) {
      // Hot & Fresh highlights when patty is sizzling (frames 15-45)
      if (frameIndex >= 15 && frameIndex <= 48) {
        badge1El.classList.add('badge-active');
      } else {
        badge1El.classList.remove('badge-active');
      }
    }

    if (badge2El) {
      // 100% Halal highlights when cheddar & tomatoes land (frames 45-75)
      if (frameIndex >= 45 && frameIndex <= 78) {
        badge2El.classList.add('badge-active');
      } else {
        badge2El.classList.remove('badge-active');
      }
    }

    if (badge3El) {
      // Fast Delivery highlights when burger is complete and ready (frames 75-100)
      if (frameIndex >= 75) {
        badge3El.classList.add('badge-active');
      } else {
        badge3El.classList.remove('badge-active');
      }
    }
  }

  /**
   * Initialize GSAP ScrollTrigger for the pinned hero scrub sequence.
   * Includes graceful retry for slow networks if GSAP CDN is still loading.
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

    // Calculate responsive scroll distance
    const calculateScrollDistance = () => {
      const isMobile = window.innerWidth < 768;
      // 1.8x viewport height on mobile, 2.2x on desktop for cinematic pacing
      return isMobile ? window.innerHeight * 1.8 : window.innerHeight * 2.2;
    };

    const animState = { frame: 0 };

    scrollTriggerInstance = ScrollTrigger.create({
      trigger: heroSection,
      start: 'top top',
      end: () => `+=${calculateScrollDistance()}`,
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      scrub: 0.35, // Smooth scrub without jumping or over-lagging
      onUpdate: (self) => {
        const progress = self.progress;
        const targetFrame = Math.min(
          TOTAL_FRAMES - 1,
          Math.max(0, Math.round(progress * (TOTAL_FRAMES - 1)))
        );

        animState.frame = targetFrame;
        requestRenderFrame(targetFrame);
        updateHeroContent(progress, targetFrame);
      }
    });
  }

  /**
   * Handle resize and orientation changes cleanly.
   * Debounces execution and calls ScrollTrigger.refresh() without duplicating triggers.
   */
  let resizeTimeout = null;
  function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      requestRenderFrame(activeFrameIndex);
      if (typeof ScrollTrigger !== 'undefined' && ScrollTrigger.refresh) {
        ScrollTrigger.refresh();
      }
    }, 150);
  }

  /**
   * Initialize the Hero Rebuild component.
   */
  function initHero() {
    canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d', { alpha: false }); // alpha: false for faster GPU rendering

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

    // Check for prefers-reduced-motion
    isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isReducedMotion) {
      // Reduced motion mode: load Frame 100 (fully assembled burger) and display statically
      loadFrame(100).then(() => {
        requestRenderFrame(100);
      });
      return;
    }

    // Start preloading frames
    startImagePreloader();

    // Initialize ScrollTrigger
    initGSAPScrollTrigger();

    // Listen for resize and orientation change
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHero);
  } else {
    initHero();
  }

})();
