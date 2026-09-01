import { browser } from "./browser";

/**
 * 获取当前用户正在浏览且聚焦的活跃标签页 (Tab) 信息。
 * @returns {Promise<Object|undefined>} 活跃的标签页对象
 */
export const getCurTab = async () => {
  const [tab] = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  return tab;
};

/**
 * 获取当前活跃标签页的 ID。
 * @returns {Promise<number|undefined>} 标签页 ID
 */
export const getCurTabId = async () => {
  const tab = await getCurTab();
  return tab?.id;
};

const CONTENT_SCRIPT_FILE = "content.js";
const CONTENT_SCRIPT_READY_DELAYS = [0, 50, 150, 300];

const isMissingMessageReceiver = (err) =>
  err?.message?.includes("Could not establish connection") ||
  err?.message?.includes("Receiving end does not exist");

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function retryTabMessage(tabId, message) {
  for (const delay of CONTENT_SCRIPT_READY_DELAYS) {
    if (delay) await wait(delay);

    try {
      return await browser.tabs.sendMessage(tabId, message);
    } catch (err) {
      if (!isMissingMessageReceiver(err)) throw err;
    }
  }

  return null;
}

async function restoreContentScript(tabId) {
  if (typeof browser?.scripting?.executeScript !== "function") return false;

  await browser.scripting.executeScript({
    // 先恢复顶层页面即可建立弹窗通信；allFrames 可能因单个受限 iframe
    // 让整次注入 Promise 失败，造成主页面已经注入却仍被判定为不可用。
    target: { tabId },
    files: [CONTENT_SCRIPT_FILE],
  });
  return true;
}

/**
 * 向扩展后台 Service Worker (Background) 发送单向或双向消息。
 * REVIEW: 该方法依赖 `browser?.runtime` API，只能在浏览器扩展环境（Content Script, Popup, Options 等）下工作。
 * 在油猴 Userscript 环境中不可使用（油猴需使用特定 GM 接口或 CustomEvent 传递信息）。
 * @param {string} action 指令动作名称
 * @param {Object} args 指令参数数据
 * @returns {Promise<*>} 后台响应的数据
 */
export const sendBgMsg = (action, args) =>
  browser?.runtime.sendMessage({ action, args });

/**
 * 向当前活跃页面标签发送通信消息。
 * @param {string} action 指令动作名称
 * @param {Object} args 指令参数数据
 * @returns {Promise<*>} 页面 Content Script 接收处理后的响应数据
 */
export const sendTabMsg = async (action, args) => {
  const tabId = await getCurTabId();
  if (!tabId) return null;

  const message = { action, args };

  try {
    return await browser.tabs.sendMessage(tabId, message);
  } catch (err) {
    if (!isMissingMessageReceiver(err)) throw err;
  }

  // 本地扩展更新后，已经打开的页面不会自动加载新版本 content.js。
  // 先短暂等待页面自身初始化；仍无接收端时主动补注入并重试。
  const lateResponse = await retryTabMessage(tabId, message);
  if (lateResponse !== null) return lateResponse;

  try {
    if (!(await restoreContentScript(tabId))) return null;
    return await retryTabMessage(tabId, message);
  } catch (err) {
    // chrome://、商店页等受限页面无法注入，维持原有的安全静默行为。
    if (isMissingMessageReceiver(err)) return null;
    if (
      err?.message?.includes("Cannot access") ||
      err?.message?.includes("The extensions gallery cannot be scripted")
    ) {
      return null;
    }
    throw err;
  }
};
