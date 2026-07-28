/**
 * CAI Browser Operator — Background Service Worker v1.1
 * Features: WebSocket, task queue, peer sharing, screenshot, history, cookies, downloads
 */

const WS_PORT = 5173;
const NETWORK_PORT = 5173;
let ws = null;
let networkWs = null;
let connected = false;
let activeTabId = null;
let taskQueue = [];
let isSharing = false;
let userId = null;
let tasksCompleted = 0;
let totalEarned = 0;

// ─── Initialization ───
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "cai-analyze",
    title: "Analyze with CAI",
    contexts: ["page", "selection", "image", "link"]
  });
  chrome.contextMenus.create({
    id: "cai-screenshot",
    title: "Screenshot for CAI",
    contexts: ["page"]
  });
  chrome.contextMenus.create({
    id: "cai-extract",
    title: "Extract text for CAI",
    contexts: ["selection"]
  });
});

// ─── Context Menu ───
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case "cai-analyze":
      const screenshot = await captureTab(tab.id);
      sendToCAI({ type: "analyze", url: tab.url, title: tab.title, text: info.selectionText, screenshot });
      break;
    case "cai-screenshot":
      const ss = await captureTab(tab.id);
      sendToCAI({ type: "screenshot", url: tab.url, screenshot: ss });
      break;
    case "cai-extract":
      sendToCAI({ type: "extracted_text", text: info.selectionText, url: tab.url });
      break;
  }
});

// ─── WebSocket Connection to CAI App ───
function connectToCAI() {
  try {
    ws = new WebSocket(`ws://localhost:${WS_PORT}`);

    ws.onopen = () => {
      connected = true;
      updateBadge();
      sendTabsList();
      sendToCAI({ type: "extension_ready", version: "1.1.0", capabilities: getCapabilities() });
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        await handleMessage(msg);
      } catch (err) {
        console.error("[CAI] Message error:", err);
      }
    };

    ws.onclose = () => {
      connected = false;
      updateBadge();
      setTimeout(connectToCAI, 3000);
    };

    ws.onerror = () => { connected = false; updateBadge(); };
  } catch (err) {
    setTimeout(connectToCAI, 5000);
  }
}

// ─── WebSocket Connection to Browser Network ───
function connectToNetwork() {
  try {
    networkWs = new WebSocket(`ws://localhost:${NETWORK_PORT}`);

    networkWs.onopen = () => {
      networkWs.send(JSON.stringify({
        type: "register",
        userId,
        capabilities: getCapabilities(),
        userAgent: navigator.userAgent,
        isSharing,
      }));
    };

    networkWs.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "task_assigned" && isSharing) {
          await executeSharedTask(msg.task);
        }
      } catch {}
    };

    networkWs.onclose = () => { setTimeout(connectToNetwork, 5000); };
    networkWs.onerror = () => {};
  } catch {}
}

// ─── Capabilities ───
function getCapabilities() {
  return [
    "navigate", "click", "type", "scroll", "screenshot", "wait",
    "select", "hover", "press", "extract", "evaluate", "cookies",
    "history", "downloads", "bookmarks", "tabs", "clipboard",
    "forms", "navigation", "network", "storage"
  ];
}

// ─── Badge Update ───
function updateBadge() {
  if (connected && isSharing) {
    chrome.action.setBadgeText({ text: "💰" });
    chrome.action.setBadgeBackgroundColor({ color: "#4ade80" });
  } else if (connected) {
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#4ade80" });
  } else {
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
  }
}

// ─── Send to CAI ───
function sendToCAI(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// ─── Send Tabs List ───
async function sendTabsList() {
  const tabs = await chrome.tabs.query({});
  sendToCAI({
    type: "tabs",
    tabs: tabs.map((t) => ({
      id: t.id, url: t.url, title: t.title, active: t.active, windowId: t.windowId, favIconUrl: t.favIconUrl,
    }))
  });
}

// ─── Capture Tab ───
async function captureTab(tabId) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png", quality: 80 });
    return dataUrl.split(",")[1];
  } catch {
    return null;
  }
}

