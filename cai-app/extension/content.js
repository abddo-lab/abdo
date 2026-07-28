/**
 * CAI Browser Operator — Content Script v1.1
 * Executes actions in the page with enhanced capabilities
 */

(function () {
  if (window.__CAI_CONTENT_LOADED__) return;
  window.__CAI_CONTENT_LOADED__ = true;

  // Inject detection marker
  const marker = document.createElement("div");
  marker.id = "__cai_extension_loaded__";
  marker.setAttribute("data-version", "1.1.0");
  marker.style.display = "none";
  document.documentElement.appendChild(marker);

  // Listen for detection
  window.addEventListener("message", (event) => {
    if (event.data?.type === "__cai_detect__") {
      window.postMessage({ type: "__cai_extension_pong__", version: "1.1.0" }, "*");
    }
  });

  // ─── Message Handler ───
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    handleAction(msg).then(sendResponse).catch((err) => sendResponse({ error: err.message }));
    return true;
  });

  // ─── Action Router ───
  async function handleAction(msg) {
    switch (msg.action) {
      case "click": return doClick(msg.selector, msg.x, msg.y);
      case "type": return doType(msg.selector, msg.value);
      case "scroll": return doScroll(msg.value, msg.y);
      case "select": return doSelect(msg.selector, msg.value);
      case "hover": return doHover(msg.selector);
      case "press": return doPress(msg.key);
      case "extract": return doExtract(msg.selector);
      case "evaluate": return doEvaluate(msg.script);
      case "fill_form": return doFillForm(msg.fields);
      case "wait_for": return doWaitFor(msg.selector, msg.timeout);
      case "get_text": return doGetText(msg.selector);
      case "get_links": return doGetLinks();
      case "get_inputs": return doGetInputs();
      case "scroll_to": return doScrollTo(msg.selector);
      case "highlight": return doHighlight(msg.selector);
      default: return { error: `Unknown action: ${msg.action}` };
    }
  }

  // ─── Find Element ───
  function findElement(selector) {
    if (!selector) return null;
    let el = document.querySelector(selector);
    if (el) return el;

    // Try by text
    const all = document.querySelectorAll("button, a, input, textarea, select, [role='button'], [onclick], [tabindex], label, span, div");
    const lower = selector.toLowerCase().replace(/[\[\]"']/g, "");

    for (const e of all) {
      const text = (e.textContent || e.value || e.placeholder || e.getAttribute("aria-label") || e.title || "").toLowerCase().trim();
      if (text === lower || text.includes(lower) || lower.includes(text)) return e;
    }

    // Try by id
    el = document.getElementById(selector);
    if (el) return el;

    // Try by name
    el = document.querySelector(`[name="${selector}"]`);
    if (el) return el;

    return null;
  }

  // ─── Click ───
  async function doClick(selector, x, y) {
    let el;

    if (x !== undefined && y !== undefined) {
      // Click by coordinates
      el = document.elementFromPoint(x, y);
      if (!el) return { error: `No element at (${x}, ${y})` };
    } else {
      el = findElement(selector);
      if (!el) return { error: `Element not found: ${selector}` };
    }

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(150);

    // Highlight
    const orig = el.style.outline;
    el.style.outline = "2px solid #4ade80";
    setTimeout(() => el.style.outline = orig, 800);

    // Events
    const rect = el.getBoundingClientRect();
    const cx = x ?? rect.left + rect.width / 2;
    const cy = y ?? rect.top + rect.height / 2;

    el.dispatchEvent(new MouseEvent("mousedown", { clientX: cx, clientY: cy, bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { clientX: cx, clientY: cy, bubbles: true }));
    el.dispatchEvent(new MouseEvent("click", { clientX: cx, clientY: cy, bubbles: true }));

    // If it's a link, prevent navigation if needed
    if (el.tagName === "A" && el.href) {
      // Let it navigate naturally
    }

    return { data: { clicked: el.tagName, text: el.textContent?.slice(0, 50), x: cx, y: cy } };
  }

  // ─── Type ───
  async function doType(selector, value) {
    const el = findElement(selector);
    if (!el) return { error: `Element not found: ${selector}` };

    el.focus();
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(100);

    // Clear
    el.value = "";
    el.dispatchEvent(new Event("input", { bubbles: true }));

    // Type
    for (const char of value) {
      el.value += char;
      el.dispatchEvent(new KeyboardEvent("keydown", { key: char, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keypress", { key: char, bubbles: true }));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keyup", { key: char, bubbles: true }));
      await sleep(20 + Math.random() * 40);
    }

    el.dispatchEvent(new Event("change", { bubbles: true }));
    return { data: { typed: value.length, into: el.tagName } };
  }

  // ─── Scroll ───
  async function doScroll(direction, amount) {
    const delta = direction === "up" ? -(amount || 300) : (amount || 300);
    window.scrollBy({ top: delta, behavior: "smooth" });
    await sleep(200);
    return { data: { direction, amount: delta, scrollY: window.scrollY } };
  }

  // ─── Select ───
  async function doSelect(selector, value) {
    const el = findElement(selector);
    if (!el) return { error: `Element not found: ${selector}` };
    if (el.tagName !== "SELECT") return { error: "Not a select element" };
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return { data: { selected: value } };
  }

  // ─── Hover ───
  async function doHover(selector) {
    const el = findElement(selector);
    if (!el) return { error: `Element not found: ${selector}` };
    el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    return { data: { hovered: el.tagName } };
  }

  // ─── Press Key ───
  async function doPress(key) {
    const keyMap = { enter: "Enter", escape: "Escape", tab: "Tab", backspace: "Backspace", delete: "Delete", arrowup: "ArrowUp", arrowdown: "ArrowDown", arrowleft: "ArrowLeft", arrowright: "ArrowRight", space: " " };
    const mapped = keyMap[key.toLowerCase()] || key;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: mapped, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keypress", { key: mapped, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keyup", { key: mapped, bubbles: true }));
    return { data: { pressed: mapped } };
  }

  // ─── Extract ───
  async function doExtract(selector) {
    if (!selector || selector === "body") {
      return {
        data: {
          title: document.title,
          url: location.href,
          text: document.body.innerText.slice(0, 8000),
          links: Array.from(document.querySelectorAll("a[href]")).slice(0, 80).map((a) => ({ text: a.textContent.trim().slice(0, 100), href: a.href })),
          inputs: Array.from(document.querySelectorAll("input, textarea, select")).map((i) => ({ type: i.type, name: i.name, placeholder: i.placeholder, value: i.value, id: i.id })),
          buttons: Array.from(document.querySelectorAll("button, [role='button']")).map((b) => ({ text: b.textContent.trim().slice(0, 50), id: b.id })),
          images: Array.from(document.querySelectorAll("img")).slice(0, 20).map((i) => ({ src: i.src, alt: i.alt })),
        },
      };
    }

    const el = findElement(selector);
    if (!el) return { error: `Element not found: ${selector}` };
    return { data: { tag: el.tagName, text: el.innerText?.slice(0, 3000), html: el.innerHTML?.slice(0, 8000), attributes: Object.fromEntries(Array.from(el.attributes).map((a) => [a.name, a.value])) } };
  }

  // ─── Evaluate ───
  async function doEvaluate(script) {
    try {
      const result = eval(script);
      return { data: { result: typeof result === "object" ? JSON.stringify(result) : String(result) } };
    } catch (err) {
      return { error: err.message };
    }
  }

  // ─── Fill Form ───
  async function doFillForm(fields) {
    const results = [];
    for (const [selector, value] of Object.entries(fields)) {
      const el = findElement(selector);
      if (!el) { results.push({ selector, error: "not found" }); continue; }
      if (el.tagName === "SELECT") {
        el.value = value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (el.type === "checkbox") {
        el.checked = !!value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      results.push({ selector, ok: true });
    }
    return { data: { filled: results.length, results } };
  }

  // ─── Wait For Element ───
  async function doWaitFor(selector, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = findElement(selector);
      if (el) return { data: { found: selector, after: Date.now() - start } };
      await sleep(200);
    }
    return { error: `Timeout waiting for: ${selector}` };
  }

  // ─── Get Text ───
  async function doGetText(selector) {
    if (!selector) return { data: { text: document.body.innerText.slice(0, 5000) } };
    const el = findElement(selector);
    if (!el) return { error: `Element not found: ${selector}` };
    return { data: { text: el.innerText?.slice(0, 5000) } };
  }

  // ─── Get Links ───
  async function doGetLinks() {
    return {
      data: {
        links: Array.from(document.querySelectorAll("a[href]")).map((a) => ({
          text: a.textContent.trim().slice(0, 100),
          href: a.href,
          target: a.target,
        })),
      },
    };
  }

  // ─── Get Inputs ───
  async function doGetInputs() {
    return {
      data: {
        inputs: Array.from(document.querySelectorAll("input, textarea, select")).map((i) => ({
          tag: i.tagName, type: i.type, name: i.name, id: i.id,
          placeholder: i.placeholder, value: i.value, label: i.labels?.[0]?.textContent,
        })),
      },
    };
  }

  // ─── Scroll To Element ───
  async function doScrollTo(selector) {
    const el = findElement(selector);
    if (!el) return { error: `Element not found: ${selector}` };
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(300);
    return { data: { scrolledTo: el.tagName } };
  }

  // ─── Highlight ───
  async function doHighlight(selector) {
    const el = findElement(selector);
    if (!el) return { error: `Element not found: ${selector}` };
    const orig = el.style.outline;
    el.style.outline = "3px solid #4ade80";
    el.style.outlineOffset = "2px";
    setTimeout(() => { el.style.outline = orig; el.style.outlineOffset = ""; }, 3000);
    return { data: { highlighted: el.tagName } };
  }

  // ─── Utility ───
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  console.log("[CAI Browser] Content script v1.1.0 loaded");
})();
