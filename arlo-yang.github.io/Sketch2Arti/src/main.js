import { ArticulationViewer, URDF_CASES } from './urdf-viewer.js';

const urdfCaseById = new Map(URDF_CASES.map((item) => [item.id, item]));

const videoGroups = [
  {
    title: 'a) Generalization: Generalizes to Diverse Objects',
    items: [
      {
        title: 'Car - Example 2',
        caseId: 'car_example_2',
      },
      {
        title: 'Bike',
        caseId: 'bike',
      },
      {
        title: 'Motorbike',
        caseId: 'motorbike',
      },
      {
        title: 'Drawer',
        caseId: 'drawer',
      },
      {
        title: 'Refrigerator',
        caseId: 'refrigerator',
      },
      {
        title: 'Windmill',
        caseId: 'windmill',
      },
    ],
  },
  {
    title: 'b) Controllability: Your Sketch Determines the Motion',
    items: [
      {
        noteBefore: 'Sketch a butterfly swing, and the car learns to open with flair.',
        title: 'Car - Butterfly Doors',
        caseId: 'car_butterfly_doors',
      },
      {
        noteBefore: 'What if the car doors open backward?',
        title: 'Car - Backward-Hinged Doors',
        caseId: 'car_backward_hinged',
      },
      {
        noteBefore: 'A leftward or rightward stroke decides which way the washer door opens.',
        title: 'Washing Machine 1',
        caseId: 'washing_machine_left',
      },
      {
        title: 'Washing Machine 2',
        caseId: 'washing_machine_right',
      },
    ],
  },
  {
    title: 'c) Beyond CAD: Joint Geometry and Articulation',
    description: 'Motion reveals what static geometry unexpected collisions.',
    items: [
      {
        title: 'Fan - Collision',
        caseId: 'fan_collision',
      },
    ],
  },
];

const caseVideo = document.querySelector('#case-video');
const caseVideoTitle = document.querySelector('#case-video-title');
const header = document.querySelector('[data-header]');
const webglSupported = hasWebGLSupport();

let viewer = null;
const embeddedLoadQueue = [];
const embeddedViewers = new WeakMap();
const embeddedViewerInstances = new Set();
const managedVideos = new Set();
let activeEmbeddedLoads = 0;
const maxEmbeddedLoads = 1;
const maxPlayingVideos = 2;
const warmupCaseIds = new Set();
let mainViewerVisible = true;

if (webglSupported) {
  try {
    viewer = new ArticulationViewer({
      canvas: document.querySelector('#urdf-canvas'),
      statusEl: document.querySelector('#viewer-status'),
      selectedJointEl: document.querySelector('#selected-joint'),
      jointControlsEl: document.querySelector('#joint-controls'),
      caseSelect: document.querySelector('#case-select'),
      resetCameraButton: document.querySelector('#reset-camera'),
      resetJointsButton: document.querySelector('#reset-joints'),
      autoplayButton: document.querySelector('#toggle-autoplay'),
      cases: URDF_CASES,
      onCaseChange: updateCaseVideo,
    });

    viewer.loadCase('car_example_1');
  } catch (error) {
    viewer = null;
    setupWebGLFallback();
    updateCaseVideo(URDF_CASES[0]);
  }
} else {
  setupWebGLFallback();
  updateCaseVideo(URDF_CASES[0]);
}

renderVideoGallery();
setupVideoVisibilityControl();
setupMainViewerVisibility();
setupEmbeddedViewerAutoload();
scheduleInteriorCompletionWarmup();
setupPageVisibilityControl();
updateHeaderState();

window.addEventListener('scroll', updateHeaderState, { passive: true });

function updateHeaderState() {
  header.classList.toggle('scrolled', window.scrollY > 12);
}

function updateCaseVideo(caseConfig) {
  if (!caseConfig || !caseVideo) {
    return;
  }

  const source = caseVideo.querySelector('source');
  source.src = caseConfig.video || './public/assets/videos/web/car_example_1_web.mp4';
  source.type = caseConfig.videoType || getVideoType(source.src);
  caseVideo.controls = false;
  caseVideo.muted = true;
  caseVideo.defaultMuted = true;
  caseVideo.disablePictureInPicture = true;
  caseVideo.disableRemotePlayback = true;
  caseVideo.poster = caseConfig.poster || getPosterForVideo(source.src);
  caseVideo.load();
  if (managedVideos.has(caseVideo)) {
    syncVideoPlayback();
  } else {
    caseVideo.play().catch(() => {});
  }

  caseVideoTitle.textContent = caseConfig.videoTitle || caseConfig.label;
}

