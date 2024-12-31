// デフォルト設定
const DEFAULT_SETTINGS = {
  // 表示設定
  rightToLeft: true, // 右から左へめくる
  doublePage: true, // 見開き表示
  theme: "light", // テーマ（light/dark）
  thumbnailSize: "medium", // サムネイルサイズ（small/medium/large）

  // 閲覧設定
  urlTrackingEnabled: true, // URL毎の進捗保存
  saveInterval: 1, // 進捗保存間隔（ページ）
  confirmClose: true, // 閲覧終了時の確認
  rememberPosition: true, // 表示位置を記憶

  // 画像設定
  minImageWidth: 300, // 最小画像幅
  minImageHeight: 300, // 最小画像高さ
  imageQuality: "auto", // 画質設定（auto/high/low）
  loadAhead: 2, // 先読みページ数

  // スクロール設定
  scrollSpeed: 2000, // スクロール速度（px/s）
  scrollMargin: 50, // スクロールマージン（px）
  smoothScrolling: true, // スムーズスクロール

  // キーボードショートカット
  keyBindings: {
    nextPage: ["ArrowRight", "d"],
    prevPage: ["ArrowLeft", "a"],
    toggleDoublePage: ["s", "ArrowDown"],
    close: ["Escape"],
    scrollNext: ["ArrowUp", "w"],
  },
};

// グローバルインスタンス
window.ViewerSettings = class ViewerSettings {
  constructor() {
    this.defaults = DEFAULT_SETTINGS;
    this.observers = new Set();
    this.settings = {...this.defaults};
    this.loadAllSettings();
  }

  async loadAllSettings() {
    try {
      if (chrome && chrome.storage) {
        const stored = await chrome.storage.local.get(null);
        this.settings = {...this.defaults, ...stored};
      }
    } catch (error) {
      console.warn("Failed to load settings, using defaults:", error);
    }
  }

  getDefault(key) {
    return this.defaults[key];
  }

  // 同期的に設定を取得（既にロードされているキャッシュから）
  getSetting(key) {
    return this.settings[key] ?? this.defaults[key];
  }

  // 非同期で設定を保存
  async setSetting(key, value) {
    try {
      if (chrome && chrome.storage) {
        await chrome.storage.local.set({[key]: value});
      }
      this.settings[key] = value;
      this.notify([key]);
    } catch (error) {
      console.error(`Failed to save setting ${key}:`, error);
    }
  }

  // 設定の変更を監視
  observe(callback) {
    this.observers.add(callback);
    return () => this.observers.delete(callback);
  }

  // 設定変更を通知
  notify(changedKeys) {
    this.observers.forEach((callback) => callback(changedKeys));
  }

  // キーイベントの処理（同期的に）
  handleKeyEvent(event, action) {
    const keyBindings = this.getSetting("keyBindings");
    if (!keyBindings || !keyBindings[action]) {
      return false;
    }
    return keyBindings[action].includes(event.key);
  }
};

// グローバルインスタンスを作成
window.viewerSettings = new window.ViewerSettings();
