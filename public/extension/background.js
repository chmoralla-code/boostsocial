// CYNETWORK Facebook Automation background service worker
console.log("CYNETWORK Service Worker initialized.");

let isOffscreenActive = false;

// Listen for external messages from the Next.js web application
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log("External message received:", message);

  if (message.action === "CHECK_EXTENSION") {
    sendResponse({ active: true, version: "1.1.0", autonomous: true });
    return true;
  }

  if (message.action === "START_AUTOMATION") {
    const useBackground = message.useBackground !== false; // Default to background autonomous offscreen

    if (useBackground) {
      logToWebApp("🤖 [SYSTEM] Spawning autonomous background worker process...", 5);
      
      // Securely store queue state to local storage to prevent any messaging race conditions with the offscreen DOM
      chrome.storage.local.set({
        activeQueue: {
          photos: message.photos,
          fbEmail: message.fbEmail
        }
      }, () => {
        setupOffscreenDocument();
      });
      
      sendResponse({ success: true, status: "Autonomous background bot launched invisibly!" });
    } else {
      // Classic Visual Tab posting mode
      chrome.tabs.create({ url: "https://www.facebook.com/", active: true }, (tab) => {
        setTimeout(() => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              action: "EXECUTE_POSTS",
              photos: message.photos,
              fbEmail: message.fbEmail
            });
          }
        }, 5000);
      });
      sendResponse({ success: true, status: "Launching active browser visual composer..." });
    }
    return true;
  }
  
  if (message.action === "SCHEDULE_AUTONOMOUS_ALARM") {
    // Creates a cron-like alarm to poll your database every 10 minutes in the background
    chrome.alarms.create("CYNETWORK_CRON_POSTER", { periodInMinutes: 10 });
    sendResponse({ success: true, message: "Autonomous schedule cron established." });
    return true;
  }
});

// Manage alarms for autonomous cron postings
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "CYNETWORK_CRON_POSTER") {
    console.log("CYNETWORK Cron poster fired in background...");
    // In a real-world scenario, you fetch the scheduled posts queue from your Supabase endpoint:
    // fetch("https://YOUR_PROJECT.supabase.co/rest/v1/scheduled_posts?select=*")
    //   .then(res => res.json())
    //   .then(posts => {
    //       if (posts.length > 0) { ... launch offscreen document ... }
    //   });
  }
});

// Listen for logs streamed from our scripts and relay to webapp tab
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "LOG_UPDATE" || message.action === "AUTOMATION_COMPLETE" || message.action === "POST_PROGRESS") {
    // Relay logs to active tab webapp
    relayMessageToWebapp(message);
  }
  
  if (message.action === "OFFSCREEN_COMPLETE") {
    closeOffscreenDocument();
    relayMessageToWebapp({
      action: "AUTOMATION_COMPLETE",
      status: "SUCCESS"
    });
  }
  return true;
});

async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL("offscreen.html");
  
  // Check if offscreen document is already created
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"]
  });

  if (existingContexts.length > 0) {
    isOffscreenActive = true;
    return;
  }

  isOffscreenActive = true;
  await chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: ["DOM_PARSER"],
    justification: "Autonomous background posting automation DOM context"
  });
}

async function closeOffscreenDocument() {
  if (!isOffscreenActive) return;
  
  try {
    await chrome.offscreen.closeDocument();
  } catch (err) {
    console.error("Error closing offscreen document:", err);
  }
  isOffscreenActive = false;
}

function relayMessageToWebapp(message) {
  chrome.tabs.query({ url: ["http://localhost:3000/*", "https://fboosting.vercel.app/*", "https://*.vercel.app/*"] }, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message);
      }
    });
  });
}

function logToWebApp(logText, progress) {
  relayMessageToWebapp({
    action: "LOG_UPDATE",
    log: logText,
    progress: progress
  });
}
