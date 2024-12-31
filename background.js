chrome.commands.onCommand.addListener((command) => {
  console.log("Command received:", command);
  if (command === "toggle-viewer") {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "toggle-viewer"
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
          }
        });
      }
    });
  }
});

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