document.addEventListener("DOMContentLoaded", () => {
  const startViewer = document.getElementById("startViewer");
  const rightToLeftCheckbox = document.getElementById("rightToLeft");
  const doublePageCheckbox = document.getElementById("doublePage");
  const urlTrackingCheckbox = document.getElementById("urlTrackingEnabled");
  const minWidthInput = document.getElementById("minWidth");
  const minHeightInput = document.getElementById("minHeight");

  // Load saved settings
  chrome.storage.local.get(
    [
      "rightToLeft",
      "doublePage",
      "urlTrackingEnabled",
      "minWidth",
      "minHeight",
    ],
    (result) => {
      // デフォルト値をtrueに変更
      rightToLeftCheckbox.checked = result.rightToLeft !== false;
      doublePageCheckbox.checked = result.doublePage !== false;
      urlTrackingCheckbox.checked = result.urlTrackingEnabled !== false;
      minWidthInput.value = result.minWidth || 300;
      minHeightInput.value = result.minHeight || 400;
    }
  );

  // Save settings when changed
  [
    rightToLeftCheckbox,
    doublePageCheckbox,
    urlTrackingCheckbox,
    minWidthInput,
    minHeightInput,
  ].forEach((element) => {
    element.addEventListener("change", () => {
      chrome.storage.local.set({
        rightToLeft: rightToLeftCheckbox.checked,
        doublePage: doublePageCheckbox.checked,
        urlTrackingEnabled: urlTrackingCheckbox.checked,
        minWidth: parseInt(minWidthInput.value),
        minHeight: parseInt(minHeightInput.value),
      });
    });
  });

  startViewer.addEventListener("click", () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        // First, try to send message
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "startViewer",
            minWidth: parseInt(minWidthInput.value),
            minHeight: parseInt(minHeightInput.value),
          },
          (response) => {
            // If message is received successfully
            window.close();
          }
        );

        // If message sending fails, inject scripts
        if (chrome.runtime.lastError) {
          chrome.scripting
            .executeScript({
              target: {tabId: tabs[0].id},
              files: ["content.js", "viewer.js"],
            })
            .then(() => {
              // Wait a short moment before sending the message
              setTimeout(() => {
                chrome.tabs.sendMessage(
                  tabs[0].id,
                  {
                    action: "startViewer",
                    minWidth: parseInt(minWidthInput.value),
                    minHeight: parseInt(minHeightInput.value),
                  },
                  (response) => {
                    window.close();
                  }
                );
              }, 100);
            })
            .catch((injectionError) => {
              console.error("Script injection failed:", injectionError);
            });
        }
      } else {
        console.error("No active tab found");
      }
    });
  });
});
