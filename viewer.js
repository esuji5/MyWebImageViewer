// ビューワーの状態を管理するクラス
class ViewerState {
  constructor(images, rightToLeft = true, doublePage = true) {
    this.images = images;
    this.rightToLeft = rightToLeft;
    this.doublePage = doublePage;
    this.currentPage = 0;
    this.subscribers = new Set();
    this.touchStartX = 0;
    this.isPortrait = window.matchMedia("(orientation: portrait)").matches;
    this.urlTrackingEnabled = true;
    this.pageKey = window.location.href;
    
    // 縦長の画像かどうかを判定
    this.isVertical = Array.from(images).some((img) => {
      const rect = img.getBoundingClientRect();
      return rect.height > rect.width * 1.3;
    });

    // 2ページ表示の初期状態を設定
    this.useDoublePage = !this.isPortrait && (this.isVertical || doublePage);

    // 画面の向きの変更を監視
    this.orientationChangeHandler = this.handleOrientationChange.bind(this);
    window.matchMedia("(orientation: portrait)").addListener(this.orientationChangeHandler);
  }

  // 状態変更通知の購読
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // 状態変更を通知
  notify() {
    this.subscribers.forEach(callback => callback(this.getState()));
  }

  // 現在の状態を取得
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

  // ページ送り
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

  // ページ戻り
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

  // タッチ開始位置を記録
  setTouchStart(x) {
    this.touchStartX = x;
  }

  // タッチ操作によるページ移動
  handleTouchEnd(endX) {
    const diff = endX - this.touchStartX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        if (!this.rightToLeft) this.prevPage();
        else this.nextPage();
      } else {
        if (!this.rightToLeft) this.nextPage();
        else this.prevPage();
      }
    }
  }

  // 画面の向きの変更を処理
  handleOrientationChange(e) {
    this.isPortrait = e.matches;
    if (this.isPortrait) {
      this.useDoublePage = false;
    } else {
      this.useDoublePage = this.isVertical || this.doublePage;
    }
    this.notify();
  }

  // 表示モードの切り替え
  toggleDisplayMode() {
    if (!this.isPortrait) {
      this.useDoublePage = !this.useDoublePage;
      this.notify();
    }
  }

  // キー操作の処理
  handleKeydown(e) {
    if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
      if (!this.rightToLeft) this.prevPage();
      else this.nextPage();
    } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
      if (!this.rightToLeft) this.nextPage();
      else this.prevPage();
    } else if (e.key.toLowerCase() === "w" || e.key === "ArrowUp") {
      this.nextPage();
    } else if (e.key.toLowerCase() === "s" || e.key === "ArrowDown") {
      this.toggleDisplayMode();
    }
  }

  // 進捗の保存
  async saveProgress() {
    if (this.urlTrackingEnabled && typeof chrome !== "undefined" && chrome.storage) {
      try {
        await chrome.storage.local.set({ [this.pageKey]: this.currentPage });
      } catch (error) {
        console.warn("Failed to save progress:", error);
      }
    }
  }

  // 進捗の読み込み
  async loadProgress() {
    if (typeof chrome !== "undefined" && chrome.storage) {
      try {
        const result = await chrome.storage.local.get([
          this.pageKey,
          'urlTrackingEnabled'
        ]);
        this.urlTrackingEnabled = result.urlTrackingEnabled !== false;
        if (this.urlTrackingEnabled && result[this.pageKey] !== undefined) {
          this.currentPage = result[this.pageKey];
          this.notify();
        }
      } catch (error) {
        console.warn("Failed to load progress:", error);
      }
    }
  }

  // クリーンアップ
  cleanup() {
    window.matchMedia("(orientation: portrait)").removeListener(this.orientationChangeHandler);
    this.subscribers.clear();
  }
}

function initializeViewer(images, rightToLeft = true, initialDoublePage = false) {
  // 既存のビューワーを削除
  const existingViewer = document.getElementById('manga-viewer');
  if (existingViewer) {
    existingViewer.remove();
  }

  // ナビゲーションボタンの取得
  const navButtons = document.querySelector('.viewerbtn');
  const prevLink = navButtons?.querySelector('.viewerbtn_toBack a')?.href;
  const nextLink = navButtons?.querySelector('.viewerbtn_toNext a')?.href;
  const topLink = navButtons?.querySelector('.viewerbtn_toTop a')?.href;

  // ビューワーのDOM構造を作成
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

  // DOMエレメントの取得
  const container = viewer.querySelector(".viewer-container");
  const pageInfo = viewer.querySelector("#page-info");
  const closeButton = viewer.querySelector("#close-viewer");
  const prevButton = viewer.querySelector("#prev-page");
  const nextButton = viewer.querySelector("#next-page");

  // ViewerStateのインスタンス化
  const state = new ViewerState(images, rightToLeft, initialDoublePage);

  // 表示の更新
  function updateDisplay(currentState) {
    container.innerHTML = "";
    const { currentPage, totalPages } = currentState;

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

  // イベントハンドラーの設定
  function cleanup() {
    closeButton.removeEventListener('click', closeViewer);
    prevButton.removeEventListener('click', () => state.prevPage());
    nextButton.removeEventListener('click', () => state.nextPage());
    document.removeEventListener('keydown', (e) => state.handleKeydown(e));
    container.removeEventListener('touchstart', handleTouchStart);
    container.removeEventListener('touchend', handleTouchEnd);
    state.cleanup();
  }

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

  function handleTouchStart(e) {
    state.setTouchStart(e.touches[0].clientX);
  }

  function handleTouchEnd(e) {
    state.handleTouchEnd(e.changedTouches[0].clientX);
  }

  // イベントリスナーの設定
  closeButton.addEventListener('click', closeViewer);
  prevButton.addEventListener('click', () => state.prevPage());
  nextButton.addEventListener('click', () => state.nextPage());
  document.addEventListener('keydown', (e) => state.handleKeydown(e));
  container.addEventListener('touchstart', handleTouchStart);
  container.addEventListener('touchend', handleTouchEnd);

  // 状態変更の購読
  state.subscribe(updateDisplay);

  // 初期表示
  state.loadProgress().then(() => {
    updateDisplay(state.getState());
  });

  return {
    cleanup,
    closeViewer,
  };
}