// ─── Handle Messages ───
async function handleMessage(msg) {
  const { id, type } = msg;

  try {
    let result = {};

    switch (type) {
      case "getTabs":
        await sendTabsList();
        return;

      case "navigate":
        const navTab = await chrome.tabs.update({ url: msg.url });
        await waitForTabLoad(navTab.id);
        result = { tab: { id: navTab.id, url: msg.url } };
        break;

      case "click":
        result = await executeInTab(msg.tabId || activeTabId, { action: "click", selector: msg.selector, x: msg.x, y: msg.y });
        break;

      case "type":
        result = await executeInTab(msg.tabId || activeTabId, { action: "type", selector: msg.selector, value: msg.value });
        break;

      case "scroll":
        result = await executeInTab(msg.tabId || activeTabId, { action: "scroll", value: msg.direction, y: msg.amount });
        break;

      case "screenshot":
        const tabId = msg.tabId || activeTabId;
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });
        result = { screenshot: dataUrl.split(",")[1], tabId };
        break;

      case "select":
        result = await executeInTab(msg.tabId || activeTabId, { action: "select", selector: msg.selector, value: msg.value });
        break;

      case "hover":
        result = await executeInTab(msg.tabId || activeTabId, { action: "hover", selector: msg.selector });
        break;

      case "press":
        result = await executeInTab(msg.tabId || activeTabId, { action: "press", key: msg.key });
        break;

      case "extract":
        result = await executeInTab(msg.tabId || activeTabId, { action: "extract", selector: msg.selector });
        break;

      case "evaluate":
        result = await executeInTab(msg.tabId || activeTabId, { action: "evaluate", script: msg.script });
        break;

      case "cookies":
        const cookies = await chrome.cookies.getAll({ url: msg.url });
        result = { cookies };
        break;

      case "history":
        const history = await chrome.history.search({ text: msg.query || "", maxResults: msg.limit || 50 });
        result = { history };
        break;

      case "downloads":
        const downloads = await chrome.downloads.search({ limit: msg.limit || 20 });
        result = { downloads };
        break;

      case "tabs":
        const tabs = await chrome.tabs.query({});
        result = { tabs };
        break;

      case "new_tab":
        const newTab = await chrome.tabs.create({ url: msg.url, active: msg.active !== false });
        result = { tab: { id: newTab.id, url: newTab.url } };
        break;

      case "close_tab":
        await chrome.tabs.remove(msg.tabId);
        result = { closed: msg.tabId };
        break;

      case "switch_tab":
        await chrome.tabs.update(msg.tabId, { active: true });
        activeTabId = msg.tabId;
        result = { switched: msg.tabId };
        break;

      case "fill_form":
        result = await executeInTab(msg.tabId || activeTabId, { action: "fill_form", fields: msg.fields });
        break;

      case "wait_for":
        result = await executeInTab(msg.tabId || activeTabId, { action: "wait_for", selector: msg.selector, timeout: msg.timeout });
        break;

      case "get_text":
        result = await executeInTab(msg.tabId || activeTabId, { action: "get_text", selector: msg.selector });
        break;

      case "get_links":
        result = await executeInTab(msg.tabId || activeTabId, { action: "get_links" });
        break;

      case "get_inputs":
        result = await executeInTab(msg.tabId || activeTabId, { action: "get_inputs" });
        break;

      case "scroll_to":
        result = await executeInTab(msg.tabId || activeTabId, { action: "scroll_to", selector: msg.selector });
        break;

      case "highlight":
        result = await executeInTab(msg.tabId || activeTabId, { action: "highlight", selector: msg.selector });
        break;

      case "set_sharing":
        isSharing = msg.enabled;
        updateBadge();
        if (networkWs && networkWs.readyState === WebSocket.OPEN) {
          networkWs.send(JSON.stringify({ type: "sharing_status", enabled: isSharing }));
        }
        result = { sharing: isSharing };
        break;

      default:
        result = { error: `Unknown action: ${type}` };
    }

    sendToCAI({ id, ...result });
    await sendTabsList();
  } catch (err) {
    sendToCAI({ id, error: err.message });
  }
}

// ─── Execute in Content Script ───
function executeInTab(tabId, action) {
  return new Promise((resolve, reject) => {
    if (!tabId) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          activeTabId = tabs[0].id;
          executeAndResolve(tabs[0].id, action, resolve, reject);
        } else {
          reject(new Error("No active tab"));
        }
      });
    } else {
      executeAndResolve(tabId, action, resolve, reject);
    }
  });
}

function executeAndResolve(tabId, action, resolve, reject) {
  chrome.tabs.sendMessage(tabId, action, (response) => {
    if (chrome.runtime.lastError) {
      chrome.scripting.executeScript(
        { target: { tabId }, files: ["content.js"] },
        () => {
          if (chrome.runtime.lastError) {
            reject(new Error("Cannot inject content script"));
            return;
          }
          chrome.tabs.sendMessage(tabId, action, (resp) => resolve(resp || {}));
        }
      );
    } else {
      resolve(response || {});
    }
  });
}

// ─── Wait for Tab Load ───
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        chrome.webNavigation.onCompleted.removeListener(listener);
        activeTabId = tabId;
        resolve();
      }
    };
    chrome.webNavigation.onCompleted.addListener(listener);
    setTimeout(() => { chrome.webNavigation.onCompleted.removeListener(listener); resolve(); }, 15000);
  });
}

// ─── Execute Shared Task (for peer sharing) ───
async function executeSharedTask(task) {
  sendToCAI({ type: "task_started", taskId: task.id });

  for (const step of task.steps || []) {
    try {
      const result = await handleMessage({ type: step.action, ...step });
      sendToCAI({ type: "task_step", taskId: task.id, step: step.action, result });
    } catch (err) {
      sendToCAI({ type: "task_error", taskId: task.id, error: err.message });
    }
  }

  tasksCompleted++;
  totalEarned += task.earnings || 0.01;

  // Save earnings
  chrome.storage.local.set({ tasksCompleted, totalEarned });

  sendToCAI({ type: "task_completed", taskId: task.id, earned: task.earnings || 0.01 });
}

// ─── Tab Tracking ───
chrome.tabs.onActivated.addListener((info) => { activeTabId = info.tabId; });
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete" && connected) sendTabsList();
});

// ─── Storage Sync ───
chrome.storage.local.get(["isSharing", "tasksCompleted", "totalEarned"], (data) => {
  isSharing = data.isSharing || false;
  tasksCompleted = data.tasksCompleted || 0;
  totalEarned = data.totalEarned || 0;
  updateBadge();
});

// ─── Start ───
connectToCAI();
connectToNetwork();
