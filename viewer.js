function initializeViewer(
  images,
  rightToLeft = true,
  initialDoublePage = false
) {
  // ビューワーの初期化
  const existingViewer = document.getElementById('manga-viewer');
  if (existingViewer) {
    existingViewer.remove();
  }

  const navButtons = document.querySelector('.viewerbtn');
  const prevLink = navButtons?.querySelector('.viewerbtn_toBack a')?.href;
  const nextLink = navButtons?.querySelector('.viewerbtn_toNext a')?.href;
  const topLink = navButtons?.querySelector('.viewerbtn_toTop a')?.href;

  const viewer = document.createElement("div");
  viewer.id = "manga-viewer";
  viewer.innerHTML = `
    <div class="viewer-controls">
      <button id="prev-page">◀</button>
      <span id="page-info"></span>
      <button id="next-page">▶</button>
      <div class="chapter-nav">
        ${prevLink ? `<a href="${prevLink}" class="chapter-link">◀ 前の話</a>` : ''}
        ${topLink ? `<a href="${topLink}" class="chapter-link">作品TOP</a>` : ''}
        ${nextLink ? `<a href="${nextLink}" class="chapter-link">次の話 ▶</a>` : ''}
      </div>
      <button id="close-viewer">✕</button>
    </div>
    <div class="viewer-container"></div>
  `;
  document.body.appendChild(viewer);

  let currentPage = 0;
  const container = viewer.querySelector(".viewer-container");
  const pageInfo = viewer.querySelector("#page-info");
  const closeButton = viewer.querySelector("#close-viewer");
  const prevButton = viewer.querySelector("#prev-page");
  const nextButton = viewer.querySelector("#next-page");
  const isVertical = Array.from(images).some((img) => {
    const rect = img.getBoundingClientRect();
    return rect.height > rect.width * 1.3;
  });
  const isPortrait = window.matchMedia("(orientation: portrait)").matches;
  let useDoublePage = !isPortrait && (isVertical || initialDoublePage);
  let urlTrackingEnabled = true;
  const pageKey = window.location.href;

  function updateDisplay() {
    container.innerHTML = "";
    if (useDoublePage && currentPage < images.length - 1) {
      container.classList.remove("single-page");
      const doublePageContainer = document.createElement('div');
      doublePageContainer.className = 'double-page-container';

      const page1 = images[currentPage].cloneNode(true);
      const page2 = images[currentPage + 1].cloneNode(true);

      [page1, page2].forEach(page => {
        page.style.height = '100%';
        page.style.width = 'auto';
        page.style.maxWidth = '50%';
        page.style.objectFit = 'contain';
        page.style.margin = '0';
        page.style.padding = '0';
      });

      if (rightToLeft) {
        doublePageContainer.appendChild(page2);
        doublePageContainer.appendChild(page1);
      } else {
        doublePageContainer.appendChild(page1);
        doublePageContainer.appendChild(page2);
      }

      container.appendChild(doublePageContainer);
      pageInfo.textContent = `Pages ${currentPage + 1}-${currentPage + 2} of ${images.length}`;
    } else {
      container.classList.add("single-page");
      const page = images[currentPage].cloneNode(true);
      page.style.height = '100%';
      page.style.width = 'auto';
      page.style.maxWidth = '100%';
      page.style.objectFit = 'contain';
      container.appendChild(page);
      pageInfo.textContent = `Page ${currentPage + 1} of ${images.length}`;
    }

    if (urlTrackingEnabled) {
      try {
        chrome.storage.local.set({[pageKey]: currentPage});
      } catch (error) {
        console.warn("Failed to save progress:", error);
      }
    }
  }

  function handlePrevPage() {
    if (currentPage > 0) {
      currentPage -= useDoublePage ? 2 : 1;
      if (currentPage < 0) currentPage = 0;
      updateDisplay();
    }
  }

  function handleNextPage() {
    if (currentPage < images.length - 1) {
      currentPage += useDoublePage ? 2 : 1;
      if (currentPage >= images.length) currentPage = images.length - 1;
      updateDisplay();
    }
  }

  function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
  }

  function handleTouchEnd(e) {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchEndX - touchStartX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        if (!rightToLeft) handlePrevPage();
        else handleNextPage();
      } else {
        if (!rightToLeft) handleNextPage();
        else handlePrevPage();
      }
    }
  }

  function keydownHandler(e) {
    if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
      if (!rightToLeft) handlePrevPage();
      else handleNextPage();
    } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
      if (!rightToLeft) handleNextPage();
      else handlePrevPage();
    } else if (e.key.toLowerCase() === "w" || e.key === "ArrowUp") {
      if (currentPage < images.length - 1) {
        currentPage += 1;
        if (currentPage >= images.length) currentPage = images.length - 1;
        updateDisplay();
      }
    } else if (e.key.toLowerCase() === "s" || e.key === "ArrowDown") {
      if (!isPortrait) {
        useDoublePage = !useDoublePage;
        updateDisplay();
      }
    } else if (e.key === "Escape") {
      closeViewer();
    }
  }

  function cleanup() {
    closeButton.removeEventListener('click', closeViewer);
    prevButton.removeEventListener('click', handlePrevPage);
    nextButton.removeEventListener('click', handleNextPage);
    document.removeEventListener('keydown', keydownHandler);
    container.removeEventListener('touchstart', handleTouchStart);
    container.removeEventListener('touchend', handleTouchEnd);
  }

  function closeViewer() {
    cleanup();
    if (document.body.contains(viewer)) {
      document.body.removeChild(viewer);
    }
    const currentImage = images[currentPage];
    const originalImage = Array.from(document.images).find(
      (img) => img.src === currentImage.src
    );
    if (originalImage) {
      originalImage.scrollIntoView({behavior: "smooth"});
    }
  }

  // イベントリスナーの設定
  closeButton.addEventListener('click', closeViewer);
  prevButton.addEventListener('click', handlePrevPage);
  nextButton.addEventListener('click', handleNextPage);
  document.addEventListener('keydown', keydownHandler);
  
  let touchStartX = 0;
  container.addEventListener('touchstart', handleTouchStart);
  container.addEventListener('touchend', handleTouchEnd);

  // 初期表示
  try {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get([
        pageKey, 
        'urlTrackingEnabled', 
        'rightToLeft', 
        'doublePage'
      ], (result) => {
        urlTrackingEnabled = result.urlTrackingEnabled !== false;
        if (urlTrackingEnabled && result[pageKey] !== undefined) {
          currentPage = result[pageKey];
        }
        updateDisplay();
      });
    } else {
      updateDisplay();
    }
  } catch (error) {
    console.warn("Failed to load progress:", error);
    updateDisplay();
  }

  return {
    cleanup,
    closeViewer,
  };
}