function renderVideoGallery() {
  const gallery = document.querySelector('#video-gallery');
  if (!gallery) {
    return;
  }

  gallery.innerHTML = '';

  videoGroups.forEach((group) => {
    const groupSection = document.createElement('section');
    groupSection.className = 'gallery-group';

    const heading = document.createElement('div');
    heading.className = 'gallery-group-heading';

    const title = document.createElement('h3');
    title.textContent = group.title;

    heading.append(title);
    if (group.description) {
      const description = document.createElement('p');
      description.className = 'gallery-group-description';
      description.textContent = group.description;
      heading.append(description);
    }

    const groupList = document.createElement('div');
    groupList.className = 'gallery-group-list';

    group.items.forEach((item) => {
      if (item.noteBefore) {
        groupList.append(createGalleryNote(item.noteBefore));
      }

      const card = createGalleryCard(item);
      if (card) {
        groupList.append(card);
      }
    });

    if (groupList.children.length || group.description) {
      groupSection.append(heading, groupList);
      gallery.append(groupSection);
    }
  });
}

function createGalleryNote(text) {
  const note = document.createElement('p');
  note.className = 'gallery-demo-note';
  note.textContent = text;
  return note;
}

function createGalleryCard(item) {
  const caseConfig = item.caseId ? urdfCaseById.get(item.caseId) : null;
  const videoSrc = item.src || caseConfig?.video;

  if (!caseConfig || !videoSrc) {
    return null;
  }

  const card = document.createElement('article');
  card.className = 'paired-demo-row';
  card.dataset.caseId = caseConfig.id;

  const videoPanel = document.createElement('div');
  videoPanel.className = 'paired-video-panel';
  videoPanel.dataset.caseId = caseConfig.id;
  videoPanel.append(createPanelLabel('Video Recording'));

  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.poster = item.poster || caseConfig?.poster || getPosterForVideo(videoSrc);

  const source = document.createElement('source');
  source.src = videoSrc;
  source.type = item.videoType || caseConfig?.videoType || getVideoType(videoSrc);
  video.append(source);

  videoPanel.append(video);

  const urdfPanel = document.createElement('div');
  urdfPanel.className = 'urdf-preview-card';
  urdfPanel.setAttribute('aria-label', `${item.title} URDF viewer area`);

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'embedded-viewer-canvas-wrap';
  canvasWrap.append(createPanelLabel('URDF Animation'));

  const canvas = document.createElement('canvas');
  canvas.className = 'embedded-urdf-canvas';
  canvas.dataset.embeddedUrdf = '';
  canvas.dataset.caseId = caseConfig.id;
  canvas.setAttribute('aria-label', `URDF viewer for ${caseConfig.label}`);

  const status = document.createElement('div');
  status.className = 'mini-viewer-status';
  status.textContent = 'Preparing URDF preview...';
  canvasWrap.append(canvas, status);

  const openButton = document.createElement('button');
  openButton.className = 'open-main-viewer-button';
  openButton.type = 'button';
  openButton.textContent = 'Open Full View';
  openButton.addEventListener('click', () => {
    openCaseInMainViewer(caseConfig.id);
  });
  canvasWrap.append(openButton);

  urdfPanel.append(canvasWrap);

  card.append(videoPanel);
  card.append(urdfPanel);

  return card;
}

function openCaseInMainViewer(caseId) {
  const target = document.querySelector('#viewer');

  if (viewer && urdfCaseById.has(caseId)) {
    viewer.loadCase(caseId);
    viewer.startAnimation();
  }

  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', '#viewer');
  }
}

function createPanelLabel(text) {
  const label = document.createElement('span');
  label.className = 'panel-label';
  label.textContent = text;
  return label;
}

