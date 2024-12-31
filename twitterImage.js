async function autoScroll() {
  const scrollStep = window.innerHeight;
  const scrollDelay = 1000; // 1秒ごとにスクロール
  const maxScrollAttempts = 30; // 最大スクロール回数
  let scrollAttempts = 0;
  let lastScrollPosition = 0;

  // 最初のツイートの投稿者のユーザー名を取得
  const getFirstTweetAuthor = () => {
    const firstArticle = document.querySelector("article");
    if (!firstArticle) return null;
    const userLink = firstArticle.querySelector('a[href*="/status/"]')?.href;
    if (!userLink) return null;
    const match = userLink.match(/(?:twitter\.com|x\.com)\/([^/]+)/);
    return match ? match[1] : null;
  };

  const originalAuthor = getFirstTweetAuthor();

  return new Promise((resolve) => {
    const scroll = () => {
      const currentPosition = window.scrollY;

      // スクロール位置が変わっていないか、最大回数に達した場合
      if (
        currentPosition === lastScrollPosition ||
        scrollAttempts >= maxScrollAttempts
      ) {
        window.scrollTo(0, 0); // 先頭に戻る
        resolve();
        return;
      }

      // 現在表示されているツイートをチェック
      const articles = document.querySelectorAll("article");
      let shouldStop = false;

      articles.forEach((article) => {
        const userLink = article.querySelector('a[href*="/status/"]')?.href;
        if (userLink) {
          const match = userLink.match(/(?:twitter\.com|x\.com)\/([^/]+)/);
          const currentAuthor = match ? match[1] : null;

          // オリジナルの投稿者と異なるユーザーのツイートを見つけた場合
          if (
            currentAuthor &&
            originalAuthor &&
            currentAuthor !== originalAuthor
          ) {
            shouldStop = true;
          }
        }
      });

      if (shouldStop) {
        window.scrollTo(0, 0); // 先頭に戻る
        resolve();
        return;
      }

      lastScrollPosition = currentPosition;
      window.scrollBy(0, scrollStep);
      scrollAttempts++;
      setTimeout(scroll, scrollDelay);
    };

    if (originalAuthor) {
      scroll();
    } else {
      resolve(); // 投稿者が見つからない場合は終了
    }
  });
}

function collectTwitterImages() {
  const images = document.querySelectorAll(
    'img[src*="https://pbs.twimg.com/media"]'
  );
  const imageUrls = new Set(); // 重複を避けるためにSetを使用

  images.forEach((image) => {
    let imageUrl = image.src;
    if (imageUrl.includes("&name=")) {
      imageUrl = imageUrl.replace(/&name=\w+/, "&name=orig");
    }
    imageUrls.add(imageUrl);
  });

  return Array.from(imageUrls);
}

// メインのメッセージリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("content.js message:", message);
  if (message.action === "extractImages") {
    // スクロールしてから画像を収集
    autoScroll().then(() => {
      const imageUrls = collectTwitterImages();
      console.log("Found Twitter images:", imageUrls);

      chrome.runtime.sendMessage({
        action: "addImages",
        imageUrls: imageUrls,
      });
    });
  } else if (message.action === "scrollToImage") {
    // 指定された画像要素を探す
    const images = document.querySelectorAll(
      'img[src*="https://pbs.twimg.com/media"]'
    );
    let targetImage = null;

    for (const img of images) {
      if (
        img.src === message.imageUrl ||
        img.src.replace(/&name=\w+/, "&name=orig") === message.imageUrl
      ) {
        targetImage = img;
        break;
      }
    }

    // 見つかった画像まで自然にスクロール
    if (targetImage) {
      targetImage.scrollIntoView({behavior: "smooth", block: "center"});
    }
  }
});
