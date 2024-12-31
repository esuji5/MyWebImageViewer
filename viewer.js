window.ViewerState = class ViewerState {
  constructor(images, closeCallback) {
    this.images = images;
    this.closeCallback = closeCallback;
    this.currentPage = 0;
    this.subscribers = new Set();
    this.touchStartX = 0;
    this.isPortrait = window.matchMedia("(orientation: portrait)").matches;
    this.pageKey = window.location.href;
    
    this.isVertical = Array.from(images).some((img) => {
      const rect = img.getBoundingClientRect();
      return rect.height > rect.width * 1.3;
    });

    this.rightToLeft = window.viewerSettings.getSetting('rightToLeft');
    this.useDoublePage = !this.isPortrait && (this.isVertical || window.viewerSettings.getSetting('doublePage'));
    this.urlTrackingEnabled = window.viewerSettings.getSetting('urlTrackingEnabled');
    this.rememberPosition = window.viewerSettings.getSetting('rememberPosition');

    this.orientationChangeHandler = this.handleOrientationChange.bind(this);
    window.matchMedia("(orientation: portrait)").addListener(this.orientationChangeHandler);
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    this.subscribers.forEach(callback => callback(this.getState()));
  }

  getState() {
    return {
      currentPage: this.currentPage,
      totalPages: this.images.length,
      rightToLeft: this.rightToLeft,
      doublePage: this.useDoublePage,
      isPortrait: this.isPortrait,
      urlTrackingEnabled: this.urlTrackingEnabled
    };
  }

  nextPage() {
    if (this.currentPage < this.images.length - 1) {
      this.currentPage += this.useDoublePage ? 2 : 1;
      if (this.currentPage >= this.images.length) {
        this.currentPage = this.images.length - 1;
      }
      this.saveProgress();
      this.notify();
    }
  }

  prevPage() {
    if (this.currentPage > 0) {
      this.currentPage -= this.useDoublePage ? 2 : 1;
      if (this.currentPage < 0) {
        this.currentPage = 0;
      }
      this.saveProgress();
      this.notify();
    }
  }

  setTouchStart(x) {
    this.touchStartX = x;
  }

  handleTouchEnd(endX) {
    const diff = endX - this.touchStartX;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        if (!this.rightToLeft) this.prevPage();
        else this.nextPage();
      } else {
        if (!this.rightToLeft) this.nextPage();
        else this.prevPage();
      }
    }
  }

  handleOrientationChange(e) {
    this.isPortrait = e.matches;
    if (this.isPortrait) {
      this.useDoublePage = false;
    } else {
      this.useDoublePage = this.isVertical || window.viewerSettings.getSetting('doublePage');
    }
    this.notify();
  }

  toggleDisplayMode() {
    if (!this.isPortrait) {
      this.useDoublePage = !this.useDoublePage;
      this.notify();
    }
  }

  handleKeydown(e) {
    if (e.key === "ArrowRight" || e.key === "d") {
      if (!this.rightToLeft) {
        this.nextPage();
      } else {
        this.prevPage();
      }
      e.preventDefault();
    }
    else if (e.key === "ArrowLeft" || e.key === "a") {
      if (!this.rightToLeft) {
        this.prevPage();
      } else {
        this.nextPage();
      }
      e.preventDefault();
    }
    else if (e.key === "ArrowUp" || e.key === "w") {
      this.nextPage();
      e.preventDefault();
    }
    else if (e.key === "ArrowDown" || e.key === "s") {
      this.toggleDisplayMode();
      e.preventDefault();
    }
    else if (e.key === "Escape") {
      if (this.closeCallback) {
        this.closeCallback();
      }
      e.preventDefault();
    }
  }

  async saveProgress() {
    if (this.urlTrackingEnabled && this.rememberPosition) {
      try {
        await chrome.storage.local.set({
          [`progress_${this.pageKey}`]: {
            page: this.currentPage,
            timestamp: Date.now()
          }
        });
      } catch (error) {
        console.warn("Failed to save progress:", error);
      }
    }
  }

  async loadProgress() {
    if (this.urlTrackingEnabled && this.rememberPosition) {
      try {
        const result = await chrome.storage.local.get(`progress_${this.pageKey}`);
        const progress = result[`progress_${this.pageKey}`];
        if (progress && progress.page !== undefined) {
          this.currentPage = progress.page;
          this.notify();
        }
      } catch (error) {
        console.warn("Failed to load progress:", error);
      }
    }
  }

  cleanup() {
    if (this.orientationChangeHandler) {
      window.matchMedia("(orientation: portrait)").removeListener(this.orientationChangeHandler);
    }
    this.subscribers.clear();
  }
};

