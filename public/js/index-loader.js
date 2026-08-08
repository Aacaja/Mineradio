'use strict';

(function loadMineradioIndexModules() {
  // Module loader v2: async ordered loading.
  //
  // The previous loader fetched every module with a synchronous XMLHttpRequest
  // and executed them as one concatenated script.  A synchronous XHR blocks the
  // renderer main thread, so when the local gateway answered slowly (cold
  // Windows start, antivirus scanning, busy event loop) the page `load` event
  // never fired and the main window navigation in desktop/main.js timed out
  // (MR-BOOT-WINDOW-LOAD).  This version appends real <script> tags in order
  // (async=false keeps execution order), never blocks parsing, lets `load`
  // fire promptly, and tolerates a single slow/failed module by retrying it
  // once before continuing.
  //
  // Execution order is preserved by `script.async = false` on dynamically
  // inserted scripts.  Modules that initialized on DOMContentLoaded are
  // defensive about `document.readyState` (see modules like
  // 08-library/00-library-runtime.js); if the browser already fired
  // DOMContentLoaded while modules were still downloading, this loader emits a
  // compensating DOMContentLoaded event once so those initializers still run.

  const moduleCacheBust = String(Date.now());
  const modulePaths = [
    'js/modules/00-state/00-core-stores.js',
    'js/modules/00-state/01-perf-render-state.js',
    'js/modules/00-state/02-preferences-ui-modes.js',
    'js/modules/00-state/03-beat-dj-state.js',
    'js/modules/00-state/04-fx-defaults.js',
    'js/modules/00-state/05-packaged-fx-archive.js',
    'js/modules/00-state/06-fx-runtime-layout.js',
    'js/modules/00-state/07-ui-playback-runtime.js',
    'js/modules/00-state/08-desktop-render-power.js',
    'js/modules/00-state/09-performance-probe.js',
    'js/modules/00-state/10-frame-scheduler.js',
    'js/modules/00-state/11-system-memory-controls.js',
    'js/modules/01-scene/00-renderer-quality.js',
    'js/modules/01-scene/01-orbit-free-camera.js',
    'js/modules/01-scene/02-beat-camera-runtime.js',
    'js/modules/01-scene/03-focus-cinema-camera.js',
    'js/modules/01-scene/04-bottom-controls-cursor.js',
    'js/modules/02-visual/00-pointer-cover-particles.js',
    'js/modules/02-visual/01-float-skull-backcover.js',
    'js/modules/02-visual/02-lyrics-state-layout.js',
    'js/modules/02-visual/03-lyrics-star-river.js',
    'js/modules/02-visual/04-visual-settings-persistence.js',
    'js/modules/02-visual/05-lyrics-fonts-texture.js',
    'js/modules/02-visual/06-custom-background-colorlab.js',
    'js/modules/02-visual/07-lyrics-palette-text-utils.js',
    'js/modules/02-visual/08-lyrics-display-modes.js',
    'js/modules/02-visual/09-lyrics-payloads.js',
    'js/modules/02-visual/10-lyrics-mask-textures.js',
    'js/modules/02-visual/11-lyrics-shaders.js',
    'js/modules/02-visual/12-lyrics-row-layers.js',
    'js/modules/02-visual/13-lyrics-mesh-build.js',
    'js/modules/02-visual/14-stage-lyrics-rendering.js',
    'js/modules/02-visual/15-ripples-cover-depth.js',
    'sonic-topography-preset.js',
    'sonic-workshop-preset.js',
    'js/modules/03-beat/00-tempo-worker-cache-prefetch.js',
    'js/modules/03-beat/01-audio-beat-analysis.js',
    'js/modules/03-beat/02-podcast-dj-analysis.js',
    'js/modules/03-beat/03-local-beat-cache-modal.js',
    'js/modules/03-beat/04-beat-map-runtime.js',
    'js/modules/03-beat/05-cover-loading-crop.js',
    'js/modules/03-beat/06-sonic-audio-monitor.js',
    'js/modules/04-shelf/00-layout-hover.js',
    'js/modules/04-shelf/01-manager-core.js',
    'js/modules/04-shelf/02-rebuild-panel-sync.js',
    'js/modules/04-shelf/03-content-list-manager.js',
    'js/modules/04-shelf/04-cover-api-helpers.js',
    'js/modules/04-shelf/05-card-interactions.js',
    'js/modules/04-shelf/06-keyboard-camera-events.js',
    'js/modules/05-playback/00-api-quality-output.js',
    'js/modules/05-playback/01-cover-custom-map.js',
    'js/modules/05-playback/02-listen-stats.js',
    'js/modules/05-playback/03-home-discover-weather.js',
    'js/modules/05-playback/03a-home-dashboard.js',
    'js/modules/05-playback/04-home-empty-wallpaper.js',
    'js/modules/05-playback/05-home-actions.js',
    'js/modules/05-playback/06-track-detail-lyrics-actions.js',
    'js/modules/05-playback/07-search.js',
    'js/modules/05-playback/08-audio-graph-controls.js',
    'js/modules/05-playback/09-queue-snapshot-autoplay.js',
    'js/modules/05-playback/10-queue-actions.js',
    'js/modules/05-playback/11-provider-fallback.js',
    'js/modules/05-playback/12-playback-switch-core.js',
    'js/modules/05-playback/13-playback-start-audio.js',
    'js/modules/05-playback/14-player-controls.js',
    'js/modules/05-playback/15-control-glass-animations.js',
    'js/modules/05-playback/16-cuefield-automix-core.js',
    'js/modules/05-playback/17-cuefield-timeline-executor.js',
    'js/modules/05-playback/18-cuefield-automix-integration.js',
    'js/modules/06-lyrics/00-lyrics-fetch-parse.js',
    'js/modules/06-lyrics/01-playlist-panel-shell.js',
    'js/modules/06-lyrics/02-playlist-detail.js',
    'js/modules/06-lyrics/03-podcast-playlist-loaders.js',
    'js/modules/06-lyrics/04-progress-seek.js',
    'js/modules/06-lyrics/05-upload-dragdrop.js',
    'js/modules/06-lyrics/06-lyric-timing-offset.js',
    'js/modules/07-fx/00-preset-archive-data.js',
    'js/modules/07-fx/01-lyric-color-controls.js',
    'js/modules/07-fx/02-accent-background-controls.js',
    'js/modules/07-fx/03-wallpaper-engine-library.js',
    'js/modules/07-fx/03-cover-picker-fonts.js',
    'js/modules/07-fx/04-preset-grid-uniforms.js',
    'js/modules/07-fx/05-fx-panel-performance.js',
    'js/modules/07-fx/06-hotkeys.js',
    'js/modules/07-fx/07-bindings-shelf-immersive.js',
    'js/modules/07-fx/08-cache-storage-settings.js',
    'js/modules/07-fx/09-console-workspace.js',
    'js/modules/08-account/00-update-preview.js',
    'js/modules/08-account/00-login-easter-egg.js',
    'js/modules/08-account/01-login-modal-utils.js',
    'js/modules/08-account/02-login-status.js',
    'js/modules/08-account/03-login-modal-flows.js',
    'js/modules/08-account/04-user-modal-logout.js',
    'js/modules/08-account/05-startup-login-guide.js',
    'js/modules/08-library/00-library-runtime.js',
    'js/modules/08-library/01-library-browser.js',
    'js/modules/09-idle-toast-libraries.js',
    'js/modules/10-shell/00-gesture-control.js',
    'js/modules/10-shell/01-viewport-resize-shortcuts.js',
    'js/modules/10-shell/02-peek-panels-upload.js',
    'js/modules/10-shell/03-splash.js',
    'js/modules/10-shell/04-desktop-overlay-fullscreen.js',
    'js/modules/10-shell/05-startup-bindings.js',
    'js/modules/11-main-loop.js',
  ];

  const state = {
    total: modulePaths.length,
    loaded: 0,
    failed: [],
    startedAt: Date.now(),
    finishedAt: 0,
    ok: false,
  };
  try { window.__mineradioModuleLoader = state; } catch (_) {}

  function urlFor(path) {
    return path + (path.indexOf('?') >= 0 ? '&' : '?') + 'v=' + moduleCacheBust;
  }

  function loadModule(path) {
    return new Promise((resolve) => {
      let settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        state.loaded += 1;
        resolve();
      }
      function append(src, retried) {
        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.onload = finish;
        script.onerror = () => {
          // Retry state lives in the closure, not on the element: a retry
          // appends a brand-new <script> whose attributes start empty.
          if (!retried) {
            console.warn('[IndexLoader] retrying module:', path);
            append(src, true);
            return;
          }
          state.failed.push(path);
          console.error('[IndexLoader] module failed after retry:', path);
          finish();
        };
        document.head.appendChild(script);
      }
      append(urlFor(path), false);
    });
  }

  (async function run() {
    for (let index = 0; index < modulePaths.length; index += 1) {
      await loadModule(modulePaths[index]);
    }
    state.finishedAt = Date.now();
    state.ok = state.failed.length === 0;
    console.log('[IndexLoader] loaded ' + state.loaded + '/' + state.total + ' modules in ' + (state.finishedAt - state.startedAt) + 'ms' + (state.failed.length ? ', failed: ' + state.failed.join(', ') : ''));
    // Compensating DOMContentLoaded: when module downloads outlasted the
    // parser, readyState is already past 'loading' and initializers that were
    // registered for DOMContentLoaded would never run.  Modules are defensive
    // (readyState checks / once listeners), so re-dispatching here only wakes
    // up listeners that missed the real event.
    if (document.readyState !== 'loading') {
      try { document.dispatchEvent(new Event('DOMContentLoaded')); } catch (_) {}
    }
  })().catch((error) => {
    console.error('[IndexLoader] fatal loader error:', error && error.message || error);
  });
})();
