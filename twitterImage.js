async function twitterAutoScroll() {
  const scrollStep = window.innerHeight * 2;
  const scrollDelay = 500;
  const maxWaitTime = 60000;
  let lastScrollPosition = 0;
  let noChangeCount = 0;
  let startTime = Date.now();

  const progressBar = document.createElement("div");
  progressBar.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: rgba(0, 0, 0, 0.1);
    z-index: 999999;
  `;
  const progressIndicator = document.createElement("div");
  progressIndicator.style.cssText = `
    width: 0%;
    height: 100%;
    background: #1DA1F2;
    transition: width 0.3s;
  `;
  progressBar.appendChild(progressIndicator);
  document.body.appendChild(progressBar);

  let initialTweetCount = document.querySelectorAll('article').length;
  let maxTweetCount = initialTweetCount;

  return new Promise((resolve) => {
    const scroll = async () => {
      const currentPosition = window.scrollY;
      const currentTweetCount = document.querySelectorAll('article').length;
      const timePassed = Date.now() - startTime;

      const progress = Math.min((currentTweetCount / maxTweetCount) * 100, 100);
      progressIndicator.style.width = `${progress}%`;

      if (currentPosition === lastScrollPosition) {
        noChangeCount++;
      } else {
        noChangeCount = 0;
        if (currentTweetCount > maxTweetCount) {
          maxTweetCount = currentTweetCount;
        }
      }

      const shouldStop = 
        noChangeCount >= 3 ||
        timePassed >= maxWaitTime ||
        currentPosition >= document.documentElement.scrollHeight - window.innerHeight;

      if (shouldStop) {
        console.log(`Scroll completed. Tweets found: ${currentTweetCount}`);
        progressBar.remove();
        window.scrollTo(0, 0);
        resolve();
        return;
      }

      lastScrollPosition = currentPosition;
      window.scrollBy({
        top: scrollStep,
        behavior: 'auto'
      });

      await new Promise(r => setTimeout(r, scrollDelay));
      scroll();
    };

    scroll();
  });
}

function normalizeImageUrl(url) {
  if (!url) return null;
  if (url.includes('profile_images') || url.includes('_normal.')) return null;
  
  let imageUrl = url;
  if (imageUrl.includes('&name=')) {
    imageUrl = imageUrl.replace(/&name=\w+/, '&name=orig');
  } else if (imageUrl.includes('?format=')) {
    imageUrl = imageUrl.replace(/\?format=\w+/, '?format=png&name=orig');
  } else if (!imageUrl.includes('name=orig')) {
    imageUrl += imageUrl.includes('?') ? '&name=orig' : '?name=orig';
  }
  
  return imageUrl;
}

function collectTwitterImages() {
  const imageUrls = new Set();
  const imageSelectors = [
    'img[src*="https://pbs.twimg.com/media"]',
    'img[src*="https://ton.twitter.com"]',
    'div[aria-label*="Image"] img',
    'div[data-testid="tweetPhoto"] img',
    'img[alt*="Image"]',
    '[data-testid="tweetPhoto"] img',
    '[data-testid="card.layoutSmall.media"] img',
    '[data-testid="card.layoutLarge.media"] img',
    'a[href*="/photo/"] img'
  ];
  
  // 最初のツイートを特別に処理
  const firstTweet = document.querySelector('article');
  if (firstTweet) {
    // 通常の画像セレクタでの検索
    firstTweet.querySelectorAll(imageSelectors.join(',')).forEach(img => {
      const normalizedUrl = normalizeImageUrl(img.src);
      if (normalizedUrl) imageUrls.add(normalizedUrl);
    });

    // aria-label属性を持つ要素内の画像を検索
    firstTweet.querySelectorAll('[aria-label]').forEach(el => {
      if (el.ariaLabel?.includes('Image')) {
        el.querySelectorAll('img').forEach(img => {
          const normalizedUrl = normalizeImageUrl(img.src);
          if (normalizedUrl) imageUrls.add(normalizedUrl);
        });
      }
    });
  }

  // 残りのツイートを処理
  document.querySelectorAll('article').forEach(article => {
    if (article === firstTweet) return;

    // 通常の画像セレクタでの検索
    article.querySelectorAll(imageSelectors.join(',')).forEach(img => {
      const normalizedUrl = normalizeImageUrl(img.src);
      if (normalizedUrl) imageUrls.add(normalizedUrl);
    });
  });

  const result = Array.from(imageUrls);
  console.log(`Collected ${result.length} unique images`);
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extractImages") {
    const loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(29, 161, 242, 0.9);
      color: white;
      padding: 10px 20px;
      border-radius: 20px;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    loadingDiv.textContent = "画像を収集中...";
    document.body.appendChild(loadingDiv);

    twitterAutoScroll().then(() => {
      const imageUrls = collectTwitterImages();
      loadingDiv.remove();

      chrome.runtime.sendMessage({
        action: "addImages",
        imageUrls: imageUrls,
      });
    });
  } else if (message.action === "scrollToImage") {
    const images = document.querySelectorAll(
      'img[src*="https://pbs.twimg.com/media"]'
    );
    let targetImage = null;

    for (const img of images) {
      if (
        img.src === message.imageUrl ||
        img.src.replace(/&name=\w+/, '&name=orig') === message.imageUrl
      ) {
        targetImage = img;
        break;
      }
    }

    if (targetImage) {
      targetImage.scrollIntoView({behavior: "smooth", block: "center"});
    }
  }
});