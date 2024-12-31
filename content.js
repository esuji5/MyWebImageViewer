console.log("Content script loaded");

// エラータイプの定義
const ViewerError = {
  LOAD_ERROR: 'LOAD_ERROR',
  SCROLL_ERROR: 'SCROLL_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  IMAGE_ERROR: 'IMAGE_ERROR',
  INITIALIZATION_ERROR: 'INITIALIZATION_ERROR'
};

class ViewerException extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function hasLazyLoadImages() {
  const images = document.getElementsByTagName("img");
  return Array.from(images).some(
    (img) =>
      img.loading === "lazy" ||
      img.classList.contains("lazy") ||
      img.classList.contains("lazyload") ||
      img.hasAttribute("data-src") ||
      img.hasAttribute("data-original")
  );
}

async function autoScroll() {
  return new Promise((resolve, reject) => {
    try {
      const originalPosition = window.scrollY;
      let previousHeight = 0;
      let noChangeCount = 0;
      let lastTimestamp = null;
      const config = {
        scrollSpeed: 2000,
        bottomWait: 100,
        finalWait: 300,
        noChangeLimit: 1,
      };

      const progressBar = document.createElement("div");
      progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 8px;
        background: rgba(0, 0, 0, 0.1);
        z-index: 999999;
      `;
      const progressIndicator = document.createElement("div");
      progressIndicator.style.cssText = `
        width: 0%;
        height: 100%;
        background: #4CAF50;
        transition: width 0.1s;
        box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
      `;
      const loadingText = document.createElement("div");
      loadingText.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        z-index: 999999;
      `;
      loadingText.textContent = "画像を読み込み中...";

      progressBar.appendChild(progressIndicator);
      document.body.appendChild(progressBar);
      document.body.appendChild(loadingText);

      function getMaxScroll() {
        return (
          Math.max(
            document.body.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.clientHeight,
            document.documentElement.scrollHeight,
            document.documentElement.offsetHeight
          ) - window.innerHeight
        );
      }

      function scroll(timestamp) {
        try {
          if (!lastTimestamp) {
            lastTimestamp = timestamp;
          }

          const elapsed = timestamp - lastTimestamp;
          lastTimestamp = timestamp;

          let maxScroll = getMaxScroll();
          let currentScroll = window.scrollY;

          if (currentScroll >= maxScroll - 10) {
            if (Math.abs(maxScroll - previousHeight) < 10) {
              noChangeCount++;
              if (noChangeCount >= config.noChangeLimit) {
                loadingText.textContent = "読み込み完了を確認中...";
                progressIndicator.style.width = "100%";

                window.scrollTo(0, maxScroll);

                setTimeout(() => {
                  window.scrollTo(0, originalPosition);
                  progressBar.remove();
                  loadingText.remove();
                  resolve();
                }, config.finalWait);
                return;
              }
            } else {
              noChangeCount = 0;
              previousHeight = maxScroll;
            }

            setTimeout(() => {
              lastTimestamp = null;
              requestAnimationFrame(scroll);
            }, config.bottomWait);
            return;
          }

          const scrollAmount = (config.scrollSpeed * elapsed) / 1000;
          const newPosition = Math.min(currentScroll + scrollAmount, maxScroll);
          window.scrollTo(0, newPosition);

          const progress = (newPosition / maxScroll) * 90;
          progressIndicator.style.width = progress + "%";

          requestAnimationFrame(scroll);
        } catch (error) {
          reject(new ViewerException(ViewerError.SCROLL_ERROR, `スクロール中にエラーが発生しました: ${error.message}`));
        }
      }

      requestAnimationFrame(scroll);
    } catch (error) {
      reject(new ViewerException(ViewerError.SCROLL_ERROR, `スクロールの初期化に失敗しました: ${error.message}`));
    }
  });
}

