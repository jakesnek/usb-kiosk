
let currentDrive = null;
let imageList = [];
let imageIndex = 0;
const driveContainer = document.getElementById('driveContainer');
const viewer = document.getElementById('viewer');
const SUPPORTED_VIDEO = ['mp4', 'webm', 'ogg'];
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'heic'];

function debounce(fn, ms) {
  let blocked = false;
  return (...args) => {
    if (blocked) return;
    blocked = true;
    setTimeout(() => blocked = false, ms);
    return fn(...args);
  };
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed').forEach(el => el.remove());
  doc.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
    }
  });
  return doc.body.innerHTML;
}

function showToast(message, type = "info") {
  const existing = document.getElementById("toastContainer");
  const container = existing || document.createElement("div");
  if (!existing) {
    container.id = "toastContainer";
    container.className = "toast-container position-fixed bottom-0 end-0 p-3";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast align-items-center text-bg-${type} border-0 show mb-2`;
  toast.role = "alert";
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  container.appendChild(toast);
  
  // Auto-dismiss after 3 seconds (shorter for touch UX)
  setTimeout(() => toast.remove(), 3000);
}

async function refreshDriveList() {
  const drives = await window.api.listUsbDrives();
  renderDriveButtons(drives);
}

function renderDriveButtons(drives) {
  driveContainer.innerHTML = "";

  if (!drives.length) {
    driveContainer.innerHTML = "<p>No USB drives detected.</p>";
    return;
  }

  drives.forEach((drivePath) => {
    const btn = document.createElement("button");
    btn.className = "btn btn-dark m-1 w-100";
    btn.textContent = drivePath;
    
    btn.addEventListener("click", debounce(async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...';
      const files = await window.api.readDirectory(drivePath);
      currentDrive = { path: drivePath, files };
      populateTabs(currentDrive);
    }, 500));
    driveContainer.appendChild(btn);
  });
}

const EMPTY_STATE = `<div class="empty-state">
  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="currentColor" viewBox="0 0 16 16">
    <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zm0 1h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1"/>
  </svg>
  <p>Select a file to view</p>
  <span>Open the sidebar to browse USB drives</span>
</div>`;

function resetViewer() {
  const viewer = document.getElementById('viewer');
  viewer.className = '';
  viewer.removeAttribute('style');
  viewer.innerHTML = EMPTY_STATE;
  setFileName(null);
}

window.api.onUsbUpdate(async ({ drives, added, removed }) => {
  if (added.length) showToast(`USB inserted: ${added.join(', ')}`, "success");
  if (removed.length) {
    showToast(`USB removed: ${removed.join(', ')}`, "danger");
    if (currentDrive && removed.some(r => currentDrive.path.startsWith(r))) {
      currentDrive = null;
      resetViewer();
    }
  }
  renderDriveButtons(drives);
});

function getFileCount(files, type) {
  const extMap = {
    'Videos': ['mp4', 'webm', 'ogg', 'mkv', 'avi'],
    'Images': ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'heic'],
    'Documents': ['pdf', 'docx', 'txt', 'xlsx']
  };
  const exts = extMap[type] || [];
  return files.filter(f => exts.includes((f.split('.').pop() || '').toLowerCase())).length;
}

function populateTabs(drive) {
  driveContainer.innerHTML = '';

  // Back button to return to drive list
  const backBtn = document.createElement('button');
  backBtn.className = 'btn btn-back';
  backBtn.innerHTML = '&larr; Back to drives';
  backBtn.addEventListener('click', debounce(async () => {
    currentDrive = null;
    await refreshDriveList();
  }, 300));
  driveContainer.appendChild(backBtn);

  const tabs = document.createElement('ul');
  tabs.className = 'nav nav-tabs';
  const tabNames = ['Videos', 'Images', 'Documents'];

  tabNames.forEach((type, i) => {
    const li = document.createElement('li');
    li.className = 'nav-item';
    const a = document.createElement('a');
    a.className = 'nav-link';
    if (i === 0) a.classList.add('active');
    a.href = '#';
    const count = getFileCount(drive.files, type);
    a.textContent = `${type} (${count})`;

    const handleTab = debounce(() => {
      Array.from(li.parentElement.children).forEach(c => c.firstChild.classList.remove('active'));
      a.classList.add('active');
      showFiles(drive.files, type, drive.path);
    }, 300);

    a.addEventListener('click', (e) => {
      e.preventDefault();
      handleTab();
    });

    li.appendChild(a);
    tabs.appendChild(li);
  });

  driveContainer.appendChild(tabs);

  const fileListDiv = document.createElement('div');
  fileListDiv.id = 'fileList';
  driveContainer.appendChild(fileListDiv);

  showFiles(drive.files, 'Videos', drive.path);
}

function showFiles(files, type, dirPath) {
  const container = document.getElementById('fileList');
  
  // Quick fade out
  container.style.opacity = '0';
  
  setTimeout(() => {
    container.innerHTML = '';

    const extMap = {
      'Videos': ['mp4', 'webm', 'ogg', 'mkv', 'avi'],
      'Images': ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'heic'],
      'Documents': ['pdf', 'docx', 'txt', 'xlsx']
    };

    const exts = extMap[type] || [];

    files.forEach(f => {
      const ext = (f.split('.').pop() || '').toLowerCase();
      if (exts.includes(ext)) {
        const btn = document.createElement('button');
        const cleanName = f.replace(/^([A-Za-z]:[\\/])/, '');
        btn.textContent = cleanName;
        btn.className = 'btn btn-dark m-1';
        
        btn.addEventListener('click', debounce(async () => {
          if (btn.disabled) return;
          await openFile(f, ext, btn);
        }, 500));
        
        container.appendChild(btn);
      }
    });

    if (!container.children.length) {
      container.innerHTML = `<p>No ${type} files found.</p>`;
    }

    // Quick fade in
    container.style.opacity = '1';
  }, 150);
}

async function showImage(filePath, ext) {
  setFileName(filePath.split(/[\\/]/).pop());
  // Show loading spinner immediately, keep viewer visible
  viewer.className = 'media-mode';
  viewer.style.opacity = '1';
  viewer.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading image...</span>
      </div>
      <p class="mt-3" style="color:var(--ny-gold);">${ext === 'heic' ? 'Converting HEIC image...' : 'Loading image...'}</p>
    </div>`;

  let imgSrc = `file://${filePath}`;
  if (ext === 'heic') {
    const result = await window.api.convertHeic(filePath);
    if (!result.success) {
      viewer.innerHTML = `<p style="color:#8B0000;">Failed to load image: ${escapeHtml(result.error)}</p>`;
      return;
    }
    imgSrc = result.data;
  }

  viewer.innerHTML = `
    <div class="image-carousel">
      ${imageList.length > 1 ? `<button class="carousel-btn carousel-prev" id="imgPrev">&lsaquo;</button>` : ''}
      <button id="resetZoomBtn"
        class="btn btn-outline-light btn-sm"
        style="position:absolute;top:15px;right:15px;z-index:10;opacity:0.9;">
        Reset View
      </button>
      <img id="zoomableImg" src="${imgSrc}"
        style="width:100%;height:100%;object-fit:contain;transform-origin:center;">
      ${imageList.length > 1 ? `
        <span class="carousel-counter">${imageIndex + 1} / ${imageList.length}</span>
        <button class="carousel-btn carousel-next" id="imgNext">&rsaquo;</button>
      ` : ''}
    </div>`;

  const zoomableImage = document.getElementById('zoomableImg');
  const resetBtn = document.getElementById('resetZoomBtn');

  zoomableImage.addEventListener('load', () => {
    const zoomed = Panzoom(zoomableImage, {
      maxScale: 20,
      minScale: 1,
      step: 0.8,
      contain: 'outside',
      animate: true,
      duration: 100
    });

    zoomableImage.parentElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoomed.zoomWithWheel(e);
    }, { passive: false });

    resetBtn.addEventListener('click', debounce(() => {
      zoomed.reset({ animate: true });
    }, 300));
  });

  const navigateImage = debounce(async (dir) => {
    imageIndex = (imageIndex + dir + imageList.length) % imageList.length;
    const nextPath = imageList[imageIndex];
    const nextExt = (nextPath.split('.').pop() || '').toLowerCase();
    await showImage(nextPath, nextExt);
  }, 300);

  const prevBtn = document.getElementById('imgPrev');
  const nextBtn = document.getElementById('imgNext');
  if (prevBtn) prevBtn.addEventListener('click', () => navigateImage(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => navigateImage(1));
}

