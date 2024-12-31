console.log("Content script loaded");

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
  return new Promise((resolve) => {
    const originalPosition = window.scrollY;
    let previousHeight = 0;
    let noChangeCount = 0;
    let lastTimestamp = null;
    const config = {
      scrollSpeed: 2000, // 1秒あたりのスクロール量(px)
      bottomWait: 100, // 最下部での待機時間(ms)
      finalWait: 300, // 完了後の待機時間(ms)
      noChangeLimit: 1, // 高さ不変を検知する回数
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
      if (!lastTimestamp) {
        lastTimestamp = timestamp;
      }

      const elapsed = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      let maxScroll = getMaxScroll();
      let currentScroll = window.scrollY;

      // 高さの変化を確認
      if (currentScroll >= maxScroll - 10) {
        // 誤差を考慮
        if (Math.abs(maxScroll - previousHeight) < 10) {
          // 誤差を考慮
          noChangeCount++;
          if (noChangeCount >= config.noChangeLimit) {
            loadingText.textContent = "読み込み完了を確認中...";
            progressIndicator.style.width = "100%";

            // 最後のスクロールを確実に
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

        // 最下部で待機後、次のスクロールを開始
        setTimeout(() => {
          lastTimestamp = null; // リセット
          requestAnimationFrame(scroll);
        }, config.bottomWait);
        return;
      }

      // スクロール量を計算（一定速度）
      const scrollAmount = (config.scrollSpeed * elapsed) / 1000;
      const newPosition = Math.min(currentScroll + scrollAmount, maxScroll);
      window.scrollTo(0, newPosition);

      // プログレスバーの更新
      const progress = (newPosition / maxScroll) * 90;
      progressIndicator.style.width = progress + "%";

      requestAnimationFrame(scroll);
    }

    requestAnimationFrame(scroll);
  });
}

function findMangaImages(minWidth = 300, minHeight = 300) {
  const uniqueUrls = new Set();

  // Twitter/x.comの場合の特別な処理
  if (window.location.hostname.includes("x.com") || 
      window.location.hostname.includes("twitter.com")) {
    if (typeof collectTwitterImages === 'function') {
      const twitterImageUrls = collectTwitterImages();
      return twitterImageUrls.map(url => {
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
    return images.filter((img) => {
      if (img.src && !img.src.includes("spacer") && !uniqueUrls.has(img.src)) {
        uniqueUrls.add(img.src);
        return true;
      }
      return false;
    });
  }

  const images = Array.from(document.getElementsByTagName("img"));
  return images.filter((img) => {
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
}

async function startViewer(options = {}) {
  console.log("StartViewer called with options:", options);
  try {
    if (hasLazyLoadImages()) {
      console.log("Lazy loading detected. Starting auto-scroll...");
      await autoScroll();
    }

    // デフォルト値をtrueに変更
    let rightToLeft = true;
    let doublePage = true;

    if (typeof chrome !== "undefined" && chrome.storage) {
      const result = await chrome.storage.local.get([
        "rightToLeft",
        "doublePage",
      ]);
      if (result) {
        rightToLeft =
          result.rightToLeft !== false ? true : false;
        doublePage = result.doublePage !== false ? true : false;
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
      initializeViewer(images, rightToLeft, doublePage);
    } else {
      alert("No suitable images found on this page.");
    }
  } catch (error) {
    console.error("Error starting viewer:", error);
    alert("Failed to start viewer. Please try again.");
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received:", request);
  if (request.action === "startViewer" || request.action === "toggle-viewer") {
    console.log("Starting viewer...");
    startViewer(request);
    sendResponse({}); // 即座にレスポンスを返す
  }
  return false; // 非同期レスポンスは使用しない
});