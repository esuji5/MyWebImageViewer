let collectedTwitterImages = new Set();

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

  collectedTwitterImages = new Set();

  let originalAuthor = null;
  const firstTweet = document.querySelector('article');
  if (firstTweet) {
    const authorLink = firstTweet.querySelector('a[href*="/status/"]');
    if (authorLink) {
      const match = authorLink.href.match(/(?:twitter\.com|x\.com)\/([^/]+)/);
      originalAuthor = match ? match[1] : null;
    }
  }

  if (!originalAuthor) {
    progressBar.remove();
    return;
  }

  function collectCurrentImages() {
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

    document.querySelectorAll('article').forEach(article => {
      const authorLink = article.querySelector('a[href*="/status/"]');
      if (!authorLink) return;

      const match = authorLink.href.match(/(?:twitter\.com|x\.com)\/([^/]+)/);
      const currentAuthor = match ? match[1] : null;
      
      if (currentAuthor !== originalAuthor) return;

      article.querySelectorAll(imageSelectors.join(',')).forEach(img => {
        const normalizedUrl = normalizeImageUrl(img.src);
        if (normalizedUrl) {
          collectedTwitterImages.add(normalizedUrl);
        }
      });

      article.querySelectorAll('[aria-label]').forEach(el => {
        if (el.ariaLabel?.includes('Image')) {
          el.querySelectorAll('img').forEach(img => {
            const normalizedUrl = normalizeImageUrl(img.src);
            if (normalizedUrl) {
              collectedTwitterImages.add(normalizedUrl);
            }
          });
        }
      });
    });
  }

  return new Promise((resolve) => {
    let finalScrollDone = false;

    const scroll = async () => {
      const currentPosition = window.scrollY;
      const timePassed = Date.now() - startTime;

      collectCurrentImages();
      const progress = Math.min((collectedTwitterImages.size / 10) * 100, 100);
      progressIndicator.style.width = `${progress}%`;

      let foundDifferentAuthor = false;
      document.querySelectorAll('article').forEach(article => {
        const authorLink = article.querySelector('a[href*="/status/"]');
        if (authorLink) {
          const match = authorLink.href.match(/(?:twitter\.com|x\.com)\/([^/]+)/);
          const currentAuthor = match ? match[1] : null;
          if (currentAuthor && currentAuthor !== originalAuthor) {
            foundDifferentAuthor = true;
          }
        }
      });

      const shouldStop = 
        foundDifferentAuthor ||
        currentPosition === lastScrollPosition ||
        timePassed >= maxWaitTime ||
        currentPosition >= document.documentElement.scrollHeight - window.innerHeight;

      if (shouldStop) {
        if (!finalScrollDone) {
          // 最終スクロールをまだ行っていない場合、もう一度だけスクロール
          finalScrollDone = true;
          lastScrollPosition = currentPosition;
          window.scrollBy({
            top: scrollStep,
            behavior: 'auto'
          });
          
          // 最後の画像収集のための待機
          await new Promise(r => setTimeout(r, scrollDelay * 2));
          collectCurrentImages();  // 最後の画像収集

          console.log(`Scroll completed. Images found: ${collectedTwitterImages.size}`);
          progressBar.remove();
          window.scrollTo(0, 0);
          resolve();
          return;
        }
        
        console.log(`Scroll completed. Images found: ${collectedTwitterImages.size}`);
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
  return Array.from(collectedTwitterImages);
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
      loadingDiv.remove();
      const imageUrls = collectTwitterImages();
      console.log("Sending collected images:", imageUrls);
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