function findMangaImages(minWidth = 300, minHeight = 300) {
  try {
    const uniqueUrls = new Set();

    if (
      window.location.hostname.includes("x.com") ||
      window.location.hostname.includes("twitter.com")
    ) {
      if (typeof collectTwitterImages === "function") {
        const twitterImageUrls = collectTwitterImages();
        console.log("Twitter images found:", twitterImageUrls.length);
        if (twitterImageUrls.length === 0) {
          throw new ViewerException(ViewerError.IMAGE_ERROR, "Twitter画像が見つかりませんでした");
        }
        return twitterImageUrls.map((url) => {
          const img = new Image();
          img.src = url;
          return img;
        });
      }
    }

    if (window.location.hostname.includes("web-ace.jp")) {
      const images = Array.from(
        document.getElementsByClassName("viewerFixedImage")
      );
      const filteredImages = images.filter((img) => {
        if (img.src && !img.src.includes("spacer") && !uniqueUrls.has(img.src)) {
          uniqueUrls.add(img.src);
          return true;
        }
        return false;
      });
      
      if (filteredImages.length === 0) {
        throw new ViewerException(ViewerError.IMAGE_ERROR, "web-ace.jpで画像が見つかりませんでした");
      }
      return filteredImages;
    }

    const images = Array.from(document.getElementsByTagName("img"));
    const filteredImages = images.filter((img) => {
      if (img.src.includes("spacer")) {
        return false;
      }

      if (uniqueUrls.has(img.src)) {
        return false;
      }

      const rect = img.getBoundingClientRect();
      const isVisible =
        rect.width > 0 &&
        rect.height > 0 &&
        window.getComputedStyle(img).display !== "none" &&
        window.getComputedStyle(img).visibility !== "hidden";

      if (
        isVisible &&
        img.src &&
        (rect.width >= minWidth || rect.height >= minHeight)
      ) {
        uniqueUrls.add(img.src);
        return true;
      }

      return false;
    });

    if (filteredImages.length === 0) {
      throw new ViewerException(ViewerError.IMAGE_ERROR, "表示可能な画像が見つかりませんでした");
    }

    return filteredImages;
  } catch (error) {
    if (error instanceof ViewerException) {
      throw error;
    }
    throw new ViewerException(ViewerError.IMAGE_ERROR, `画像の検索中にエラーが発生しました: ${error.message}`);
  }
}

async function startViewer(options = {}) {
  console.log("StartViewer called with options:", options);
  try {
    const isTwitter = 
      window.location.hostname.includes("x.com") ||
      window.location.hostname.includes("twitter.com");

    if (!options.skipScroll) {
      if (isTwitter) {
        if (typeof twitterAutoScroll === "function") {
          console.log("Using Twitter-specific scroll logic");
          try {
            await twitterAutoScroll();
          } catch (error) {
            throw new ViewerException(ViewerError.SCROLL_ERROR, `Twitter固有のスクロール処理に失敗しました: ${error.message}`);
          }
        }
      } else if (hasLazyLoadImages()) {
        console.log("Lazy loading detected. Starting auto-scroll...");
        try {
          await autoScroll();
        } catch (error) {
          if (error instanceof ViewerException) {
            throw error;
          }
          throw new ViewerException(ViewerError.SCROLL_ERROR, `遅延読み込み画像のスクロールに失敗しました: ${error.message}`);
        }
      }
    }

    let rightToLeft = true;
    let doublePage = true;

    if (typeof chrome !== "undefined" && chrome.storage) {
      try {
        const result = await chrome.storage.local.get([
          "rightToLeft",
          "doublePage",
        ]);
        if (result) {
          rightToLeft = result.rightToLeft !== false;
          doublePage = result.doublePage !== false;
        }
      } catch (error) {
        throw new ViewerException(ViewerError.STORAGE_ERROR, `設定の読み込みに失敗しました: ${error.message}`);
      }
    }

    if (window.location.hostname.includes("web-ace.jp")) {
      options.minWidth = 0;
      options.minHeight = 0;
    }

    const images = findMangaImages(options.minWidth, options.minHeight);
    console.log("Found images:", images.length);

    if (images.length > 0) {
      console.log("Initializing viewer...");
      try {
        initializeViewer(images, rightToLeft, doublePage);
      } catch (error) {
        throw new ViewerException(ViewerError.INITIALIZATION_ERROR, `ビューワーの初期化に失敗しました: ${error.message}`);
      }
    } else {
      throw new ViewerException(ViewerError.IMAGE_ERROR, "表示可能な画像が見つかりませんでした");
    }
  } catch (error) {
    const errorMessage = {
      [ViewerError.LOAD_ERROR]: '画像の読み込みに失敗しました',
      [ViewerError.SCROLL_ERROR]: 'ページのスクロールに失敗しました',
      [ViewerError.STORAGE_ERROR]: '設定の読み込みに失敗しました',
      [ViewerError.IMAGE_ERROR]: '画像の検索に失敗しました',
      [ViewerError.INITIALIZATION_ERROR]: 'ビューワーの初期化に失敗しました'
    }[error.code] || 'ビューワーの起動に失敗しました';
    
    console.error("Error starting viewer:", error);
    alert(`${errorMessage}\n詳細: ${error.message}`);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received:", request);
  if (request.action === "startViewer" || request.action === "toggle-viewer") {
    const options = {
      ...request,
      skipScroll: request.action === "scrollToImage"
    };
    console.log("Starting viewer with options:", options);
    startViewer(options);
    sendResponse({});
  }
  return false;
});