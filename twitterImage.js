let collectedTwitterImages = new Set();

async function twitterAutoScroll() {
  try {
    const scrollStep = window.innerHeight * 2;
    const scrollDelay = 500;
    const maxWaitTime = 60000;
    let lastScrollPosition = 0;
    let noChangeCount = 0;
    let startTime = Date.now();

    // UI要素の作成と追加
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

    // 画像コレクションの初期化
    collectedTwitterImages = new Set();

    // 最初のツイートの投稿者を特定
    const firstTweet = document.querySelector('article');
    if (!firstTweet) {
      throw new Error('ツイートが見つかりません。');
    }

    const authorLink = firstTweet.querySelector('a[href*="/status/"]');
    if (!authorLink) {
      throw new Error('投稿者の情報が見つかりません。');
    }

    const match = authorLink.href.match(/(?:twitter\.com|x\.com)\/([^/]+)/);
    const originalAuthor = match ? match[1] : null;
    if (!originalAuthor) {
      throw new Error('投稿者のユーザー名を取得できません。');
    }

    console.log(`Original author: ${originalAuthor}`);

    function collectCurrentImages() {
      try {
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
      } catch (error) {
        console.error('画像収集中にエラーが発生しました:', error);
        throw error;
      }
    }

    return new Promise((resolve, reject) => {
      let lastScrollAttemptCompleted = false;  // より明確な名前に変更

      const scroll = async () => {
        try {
          const currentPosition = window.scrollY;
          const timePassed = Date.now() - startTime;

          collectCurrentImages();
          const progress = Math.min((collectedTwitterImages.size / 10) * 100, 100);
          progressIndicator.style.width = `${progress}%`;

          let foundDifferentAuthor = false;
          document.querySelectorAll('article').forEach(article => {
            const authorLink = article.querySelector('a[href*="/status/"]');
            if (!authorLink) return;

            const match = authorLink.href.match(/(?:twitter\.com|x\.com)\/([^/]+)/);
            const currentAuthor = match ? match[1] : null;
            if (currentAuthor && currentAuthor !== originalAuthor) {
              foundDifferentAuthor = true;
              console.log(`Different author found: ${currentAuthor}`);
            }
          });

          const shouldStop = 
            foundDifferentAuthor ||
            currentPosition === lastScrollPosition ||
            timePassed >= maxWaitTime ||
            currentPosition >= document.documentElement.scrollHeight - window.innerHeight;

          if (shouldStop) {
            if (!lastScrollAttemptCompleted) {
              lastScrollAttemptCompleted = true;
              lastScrollPosition = currentPosition;
              window.scrollBy({
                top: scrollStep,
                behavior: 'auto'
              });
              
              await new Promise(r => setTimeout(r, scrollDelay * 2));
              collectCurrentImages();

              console.log(`スクロール完了。${collectedTwitterImages.size}枚の画像を発見しました。`);
              progressBar.remove();
              window.scrollTo(0, 0);
              resolve();
              return;
            }
            
            console.log(`スクロール完了。${collectedTwitterImages.size}枚の画像を発見しました。`);
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
        } catch (error) {
          console.error('スクロール処理中にエラーが発生しました:', error);
          progressBar.remove();
          reject(error);
        }
      };

      scroll();
    });
  } catch (error) {
    console.error('Twitter画像収集中にエラーが発生しました:', error);
    throw error;
  }
}

function normalizeImageUrl(url) {
  try {
    if (!url) {
      console.debug('URLが空です');
      return null;
    }

    if (!(url.startsWith('http://') || url.startsWith('https://'))) {
      console.debug('無効なURL形式です:', url);
      return null;
    }

    if (url.includes('profile_images') || url.includes('_normal.')) {
      console.debug('プロフィール画像をスキップします:', url);
      return null;
    }
    
    let imageUrl = url;
    if (imageUrl.includes('&name=')) {
      imageUrl = imageUrl.replace(/&name=\w+/, '&name=orig');
    } else if (imageUrl.includes('?format=')) {
      imageUrl = imageUrl.replace(/\?format=\w+/, '?format=png&name=orig');
    } else if (!imageUrl.includes('name=orig')) {
      imageUrl += imageUrl.includes('?') ? '&name=orig' : '?name=orig';
    }
    
    return imageUrl;
  } catch (error) {
    console.error('URL正規化中にエラーが発生しました:', error);
    return null;
  }
}

function collectTwitterImages() {
  console.log(`収集された画像数: ${collectedTwitterImages.size}`);
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

    twitterAutoScroll()
      .then(() => {
        loadingDiv.remove();
        const imageUrls = collectTwitterImages();
        console.log("収集した画像を送信します:", imageUrls);
        chrome.runtime.sendMessage({
          action: "addImages",
          imageUrls: imageUrls,
        });
      })
      .catch(error => {
        console.error('画像収集に失敗しました:', error);
        loadingDiv.textContent = "画像の収集に失敗しました";
        loadingDiv.style.background = "rgba(220, 53, 69, 0.9)"; // エラー時は赤色に
        setTimeout(() => {
          loadingDiv.remove();
        }, 3000);
      });
  } else if (message.action === "scrollToImage") {
    try {
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
      } else {
        console.warn('指定された画像が見つかりません:', message.imageUrl);
      }
    } catch (error) {
      console.error('画像へのスクロール中にエラーが発生しました:', error);
    }
  }
});