// ビューワーの状態を管理するクラス
export class ViewerState {
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