window.initializeViewer = function(images) {
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
      <button id="prev-page" aria-label="前のページ">◀</button>
      <span id="page-info" role="status" aria-live="polite"></span>
      <button id="next-page" aria-label="次のページ">▶</button>
      <div class="chapter-nav">
        ${prevLink ? `<a href="${prevLink}" class="chapter-link" aria-label="前の話">◀ 前の話</a>` : ''}
        ${topLink ? `<a href="${topLink}" class="chapter-link" aria-label="作品TOP">作品TOP</a>` : ''}
        ${nextLink ? `<a href="${nextLink}" class="chapter-link" aria-label="次の話">次の話 ▶</a>` : ''}
      </div>
      <button id="close-viewer" aria-label="ビューワーを閉じる">✕</button>
    </div>
    <div class="viewer-container" role="main"></div>
  `;
  document.body.appendChild(viewer);

  const container = viewer.querySelector(".viewer-container");
  const pageInfo = viewer.querySelector("#page-info");
  const closeButton = viewer.querySelector("#close-viewer");
  const prevButton = viewer.querySelector("#prev-page");
  const nextButton = viewer.querySelector("#next-page");

  function closeViewer() {
    cleanup();
    if (document.body.contains(viewer)) {
      document.body.removeChild(viewer);
    }
    const currentImage = images[state.currentPage];
    const originalImage = Array.from(document.images).find(
      (img) => img.src === currentImage.src
    );
    if (originalImage) {
      originalImage.scrollIntoView({ behavior: "smooth" });
    }
  }

  const state = new window.ViewerState(images, closeViewer);

  function updateDisplay(currentState) {
    container.innerHTML = "";
    const { currentPage, totalPages, rightToLeft } = currentState;

    if (state.useDoublePage && currentPage < images.length - 1) {
      container.classList.remove("single-page");
      const doublePageContainer = document.createElement('div');
      doublePageContainer.className = 'double-page-container';
      doublePageContainer.setAttribute('role', 'img');
      doublePageContainer.setAttribute('aria-label', `${currentPage + 1}-${currentPage + 2}ページ`);

      const page1 = images[currentPage].cloneNode(true);
      const page2 = images[currentPage + 1].cloneNode(true);

      [page1, page2].forEach(page => {
        page.style.height = '100%';
        page.style.width = 'auto';
        page.style.maxWidth = '50%';
        page.style.objectFit = 'contain';
        page.style.margin = '0';
        page.style.padding = '0';
        page.setAttribute('alt', `ページ ${page === page1 ? currentPage + 1 : currentPage + 2}`);
      });

      if (rightToLeft) {
        doublePageContainer.appendChild(page2);
        doublePageContainer.appendChild(page1);
      } else {
        doublePageContainer.appendChild(page1);
        doublePageContainer.appendChild(page2);
      }

      container.appendChild(doublePageContainer);
      pageInfo.textContent = `${currentPage + 1}-${currentPage + 2} / ${totalPages}ページ`;
    } else {
      container.classList.add("single-page");
      const page = images[currentPage].cloneNode(true);
      page.style.height = '100%';
      page.style.width = 'auto';
      page.style.maxWidth = '100%';
      page.style.objectFit = 'contain';
      page.setAttribute('alt', `ページ ${currentPage + 1}`);
      container.appendChild(page);
      pageInfo.textContent = `${currentPage + 1} / ${totalPages}ページ`;
    }
  }

  function cleanup() {
    closeButton.removeEventListener('click', closeViewer);
    prevButton.removeEventListener('click', () => state.prevPage());
    nextButton.removeEventListener('click', () => state.nextPage());
    document.removeEventListener('keydown', handleKeydown);
    container.removeEventListener('touchstart', handleTouchStart);
    container.removeEventListener('touchend', handleTouchEnd);
    state.cleanup();
  }

  function handleTouchStart(e) {
    state.setTouchStart(e.touches[0].clientX);
  }

  function handleTouchEnd(e) {
    state.handleTouchEnd(e.changedTouches[0].clientX);
  }

  function handleKeydown(e) {
    state.handleKeydown(e);
  }

  closeButton.addEventListener('click', closeViewer);
  prevButton.addEventListener('click', () => state.prevPage());
  nextButton.addEventListener('click', () => state.nextPage());
  document.addEventListener('keydown', handleKeydown);
  container.addEventListener('touchstart', handleTouchStart);
  container.addEventListener('touchend', handleTouchEnd);

  state.subscribe(updateDisplay);
  state.loadProgress().then(() => {
    updateDisplay(state.getState());
  });

  return {
    cleanup,
    closeViewer,
  };
};