async function openFile(filePath, ext, button) {
  const fileName = filePath.split(/[\\/]/).pop();
  setFileName(fileName);

  // Add loading state to button
  const originalText = button.textContent;
  button.disabled = true;
  button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...';

  // Images skip the fade — showImage handles its own loading state
  if (IMAGE_EXTS.includes(ext)) {
    if (currentDrive) {
      imageList = currentDrive.files.filter(f => IMAGE_EXTS.includes((f.split('.').pop() || '').toLowerCase()));
      imageIndex = imageList.indexOf(filePath);
    }
    await showImage(filePath, ext);
    button.textContent = originalText;
    button.disabled = false;
    return;
  }

  // Quick fade out
  viewer.style.opacity = '0';

  setTimeout(async () => {
    viewer.innerHTML = '';
    viewer.className = '';
    viewer.classList.add('media-mode');

    // Videos
    if (['mp4', 'webm', 'ogg', 'mkv', 'avi'].includes(ext)) {
      if (!SUPPORTED_VIDEO.includes(ext)) {
        viewer.innerHTML = `<p style="color:var(--ny-gold);">This video format (.${ext}) is not supported for playback.</p>`;
        viewer.style.opacity = '1';
        button.textContent = originalText;
        button.disabled = false;
        return;
      }
      viewer.innerHTML = `<video controls disablePictureInPicture controlsList="noplaybackrate" style="width:100%;height:100%;object-fit:contain;"><source src="file://${filePath}" type="video/${ext}"></video>`;
      viewer.style.opacity = '1';
      button.textContent = originalText;
      button.disabled = false;
      return;
    }

    // PDFs
    if (ext === 'pdf') {
      viewer.classList.add('pdf-mode');
      viewer.innerHTML = `
        <div id="pdfContainer">
          <div class="text-center py-5">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Loading PDF...</span>
            </div>
            <p class="mt-3" style="color:white;">Loading PDF...</p>
          </div>
          <canvas id="pdfCanvas"></canvas>
          <div id="pdfControls">
            <button id="zoomOut" class="pdf-ctrl-btn" title="Zoom out">&minus;</button>
            <button id="prevPage" class="pdf-ctrl-btn" title="Previous page">&lsaquo;</button>
            <span id="pageInfo"></span>
            <button id="nextPage" class="pdf-ctrl-btn" title="Next page">&rsaquo;</button>
            <button id="zoomIn" class="pdf-ctrl-btn" title="Zoom in">&plus;</button>
          </div>
        </div>`;
      
      viewer.style.opacity = '1';
      
      // Load PDF
      const loadingTask = pdfjsLib.getDocument(`file://${filePath}`);
      loadingTask.promise.then(pdf => {
        let currentPage = 1;
        let zoomLevel = 0;
        const numPages = pdf.numPages;
        const ZOOM_MULTIPLIERS = [1.0, 1.25, 1.5, 2.0, 2.5, 3.0];

        function renderPage(pageNum) {
          pdf.getPage(pageNum).then(page => {
            const canvas = document.getElementById('pdfCanvas');
            const container = document.getElementById('pdfContainer');
            const context = canvas.getContext('2d');
            const baseViewport = page.getViewport({ scale: 1 });
            const fitWidth = (container.clientWidth - 40) / baseViewport.width;
            const fitHeight = (container.clientHeight - 40) / baseViewport.height;
            const fitScale = Math.min(fitWidth, fitHeight);
            const scale = fitScale * ZOOM_MULTIPLIERS[zoomLevel];
            const viewport = page.getViewport({ scale });

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            page.render({
              canvasContext: context,
              viewport: viewport
            });

            // Center when fits, scroll from top when zoomed past container
            container.classList.toggle('scrollable', viewport.height > container.clientHeight);
            document.getElementById('pageInfo').textContent = `${pageNum} / ${numPages}`;
          });
        }

        renderPage(currentPage);

        // Show controls and hide loading
        document.querySelector('#pdfContainer > div').style.display = 'none';
        document.getElementById('pdfControls').style.display = 'flex';

        document.getElementById('prevPage').onclick = debounce(() => {
          if (currentPage <= 1) return;
          currentPage--;
          renderPage(currentPage);
          document.getElementById('pdfContainer').scrollTop = 0;
        }, 300);

        document.getElementById('nextPage').onclick = debounce(() => {
          if (currentPage >= numPages) return;
          currentPage++;
          renderPage(currentPage);
          document.getElementById('pdfContainer').scrollTop = 0;
        }, 300);

        document.getElementById('zoomIn').onclick = debounce(() => {
          if (zoomLevel >= ZOOM_MULTIPLIERS.length - 1) return;
          zoomLevel++;
          renderPage(currentPage);
        }, 200);

        document.getElementById('zoomOut').onclick = debounce(() => {
          if (zoomLevel <= 0) return;
          zoomLevel--;
          renderPage(currentPage);
        }, 200);
      }).catch(err => {
        viewer.innerHTML = `<p style="color:#8B0000;">Failed to load PDF: ${err.message}</p>`;
      });
      
      button.textContent = originalText;
      button.disabled = false;
      return;
    }

    // DOCX
    if (ext === 'docx') {
      viewer.classList.add('text-mode');
      viewer.innerHTML = `
        <div class="docx-viewer">
          <div class="text-center py-5">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3">Loading document...</p>
          </div>
        </div>`;
      viewer.style.opacity = '1';

      const result = await window.api.convertDocx(filePath);

      viewer.style.opacity = '0';
      setTimeout(() => {
        viewer.innerHTML = result.success
          ? `<div class="docx-viewer">${result.html}</div>`
          : `<div class="docx-viewer"><p style="color:#8B0000;">Failed to load document: ${escapeHtml(result.error)}</p></div>`;
        viewer.style.opacity = '1';
      }, 100);

      button.textContent = originalText;
      button.disabled = false;
      return;
    }

    // Excel
    if (ext === 'xlsx') {
      viewer.classList.add('text-mode');
      viewer.innerHTML = `
        <div class="xlsx-viewer">
          <div class="text-center py-5">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3">Loading spreadsheet...</p>
          </div>
        </div>`;
      viewer.style.opacity = '1';

      const result = await window.api.convertXlsx(filePath);

      viewer.style.opacity = '0';
      setTimeout(() => {
        viewer.innerHTML = result.success
          ? `<div class="xlsx-viewer">${result.html}</div>`
          : `<div class="xlsx-viewer"><p style="color:#8B0000;">Failed to load spreadsheet: ${escapeHtml(result.error)}</p></div>`;
        viewer.style.opacity = '1';
      }, 100);

      button.textContent = originalText;
      button.disabled = false;
      return;
    }

    // TXT
    if (ext === 'txt') {
      viewer.classList.add('text-mode');
      viewer.innerHTML = `
        <div class="txt-viewer">
          <div class="text-center py-5">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3">Loading text file...</p>
          </div>
        </div>`;
      viewer.style.opacity = '1';
      
      const result = await window.api.readText(filePath);
      
      // Quick transition
      viewer.style.opacity = '0';
      setTimeout(() => {
        viewer.innerHTML = result.success
          ? `<div class="txt-viewer">${escapeHtml(result.text)}</div>`
          : `<div class="txt-viewer"><p style="color:#8B0000;">Failed to load file: ${escapeHtml(result.error)}</p></div>`;
        viewer.style.opacity = '1';
      }, 100);
      
      button.textContent = originalText;
      button.disabled = false;
      return;
    }

    // Unsupported
    viewer.innerHTML = `<p style="color:white;">Unsupported file type.</p>`;
    viewer.style.opacity = '1';
    button.textContent = originalText;
    button.disabled = false;
  }, 150);
}