function setupVideoVisibilityControl() {
  const videos = Array.from(document.querySelectorAll('video[autoplay]'));

  videos.forEach((video) => {
    video.muted = true;
    video.defaultMuted = true;
    video.dataset.inView = isNearViewport(video, 60) ? 'true' : 'false';
    managedVideos.add(video);
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          video.dataset.inView = entry.isIntersecting ? 'true' : 'false';
        });
        syncVideoPlayback();
      },
      { rootMargin: '60px 0px', threshold: 0.08 },
    );

    videos.forEach((video) => observer.observe(video));
  }

  syncVideoPlayback();
}

function syncManagedVideo(video) {
  if (!video) {
    return;
  }

  if (video.dataset.shouldPlay === 'true') {
    if (!video.paused && !video.ended) {
      return;
    }
    video.play().catch(() => {});
    return;
  }

  video.pause();
}

function syncVideoPlayback() {
  const candidates = [];
  managedVideos.forEach((video) => {
    if (!('IntersectionObserver' in window)) {
      video.dataset.inView = isNearViewport(video, 60) ? 'true' : 'false';
    }

    if (!document.hidden && video.dataset.inView !== 'false') {
      candidates.push(video);
    }
  });

  candidates.sort((a, b) => getViewportVisibilityScore(b) - getViewportVisibilityScore(a));
  const activeVideos = new Set(candidates.slice(0, maxPlayingVideos));

  managedVideos.forEach((video) => {
    video.dataset.shouldPlay = activeVideos.has(video) ? 'true' : 'false';
    syncManagedVideo(video);
  });
}

function getViewportVisibilityScore(element) {
  const rect = element.getBoundingClientRect();
  const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
  const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
  const visibleArea = visibleWidth * visibleHeight;
  const totalArea = Math.max(rect.width * rect.height, 1);
  const centerY = rect.top + rect.height / 2;
  const centerDistance = Math.abs(centerY - window.innerHeight / 2) / Math.max(window.innerHeight, 1);
  return visibleArea / totalArea - centerDistance * 0.08;
}

function setupMainViewerVisibility() {
  if (!viewer) {
    return;
  }

  const target = document.querySelector('#viewer .canvas-wrap') || document.querySelector('#viewer');
  if (!target) {
    return;
  }

  mainViewerVisible = isNearViewport(target, 220);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        mainViewerVisible = Boolean(entry?.isIntersecting);
        syncMainViewerAnimation();
      },
      { rootMargin: '220px 0px', threshold: 0.01 },
    );

    observer.observe(target);
  }

  syncMainViewerAnimation();
}

function syncMainViewerAnimation() {
  if (!viewer) {
    return;
  }

  if (!document.hidden && mainViewerVisible) {
    viewer.startAnimation();
    return;
  }

  viewer.stopAnimation();
}

function setupEmbeddedViewerAutoload() {
  const canvases = Array.from(document.querySelectorAll('[data-embedded-urdf]'));

  if (!webglSupported) {
    canvases.forEach((canvas) => {
      const card = canvas.closest('.urdf-preview-card');
      const statusEl = card?.querySelector('.mini-viewer-status');
      if (statusEl) {
        statusEl.textContent = 'WebGL is unavailable in this browser; use the video result.';
      }
    });
    return;
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const miniViewer = embeddedViewers.get(entry.target);

          if (entry.isIntersecting) {
            if (miniViewer) {
              if (!document.hidden) {
                miniViewer.startAnimation();
              }
            } else {
              enqueueEmbeddedViewer(entry.target);
            }
            return;
          }

          if (miniViewer) {
            miniViewer.stopAnimation();
          }
        });
      },
      { rootMargin: '80px 0px', threshold: 0.01 },
    );

    canvases.forEach((canvas) => {
      observer.observe(canvas);
    });
  } else {
    canvases.forEach((canvas) => enqueueEmbeddedViewer(canvas));
  }

}

function setupPageVisibilityControl() {
  document.addEventListener('visibilitychange', () => {
    syncMainViewerAnimation();
    syncVideoPlayback();
    syncEmbeddedViewerAnimations();
  });
}

function scheduleInteriorCompletionWarmup() {
  if (!webglSupported) {
    return;
  }

  const canvas = document.querySelector('[data-embedded-urdf][data-case-id="drawer_interior_completion"]');
  if (!canvas) {
    return;
  }

  const warmup = () => enqueueEmbeddedViewer(canvas);
  const schedule = () => {
    if (canvas.dataset.loaded || warmupCaseIds.has(canvas.dataset.caseId)) {
      return;
    }

    warmupCaseIds.add(canvas.dataset.caseId);
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(warmup, { timeout: 4500 });
    } else {
      window.setTimeout(warmup, 1800);
    }
  };

  if (document.readyState === 'complete') {
    schedule();
  } else {
    window.addEventListener('load', schedule, { once: true });
  }
}

