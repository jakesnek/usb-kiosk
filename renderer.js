let currentDrive = null;
const driveContainer = document.getElementById('driveContainer');
const viewer = document.getElementById('viewer');

// --------------------
// Toast notifications
// --------------------
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
  setTimeout(() => toast.remove(), 4000);
}

// --------------------
// Drive list handling
// --------------------
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
    btn.addEventListener("click", async () => {
      const files = await window.api.readDirectory(drivePath);
      currentDrive = { path: drivePath, files };
      populateTabs(currentDrive);
    });
    driveContainer.appendChild(btn);
  });
}

// --------------------
// Handle insert/remove
// --------------------
window.api.onUsbUpdate(async ({ drives, added, removed }) => {
  if (added.length) showToast(`USB inserted: ${added.join(', ')}`, "success");
  if (removed.length) showToast(`USB removed: ${removed.join(', ')}`, "danger");
  renderDriveButtons(drives);
});

// --------------------
// File tabs and display
// --------------------
function populateTabs(drive) {
  driveContainer.innerHTML = '';

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
    a.textContent = type;

    a.addEventListener('click', (e) => {
      e.preventDefault();
      Array.from(li.parentElement.children).forEach(c => c.firstChild.classList.remove('active'));
      a.classList.add('active');
      showFiles(drive.files, type, drive.path);
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
  container.innerHTML = '';

  const extMap = {
    'Videos': ['mp4', 'webm', 'ogg', 'mkv', 'avi'],
    'Images': ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'],
    'Documents': ['pdf', 'docx', 'txt']
  };

  const exts = extMap[type] || [];

  files.forEach(f => {
    const ext = (f.split('.').pop() || '').toLowerCase();
    if (exts.includes(ext)) {
      const btn = document.createElement('button');
      btn.textContent = f;
      btn.className = 'btn btn-dark m-1';
      btn.addEventListener('click', async () => {
        await openFile(`${dirPath}/${f}`, ext);
      });
      container.appendChild(btn);
    }
  });

  if (!container.children.length) {
    container.innerHTML = `<p>No ${type} files found.</p>`;
  }
}

// --------------------
// File viewer logic
// --------------------
async function openFile(filePath, ext) {
  viewer.innerHTML = '';
  viewer.className = '';
  viewer.classList.add('media-mode');

  // Videos
  if (['mp4', 'webm', 'ogg', 'mkv', 'avi'].includes(ext)) {
    viewer.innerHTML = `<video controls style="max-width:90%;max-height:90%;"><source src="file://${filePath}" type="video/${ext}"></video>`;
    return;
  }

// Images
  if (['png','jpg','jpeg','gif','bmp','webp'].includes(ext)) {
    viewer.classList.add('media-mode');
    viewer.innerHTML = `
      <div style="width:90%;height:90%;position:relative;">
        <img id="zoomableImg" src="file://${filePath}" style="width:100%;height:100%;object-fit:contain;transform-origin:center;">
      </div>`;
    
    const zoomableImage = document.getElementById('zoomableImg');
    if (zoomableImage) {
      zoomableImage.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
      
      zoomableImage.addEventListener('load', () => {
        const panzoom = Panzoom(zoomableImage, {
          maxScale: 5,
          minScale: 1,
          contain: true,
          panOnlyWhenZoomed: true,
          animate: true,
          duration: 200,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        });

        let wasZoomed = false;
        let isResetting = false;

        // Enable mouse wheel zoom
        zoomableImage.parentElement.addEventListener('wheel', panzoom.zoomWithWheel);

        // Change cursor when zoomed and handle smooth reset
        zoomableImage.addEventListener('panzoomchange', (event) => {
          const { scale } = event.detail;
          zoomableImage.style.cursor = scale > 1 ? 'move' : 'default';
          
          if (scale > 1) {
            wasZoomed = true;
            isResetting = false;
          }
          
          if (wasZoomed && Math.abs(scale - 1) < 0.01 && !isResetting) {
            wasZoomed = false;
            isResetting = true;
            
            // Smoothly animate to center
            requestAnimationFrame(() => {
              panzoom.pan(0, 0, { 
                animate: true,
                duration: 200,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
              });
            });
            
            // Reset the flag after animation
            setTimeout(() => {
              isResetting = false;
            }, 250);
          }
        });
      });
    }
    
    const img = document.getElementById('zoomableImg');
    
    return;
  }

// Add this helper function at the end of the file
function initializePanzoom(element) {
  // Add transition for smooth reset
  element.style.transition = 'transform 0.3s ease-out';
  
  const panzoom = window.Panzoom(element, {
    maxScale: 5,
    minScale: 1,
    contain: true,
    cursor: 'default',
    panOnlyWhenZoomed: true,
    startScale: 1,
    startX: 0,
    startY: 0
  });

  let wasZoomed = false;

  // Enable mouse wheel zoom
  element.parentElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY;
    
    if (delta > 0) {
      panzoom.zoomOut();
    } else {
      panzoom.zoomIn();
    }
  });

  // Change cursor when zoomed and reset position at scale 1
  element.addEventListener('panzoomchange', (event) => {
    const { scale } = event.detail;
    element.style.cursor = scale > 1 ? 'move' : 'default';
    
    // Track if we were zoomed
    if (scale > 1) {
      wasZoomed = true;
    }
    
    // Only reset if we were previously zoomed and now we're back to scale 1
    if (wasZoomed && Math.abs(scale - 1) < 0.01) {
      wasZoomed = false;
      panzoom.reset({ animate: true });
    }
  });
}

  // PDFs
  if (ext === 'pdf') {
    viewer.classList.add('pdf-mode');
    viewer.innerHTML = `<iframe src="file://${filePath}#toolbar=0" style="width:100%;height:100%;"></iframe>`;
    return;
  }

  // DOCX
  if (ext === 'docx') {
    viewer.classList.add('text-mode');
    viewer.innerHTML = `<p style="color:white;">Loading document...</p>`;
    const result = await window.api.convertDocx(filePath);
    viewer.innerHTML = result.success ? `<div class="docx-viewer">${result.html}</div>` : `<p style="color:white;">Failed: ${result.error}</p>`;
    return;
  }

  // TXT
  if (ext === 'txt') {
    viewer.classList.add('text-mode');
    const result = await window.api.readText(filePath);
    viewer.innerHTML = result.success ? `<div class="txt-viewer">${result.text}</div>` : `<p style="color:white;">Failed: ${result.error}</p>`;
    return;
  }

  // Unsupported
  viewer.innerHTML = `<p style="color:white;">Unsupported file type.</p>`;
}

// --------------------
// Auto-load on startup
// --------------------
window.addEventListener('DOMContentLoaded', async () => {
  await refreshDriveList();
});
