/**
 * CAI Browser Operator — Popup Script v1.1
 */

let connected = false;
let sharing = false;
let tasksCompleted = 0;
let totalEarned = 0;
let peerCount = 0;

// Load state
chrome.storage.local.get(["isSharing", "tasksCompleted", "totalEarned"], (data) => {
  sharing = data.isSharing || false;
  tasksCompleted = data.tasksCompleted || 0;
  totalEarned = data.totalEarned || 0;
  updateUI();
});

// Check connection
chrome.runtime.sendMessage({ type: "getStatus" }, (response) => {
  if (response) {
    connected = response.connected;
    updateUI();
  }
});

function updateUI() {
  const dot = document.getElementById("dot");
  const statusText = document.getElementById("statusText");
  const connectBtn = document.getElementById("connectBtn");
  const screenshotBtn = document.getElementById("screenshotBtn");
  const shareToggle = document.getElementById("shareToggle");
  const tasksEl = document.getElementById("tasksCount");
  const earnedEl = document.getElementById("earnedAmount");
  const peerEl = document.getElementById("peerCount");

  // Status
  if (connected && sharing) {
    dot.className = "dot sharing";
    statusText.textContent = "Sharing & Connected";
  } else if (connected) {
    dot.className = "dot on";
    statusText.textContent = "Connected to CAI";
  } else {
    dot.className = "dot off";
    statusText.textContent = "Disconnected";
  }

  // Buttons
  connectBtn.textContent = connected ? "Disconnect" : "Connect to CAI";
  connectBtn.className = connected ? "btn danger" : "btn primary";
  screenshotBtn.style.display = connected ? "block" : "none";

  // Toggle
  shareToggle.className = sharing ? "toggle active" : "toggle";

  // Stats
  tasksEl.textContent = tasksCompleted;
  earnedEl.textContent = `$${totalEarned.toFixed(2)}`;
  peerEl.textContent = peerCount;
}

function toggleConnection() {
  if (connected) {
    chrome.runtime.sendMessage({ type: "disconnect" });
    connected = false;
  } else {
    chrome.runtime.sendMessage({ type: "connect" });
    connected = true;
  }
  updateUI();
}

function toggleSharing() {
  sharing = !sharing;
  chrome.storage.local.set({ isSharing: sharing });
  chrome.runtime.sendMessage({ type: "set_sharing", enabled: sharing });
  updateUI();
}

function takeScreenshot() {
  chrome.runtime.sendMessage({ type: "screenshot" });
}

// Load tabs
chrome.tabs.query({}, (tabs) => {
  const list = document.getElementById("tabsList");
  list.innerHTML = tabs.slice(0, 8).map((t) => `
    <div class="tab-item ${t.active ? "active" : ""}" title="${t.url}">
      <span class="tab-dot"></span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.title || t.url}</span>
    </div>
  `).join("");
});

// Update stats periodically
setInterval(() => {
  chrome.storage.local.get(["tasksCompleted", "totalEarned"], (data) => {
    tasksCompleted = data.tasksCompleted || 0;
    totalEarned = data.totalEarned || 0;
    updateUI();
  });
}, 2000);