function setFileName(name) {
  const bar = document.getElementById('infoBar');
  const label = document.getElementById('currentFileName');
  if (name) {
    label.textContent = name;
    bar.classList.add('has-file');
  } else {
    label.textContent = 'No file selected';
    bar.classList.remove('has-file');
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  viewer.style.transition = 'opacity 0.2s ease-out';

  const fileList = document.createElement('div');
  fileList.id = 'fileList';
  fileList.style.transition = 'opacity 0.15s ease-out';

  // Draggable sidebar toggle button
  const toggle = document.getElementById('sidebarToggle');
  let dragging = false;
  let pointerDown = false;
  let dragStartY = 0;
  let btnStartTop = 0;

  // Remove Bootstrap's data-bs-toggle so we control it manually
  toggle.removeAttribute('data-bs-toggle');
  toggle.removeAttribute('data-bs-target');

  toggle.addEventListener('pointerdown', (e) => {
    pointerDown = true;
    dragging = false;
    dragStartY = e.clientY;
    const rect = toggle.getBoundingClientRect();
    btnStartTop = rect.top + rect.height / 2;
    toggle.setPointerCapture(e.pointerId);
  });

  toggle.addEventListener('pointermove', (e) => {
    if (!pointerDown) return;
    if (Math.abs(e.clientY - dragStartY) > 8) {
      dragging = true;
      toggle.classList.add('active-flash');
      const newY = Math.max(40, Math.min(window.innerHeight - 40, btnStartTop + (e.clientY - dragStartY)));
      toggle.style.top = newY + 'px';
    }
  });

  toggle.addEventListener('pointerup', () => {
    pointerDown = false;
    if (dragging) {
      dragging = false;
      // Stay opaque briefly after drag ends
      setTimeout(() => toggle.classList.remove('active-flash'), 1000);
      return;
    }
    // Tap — open sidebar manually
    const offcanvas = bootstrap.Offcanvas.getOrCreateInstance(document.getElementById('offcanvasBar'));
    offcanvas.toggle();
  });

  // Flash opaque when sidebar opens (works for both tap and swipe)
  const offcanvasBarEl = document.getElementById('offcanvasBar');
  offcanvasBarEl.addEventListener('show.bs.offcanvas', () => {
    toggle.classList.add('active-flash');
  });
  offcanvasBarEl.addEventListener('hidden.bs.offcanvas', () => {
    // Stay opaque briefly after sidebar closes
    setTimeout(() => toggle.classList.remove('active-flash'), 1000);
  });

  // Swipe from left edge to open sidebar
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swiping = false;

  document.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    if (touch.clientX < 30) {
      swipeStartX = touch.clientX;
      swipeStartY = touch.clientY;
      swiping = true;
    }
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!swiping) return;
    const touch = e.touches[0];
    const dx = touch.clientX - swipeStartX;
    const dy = Math.abs(touch.clientY - swipeStartY);
    if (dx > 60 && dy < 80) {
      swiping = false;
      const offcanvas = bootstrap.Offcanvas.getOrCreateInstance(document.getElementById('offcanvasBar'));
      offcanvas.show();
    }
  }, { passive: true });

  document.addEventListener('touchend', () => { swiping = false; }, { passive: true });

  // Auto-close sidebar after file selection
  const offcanvasEl = document.getElementById('offcanvasBar');
  offcanvasEl.addEventListener('click', (e) => {
    const btn = e.target.closest('#fileList button');
    if (btn) {
      setTimeout(() => {
        const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl);
        if (offcanvas) offcanvas.hide();
      }, 200);
    }
  });

  await refreshDriveList();
});