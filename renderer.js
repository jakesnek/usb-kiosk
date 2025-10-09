let currentDrive = null;

document.getElementById('selectDriveBtn').addEventListener('click', async () => {
  const drives = await window.api.listUsbDrives();
  if (!drives.length) {
    alert('No USB drives detected.');
    return;
  } else {
  // Pick first USB drive
  const path = drives[0];
  const files = await window.api.readDirectory(path);
  currentDrive = { path, files };
  populateTabs(currentDrive);
  }
});

// Build tabs
function populateTabs(drive) {
  const container = document.getElementById('driveContainer');
  container.innerHTML = '';

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

  container.appendChild(tabs);

  const fileListDiv = document.createElement('div');
  fileListDiv.id = 'fileList';
  container.appendChild(fileListDiv);

  showFiles(drive.files, 'Videos', drive.path);
}

// Show files by tab
function showFiles(files, type, path) {
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
        await openFile(`${path}\\${f}`, ext);
      });
      container.appendChild(btn);
    }
  });

  if (!container.children.length) {
    container.innerHTML = `<p>No ${type} files found.</p>`;
  }
}

// File opener
async function openFile(filePath, ext) {
  const viewer = document.getElementById('viewer');

  // Videos
  if (['mp4','webm','ogg','mkv','avi'].includes(ext)) {
    viewer.classList.add('media-mode');
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
    viewer.innerHTML = `<iframe src="file://${filePath}#toolbar=0" style="width:100%;height:100%;object-fit:contain;"></iframe>`;
    return;
  }

  // DOCX
  if (ext === 'docx') {
    viewer.classList.add('text-mode');
    viewer.innerHTML = `<p style="color:white;">Loading document...</p>`;
    try {
      const result = await window.api.convertDocx(filePath);
      if (result && result.success) {
        viewer.innerHTML = `<div class="docx-viewer">${result.html}</div>`;
      } else {
        viewer.innerHTML = `<p style="color:white;">Failed: ${result.error || 'Unknown'}</p>`;
      }
    } catch (err) {
      viewer.innerHTML = `<p style="color:white;">Error: ${err.message}</p>`;
    }
    return;
  }

  // TXT
  if (ext === 'txt') {
    viewer.classList.add('text-mode');
    viewer.innerHTML = `<p style="color:white;">Loading text file...</p>`;
    try {
      const result = await window.api.readText(filePath);
      if (result && result.success) {
        viewer.innerHTML = `<div class="txt-viewer">${result.text}</div>`;
      } else {
        viewer.innerHTML = `<p style="color:white;">Failed: ${result.error || 'Unknown'}</p>`;
      }
    } catch (err) {
      viewer.innerHTML = `<p style="color:white;">Error: ${err.message}</p>`;
    }
    return;
  }

  // Fallback
  viewer.innerHTML = `<p style="color:white;">Unsupported file. <br><a href="file://${filePath}" target="_blank" style="color:#9ecbff">${filePath}</a></p>`;
}
