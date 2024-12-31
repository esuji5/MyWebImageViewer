chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);
  
  if (message.action === "addImages") {
    // twitterImage.jsから送られてきた画像URLでビューアを開く
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "startViewer",
        imageUrls: message.imageUrls
      });
    });
  }
});