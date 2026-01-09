
let currentDrive = null;
const driveContainer = document.getElementById('driveContainer');
const viewer = document.getElementById('viewer');

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
    
    // Prevent double-tap issues with explicit touch handling
    let touchTimeout;
    const handleTap = async () => {
      if (btn.disabled) return;
      
      // Debounce rapid taps
      if (touchTimeout) return;
      touchTimeout = setTimeout(() => touchTimeout = null, 500);
      
      // Show loading state
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...';
      
      const files = await window.api.readDirectory(drivePath);
      currentDrive = { path: drivePath, files };
      populateTabs(currentDrive);
    };
    
    btn.addEventListener("click", handleTap);
    driveContainer.appendChild(btn);
  });
}

window.api.onUsbUpdate(async ({ drives, added, removed }) => {
  if (added.length) showToast(`USB inserted: ${added.join(', ')}`, "success");
  if (removed.length) showToast(`USB removed: ${removed.join(', ')}`, "danger");
  renderDriveButtons(drives);
});

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

    // Prevent double-tap zoom on tabs
    let tapTimeout;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Debounce rapid taps
      if (tapTimeout) return;
      tapTimeout = setTimeout(() => tapTimeout = null, 300);
      
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
  
  // Quick fade out
  container.style.opacity = '0';
  
  setTimeout(() => {
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
        const cleanName = f.replace(/^([A-Za-z]:[\\/])/, '');
        btn.textContent = cleanName;
        btn.className = 'btn btn-dark m-1';
        
        // Prevent double-tap with debouncing
        let fileTapTimeout;
        btn.addEventListener('click', async () => {
          if (btn.disabled || fileTapTimeout) return;
          fileTapTimeout = setTimeout(() => fileTapTimeout = null, 500);
          
          await openFile(f, ext, btn);
        });
        
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

async function openFile(filePath, ext, button) {
  // Add loading state to button
  const originalText = button.textContent;
  button.disabled = true;
  button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...';

  // Quick fade out
  viewer.style.opacity = '0';

  setTimeout(async () => {
    viewer.innerHTML = '';
    viewer.className = '';
    viewer.classList.add('media-mode');

    // Videos
    if (['mp4', 'webm', 'ogg', 'mkv', 'avi'].includes(ext)) {
      viewer.innerHTML = `<video controls style="max-width:90%;max-height:90%;"><source src="file://${filePath}" type="video/${ext}"></video>`;
      viewer.style.opacity = '1';
      button.textContent = originalText;
      button.disabled = false;
      return;
    }

    // Images
    if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext)) {
      viewer.classList.add('media-mode');
      viewer.innerHTML = `
      <div style="width:90%;height:90%;position:relative;display:flex;align-items:center;justify-content:center;">
        <button id="resetZoomBtn" 
          class="btn btn-outline-light btn-sm" 
          style="position:absolute;top:15px;right:15px;z-index:10;opacity:0.9;">
          Reset View
        </button>
        <img id="zoomableImg" 
          src="file://${filePath}" 
          style="width:100%;height:100%;object-fit:contain;transform-origin:center;">
      </div>`;

      const zoomableImage = document.getElementById('zoomableImg');
      const resetBtn = document.getElementById('resetZoomBtn');

      zoomableImage.addEventListener('load', () => {
        const zoomed = Panzoom(zoomableImage, {
          maxScale: 10,
          minScale: 1,
          contain: 'outside',
          // Optimize for touch
          animate: true,
          duration: 200
        });
        
        // Touch-friendly wheel zooming
        zoomableImage.parentElement.addEventListener('wheel', (e) => {
          e.preventDefault();
          zoomed.zoomWithWheel(e);
        }, { passive: false });

        // Reset button with debouncing
        let resetTimeout;
        resetBtn.addEventListener('click', () => {
          if (resetTimeout) return;
          resetTimeout = setTimeout(() => resetTimeout = null, 300);
          zoomed.reset({ animate: true });
        });
        
        // Quick fade in
        viewer.style.opacity = '1';
        button.textContent = originalText;
        button.disabled = false;
      });

      return;
    }

    // PDFs
    if (ext === 'pdf') {
      viewer.classList.add('pdf-mode');
      viewer.innerHTML = `
        <div id="pdfContainer" style="width:100%;height:100%;overflow-y:auto;position:relative;">
          <div class="text-center py-5">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Loading PDF...</span>
            </div>
            <p class="mt-3" style="color:white;">Loading PDF...</p>
          </div>
          <canvas id="pdfCanvas" style="display:block;margin:0 auto;"></canvas>
          <div id="pdfControls" style="position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:100;display:none;">
            <button id="prevPage" class="btn btn-sm" style="background:var(--ny-dark-blue);color:var(--ny-gold);border:2px solid var(--ny-gold);margin:0 8px;">Previous</button>
            <span id="pageInfo" style="color:var(--ny-gold);background:rgba(0,59,92,0.95);padding:12px 20px;border-radius:8px;font-weight:600;"></span>
            <button id="nextPage" class="btn btn-sm" style="background:var(--ny-dark-blue);color:var(--ny-gold);border:2px solid var(--ny-gold);margin:0 8px;">Next</button>
          </div>
        </div>`;
      
      viewer.style.opacity = '1';
      
      // Load PDF
      const loadingTask = pdfjsLib.getDocument(`file://${filePath}`);
      loadingTask.promise.then(pdf => {
        let currentPage = 1;
        const numPages = pdf.numPages;
        
        function renderPage(pageNum) {
          pdf.getPage(pageNum).then(page => {
            const canvas = document.getElementById('pdfCanvas');
            const context = canvas.getContext('2d');
            // Higher scale for better readability on touch screens
            const viewport = page.getViewport({ scale: 1.8 });
            
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            page.render({
              canvasContext: context,
              viewport: viewport
            });
            
            document.getElementById('pageInfo').textContent = `Page ${pageNum} of ${numPages}`;
          });
        }
        
        renderPage(currentPage);
        
        // Show controls and hide loading
        document.querySelector('#pdfContainer > div').style.display = 'none';
        document.getElementById('pdfControls').style.display = 'block';
        
        // Debounced page navigation
        let navTimeout;
        document.getElementById('prevPage').onclick = () => {
          if (navTimeout || currentPage <= 1) return;
          navTimeout = setTimeout(() => navTimeout = null, 300);
          
          currentPage--;
          renderPage(currentPage);
          document.getElementById('pdfContainer').scrollTop = 0;
        };
        
        document.getElementById('nextPage').onclick = () => {
          if (navTimeout || currentPage >= numPages) return;
          navTimeout = setTimeout(() => navTimeout = null, 300);
          
          currentPage++;
          renderPage(currentPage);
          document.getElementById('pdfContainer').scrollTop = 0;
        };
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
      
      // Quick transition
      viewer.style.opacity = '0';
      setTimeout(() => {
        viewer.innerHTML = result.success 
          ? `<div class="docx-viewer">${result.html}</div>` 
          : `<div class="docx-viewer"><p style="color:#8B0000;">Failed to load document: ${result.error}</p></div>`;
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
          ? `<div class="txt-viewer">${result.text}</div>` 
          : `<div class="txt-viewer"><p style="color:#8B0000;">Failed to load file: ${result.error}</p></div>`;
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

window.addEventListener('DOMContentLoaded', async () => {
  // Add quick transition style to viewer
  viewer.style.transition = 'opacity 0.2s ease-out';
  
  // Add transition to file list container
  const fileList = document.createElement('div');
  fileList.id = 'fileList';
  fileList.style.transition = 'opacity 0.15s ease-out';
  
  await refreshDriveList();
});