function enqueueEmbeddedViewer(canvas) {
  if (!canvas || canvas.dataset.loaded) {
    return;
  }

  canvas.dataset.loaded = 'queued';
  embeddedLoadQueue.push(canvas);
  drainEmbeddedLoadQueue();
}

function drainEmbeddedLoadQueue() {
  while (activeEmbeddedLoads < maxEmbeddedLoads && embeddedLoadQueue.length) {
    const canvas = embeddedLoadQueue.shift();
    activeEmbeddedLoads += 1;
    loadEmbeddedViewer(canvas).finally(() => {
      activeEmbeddedLoads -= 1;
      drainEmbeddedLoadQueue();
    });
  }
}

function loadEmbeddedViewer(canvas) {
  const caseConfig = urdfCaseById.get(canvas.dataset.caseId) || URDF_CASES[0];
  const card = canvas.closest('.urdf-preview-card');
  const statusEl = card?.querySelector('.mini-viewer-status');

  canvas.dataset.loaded = 'true';
  if (statusEl) {
    statusEl.textContent = `Loading ${caseConfig.label} URDF...`;
  }

  try {
    const miniViewer = new ArticulationViewer({
      canvas,
      statusEl,
      selectedJointEl: null,
      jointControlsEl: null,
      caseSelect: null,
      resetCameraButton: null,
      resetJointsButton: null,
      autoplayButton: null,
      cases: [caseConfig],
      compact: true,
    });

    embeddedViewers.set(canvas, miniViewer);
    embeddedViewerInstances.add(miniViewer);

    return miniViewer.loadCase(caseConfig.id).then(() => {
      if (document.hidden || !isNearViewport(canvas, 80)) {
        miniViewer.stopAnimation();
      }
    });
  } catch (error) {
    if (statusEl) {
      statusEl.textContent = 'URDF preview unavailable in this browser.';
    }
    return Promise.resolve();
  }
}

function syncEmbeddedViewerAnimations() {
  if (document.hidden) {
    embeddedViewerInstances.forEach((miniViewer) => miniViewer.stopAnimation());
    return;
  }

  document.querySelectorAll('[data-embedded-urdf]').forEach((canvas) => {
    const miniViewer = embeddedViewers.get(canvas);
    if (!miniViewer) {
      return;
    }

    if (isNearViewport(canvas, 80)) {
      miniViewer.startAnimation();
    } else {
      miniViewer.stopAnimation();
    }
  });
}

function isNearViewport(element, margin = 300) {
  const rect = element.getBoundingClientRect();
  return rect.bottom >= -margin && rect.top <= window.innerHeight + margin;
}

function getVideoType(src) {
  return 'video/mp4';
}

function getPosterForVideo(src) {
  const cleanSrc = src.split('#')[0].split('?')[0];
  const filename = cleanSrc.split('/').pop() || '';
  const base = filename.replace(/\.[^.]+$/, '').replace(/_web$/, '');
  return `./public/assets/posters/${base}.jpg`;
}

function hasWebGLSupport() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch (error) {
    return false;
  }
}

function setupWebGLFallback() {
  const statusEl = document.querySelector('#viewer-status');
  const selectedJointEl = document.querySelector('#selected-joint');
  const jointControlsEl = document.querySelector('#joint-controls');
  const autoplayButton = document.querySelector('#toggle-autoplay');
  const resetCameraButton = document.querySelector('#reset-camera');
  const resetJointsButton = document.querySelector('#reset-joints');

  if (statusEl) {
    statusEl.textContent = 'WebGL is unavailable in this browser; videos and figures remain available.';
  }
  if (selectedJointEl) {
    selectedJointEl.textContent = 'Interactive URDF requires WebGL.';
  }
  if (jointControlsEl) {
    jointControlsEl.innerHTML = '<p class="empty-joints">Interactive joint controls require WebGL.</p>';
  }

  [autoplayButton, resetCameraButton, resetJointsButton].forEach((button) => {
    if (button) {
      button.disabled = true;
    }
  });

}
