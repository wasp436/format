function addCJKSpacing(str) {
  return str
    .replace(/([一-龥])([A-Za-z0-9])/g, "$1 $2")
    .replace(/([A-Za-z0-9])([一-龥])/g, "$1 $2");
}

function copyText(formId, title) {
  const formEl = document.getElementById(formId);
  const formTitle =
    formEl.querySelector(".form-title")?.textContent?.trim() || title;
  const lines = [formTitle, ""];

  formEl.querySelectorAll(".form-list li").forEach((li, idx) => {
    let line = idx + 1 + ". ";

    li.childNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node;
      if (el.classList.contains("item-label")) {
        line += el.textContent.replace(/\s+/g, " ").trim();
      } else if (el.classList.contains("cb-group")) {
        const cb = el.querySelector('input[type="checkbox"]');
        const lbl = el.querySelector("label")?.textContent?.trim() || "";
        if (cb) line += (cb.checked ? "☑" : "☐") + lbl + " ";
      } else if (el.classList.contains("date-picker-trigger")) {
        line += el.textContent.trim();
      } else if (el.tagName === "INPUT" && el.type === "text") {
        line += el.value + "  ";
      }
    });

    lines.push(addCJKSpacing(line.trimEnd()));
  });

  navigator.clipboard
    .writeText(lines.join("\n"))
    .then(() => showToast())
    .catch(() => alert("複製失敗，請手動複製。"));
}

let _outputCanvas = null;

const FORM_RED = "#d32f2f";
const FORM_BLACK = "#222";
const FORM_INK = "#17318f";
const FORM_FONT_STACK =
  '"微軟正黑體","Microsoft JhengHei","蘋方-繁","PingFang TC",sans-serif';

function collectLiSegments(li) {
  const segments = [];

  function walk(node, style) {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.textContent.replace(/\s+/g, " ");
        if (t.trim()) {
          segments.push({
            text: t,
            color: style.red ? FORM_RED : FORM_BLACK,
            underline: !!style.underline,
            bold: !!style.bold,
          });
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child, {
          red: style.red || child.classList.contains("red"),
          underline: style.underline || child.classList.contains("underline"),
          bold: style.bold || child.classList.contains("bold"),
        });
      }
    });
  }

  li.childNodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node;
    if (el.classList.contains("item-label")) {
      walk(el, {
        red: el.classList.contains("red"),
        underline: el.classList.contains("underline"),
        bold: el.classList.contains("bold"),
      });
    } else if (el.classList.contains("cb-group")) {
      const cb = el.querySelector('input[type="checkbox"]');
      const checked = !!(cb && cb.checked);
      segments.push({
        text: checked ? "☑" : "☐",
        color: checked ? FORM_INK : "#666",
        bold: checked,
        big: true,
      });
      segments.push({ text: " ", color: FORM_BLACK });
      const lbl = el.querySelector("label");
      if (lbl) {
        walk(lbl, {
          red: lbl.classList.contains("red"),
          underline: lbl.classList.contains("underline"),
        });
      }
      segments.push({ text: "  ", color: FORM_BLACK });
    } else if (el.classList.contains("date-picker-trigger")) {
      const t = el.textContent.trim();
      if (t) segments.push({ text: t, color: FORM_INK });
    } else if (el.tagName === "INPUT" && el.type === "text") {
      if (el.value.trim())
        segments.push({ text: el.value + "  ", color: FORM_INK });
    }
  });

  return segments;
}

function tokenizeText(text) {
  const tokens = [];
  let buf = "";
  const isAsciiish = (ch) => /[A-Za-z0-9\/.\-:：%()（）+]/.test(ch);
  for (const ch of text) {
    if (ch.trim() === "") {
      if (buf) {
        tokens.push(buf);
        buf = "";
      }
      tokens.push(" ");
    } else if (isAsciiish(ch)) {
      buf += ch;
    } else {
      if (buf) {
        tokens.push(buf);
        buf = "";
      }
      tokens.push(ch);
    }
  }
  if (buf) tokens.push(buf);
  return tokens;
}

function generateFormImage(btn) {
  const panel = btn.closest(".form-panel");
  const formCard = panel.querySelector(".form-card");
  const title = formCard.querySelector(".form-title").textContent.trim();
  const items = formCard.querySelectorAll(".form-list > li");

  const scale = 3;
  const cssWidth = 380;
  const marginX = 22;
  const marginRight = 18;
  const indentWidth = 26;
  const lineHeight = 24;
  const fontSize = 15;
  const bigFontSize = fontSize + 4;
  const titleFontSize = 18;
  const topMargin = 40;

  const contentX = marginX + indentWidth;
  const contentWidth = cssWidth - contentX - marginRight;

  const meas = document.createElement("canvas");
  const mctx = meas.getContext("2d");
  const fontStr = (bold, big) =>
    `${bold ? "bold " : ""}${big ? bigFontSize : fontSize}px ${FORM_FONT_STACK}`;

  const renderedItems = [];
  items.forEach((li) => {
    const segments = collectLiSegments(li);
    const chunks = [];
    segments.forEach((seg) => {
      tokenizeText(seg.text).forEach((tok) => {
        chunks.push({
          text: tok,
          color: seg.color,
          underline: !!seg.underline,
          bold: !!seg.bold,
          big: !!seg.big,
        });
      });
    });

    const lines = [];
    let curLine = [];
    let curX = 0;
    chunks.forEach((chunk) => {
      mctx.font = fontStr(chunk.bold, chunk.big);
      const w = mctx.measureText(chunk.text).width;
      if (chunk.text === " " && curLine.length === 0) return;
      if (chunk.text !== " " && curX + w > contentWidth && curLine.length > 0) {
        lines.push(curLine);
        curLine = [];
        curX = 0;
      }
      curLine.push({
        text: chunk.text,
        w,
        color: chunk.color,
        underline: chunk.underline,
        bold: chunk.bold,
        big: chunk.big,
      });
      curX += w;
    });
    if (curLine.length) lines.push(curLine);
    if (!lines.length) lines.push([]);
    renderedItems.push({ lines });
  });

  let totalLines = 0;
  renderedItems.forEach((it) => (totalLines += Math.max(1, it.lines.length)));
  const contentHeight = Math.ceil(
    topMargin + titleFontSize + 26 + totalLines * lineHeight + 30,
  );

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(cssWidth * scale);
  canvas.height = Math.ceil(contentHeight * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cssWidth, contentHeight);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#000";
  ctx.font = `bold ${titleFontSize}px ${FORM_FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.fillText(title, cssWidth / 2, topMargin);
  ctx.textAlign = "left";

  let y = topMargin + titleFontSize + 26;
  renderedItems.forEach((item, idx) => {
    ctx.font = fontStr(false, false);
    ctx.fillStyle = FORM_BLACK;
    ctx.fillText(idx + 1 + ".", marginX, y);
    item.lines.forEach((line) => {
      let x = contentX;
      line.forEach((tok) => {
        ctx.font = fontStr(tok.bold, tok.big);
        ctx.fillStyle = tok.color;
        ctx.fillText(tok.text, x, y);
        if (tok.underline) {
          ctx.strokeStyle = tok.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y + 3);
          ctx.lineTo(x + tok.w, y + 3);
          ctx.stroke();
        }
        x += tok.w;
      });
      y += lineHeight;
    });
  });

  _outputCanvas = canvas;
  document.getElementById("output-modal-src").src =
    canvas.toDataURL("image/png");
  document.getElementById("output-modal").classList.add("open");
}

function downloadGeneratedImage() {
  if (!_outputCanvas) return;
  _outputCanvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const title =
      document
        .querySelector(".form-panel.active .form-title")
        ?.textContent?.trim() || "輸出圖片";
    a.download = title + ".png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, "image/png");
}

function copyGeneratedImage() {
  if (!_outputCanvas) return;
  if (!navigator.clipboard || !window.ClipboardItem) {
    alert("此瀏覽器不支援複製圖片，請改用下載圖片。");
    return;
  }
  _outputCanvas.toBlob((blob) => {
    navigator.clipboard
      .write([new ClipboardItem({ "image/png": blob })])
      .then(() => showToast("圖片已複製！"))
      .catch(() => alert("複製圖片失敗，請改用下載圖片。"));
  }, "image/png");
}

function closeOutputModal() {
  document.getElementById("output-modal").classList.remove("open");
  document.getElementById("output-modal-src").src = "";
}

function openImgModal(src) {
  document.getElementById("img-modal-src").src = src;
  document.getElementById("img-modal").classList.add("open");
}

function closeImgModal() {
  document.getElementById("img-modal").classList.remove("open");
  document.getElementById("img-modal-src").src = "";
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg || "已複製！";
  t.classList.add("show");
  setTimeout(() => {
    t.classList.remove("show");
    t.textContent = "已複製！";
  }, 1800);
}

function pasteFromClipboard() {
  navigator.clipboard
    .readText()
    .then((text) => fillFormFromText(text))
    .catch(() => alert("無法讀取剪貼簿，請確認瀏覽器已允許存取剪貼簿"));
}

function clearForm() {
  const activePanel = document.querySelector(".form-panel.active");
  if (!activePanel) return;
  const formCard = activePanel.querySelector(".form-card");

  formCard.querySelectorAll('input[type="text"]').forEach((input) => {
    input.value = "";
  });
  formCard.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.checked = false;
  });

  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const d = today.getDate();
  const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const label = `${y - 1911}.${m}.${d}`;
  formCard.querySelectorAll(".date-picker-trigger").forEach((el) => {
    el.dataset.date = dateStr;
    el.textContent = label;
  });

  saveFormState(formCard.id);
  showToast("已清空！");
}

// 在字串中尋找 needle（忽略空白差異），回傳原字串的起訖位置
function looseIndexOf(str, needle, from) {
  const plainChars = [];
  const posMap = [];
  for (let i = from || 0; i < str.length; i++) {
    if (!/\s/.test(str[i])) {
      plainChars.push(str[i]);
      posMap.push(i);
    }
  }
  const plain = plainChars.join("");
  const target = needle.replace(/\s+/g, "");
  if (!target) return null;
  const pos = plain.indexOf(target);
  if (pos < 0) return null;
  return {
    start: posMap[pos],
    end: posMap[pos + target.length - 1] + 1,
  };
}

// 依 li 內元素的排列順序解析單行文字（支援同一項目有多組標籤／欄位）
function fillLiFromLine(li, line) {
  let rest = line.replace(/^\d+\.\s*/, "");
  const els = Array.from(li.children).filter(
    (el) =>
      el.classList.contains("item-label") ||
      el.classList.contains("cb-group") ||
      el.classList.contains("date-picker-trigger") ||
      (el.tagName === "INPUT" && el.type === "text"),
  );

  let cursor = 0;

  for (let i = 0; i < els.length; i++) {
    const el = els[i];

    if (el.classList.contains("item-label")) {
      const hit = looseIndexOf(rest, el.textContent, cursor);
      if (hit) cursor = hit.end;
      continue;
    }

    if (el.classList.contains("cb-group")) {
      const cb = el.querySelector('input[type="checkbox"]');
      if (!cb) continue;
      const lbl = el.querySelector("label")?.textContent?.trim() || "";
      let hit = null;
      if (lbl) {
        const checkedHit = looseIndexOf(rest, "☑" + lbl, cursor);
        const uncheckedHit = looseIndexOf(rest, "☐" + lbl, cursor);
        if (checkedHit && uncheckedHit)
          hit =
            checkedHit.start < uncheckedHit.start ? checkedHit : uncheckedHit;
        else hit = checkedHit || uncheckedHit;
      } else {
        const m = rest.slice(cursor).match(/[☑☐]/);
        if (m) hit = { start: cursor + m.index, end: cursor + m.index + 1 };
      }
      if (hit) {
        cb.checked = rest[hit.start] === "☑";
        cursor = hit.end;
      }
      continue;
    }

    // 值欄位：取到下一個標籤／勾選框之前的文字
    let end = rest.length;
    for (let j = i + 1; j < els.length; j++) {
      const next = els[j];
      if (next.classList.contains("item-label")) {
        const hit = looseIndexOf(rest, next.textContent, cursor);
        if (hit) end = hit.start;
        break;
      }
      if (next.classList.contains("cb-group")) {
        const m = rest.slice(cursor).match(/[☑☐]/);
        if (m) end = cursor + m.index;
        break;
      }
    }
    const val = rest.slice(cursor, end).trim();
    cursor = end;

    if (el.classList.contains("date-picker-trigger")) {
      if (/^\d{2,3}\.\d{1,2}\.\d{1,2}$/.test(val)) {
        const [rocY, m, d] = val.split(".").map(Number);
        const y = rocY + 1911;
        el.dataset.date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        el.textContent = val;
      }
    } else {
      el.value = val;
    }
  }
}

function fillFormFromText(text) {
  const activePanel = document.querySelector(".form-panel.active");
  if (!activePanel) return;
  const formCard = activePanel.querySelector(".form-card");
  const lines = text
    .trim()
    .split("\n")
    .filter((l) => /^\d+\./.test(l));
  const listItems = formCard.querySelectorAll(".form-list li");

  lines.forEach((line, idx) => {
    if (idx >= listItems.length) return;
    fillLiFromLine(listItems[idx], line);
  });

  saveFormState(formCard.id);
  showToast("已貼回！");
}

function showTab(index) {
  document.querySelectorAll(".form-panel").forEach((p, i) => {
    p.classList.toggle("active", i === index);
  });
  document.querySelectorAll(".tab-btn").forEach((b, i) => {
    b.classList.toggle("active", i === index);
  });
}

// ---- 日期選擇器 ----
const ITEM_H = 40;
let pickerTarget = null;
let yearArr = [],
  monthArr = [],
  dayArr = [];

function openDatePicker(el) {
  pickerTarget = el;
  const val = el.dataset.date;
  const today = new Date();
  let y = today.getFullYear(),
    m = today.getMonth() + 1,
    d = today.getDate();
  if (val) {
    const p = val.split("-").map(Number);
    if (p.length === 3) {
      y = p[0];
      m = p[1];
      d = p[2];
    }
  }
  document.getElementById("date-picker-overlay").classList.add("open");
  setTimeout(() => initPicker(y, m, d), 10);
}

function closeDatePicker(doConfirm) {
  if (doConfirm && pickerTarget) {
    const y = yearArr[getIdx("pcol-year")];
    const m = monthArr[getIdx("pcol-month")];
    const d = dayArr[getIdx("pcol-day")];
    if (y != null && m != null && d != null) {
      pickerTarget.dataset.date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      pickerTarget.textContent = `${y - 1911}.${m}.${d}`;
      const card = pickerTarget.closest(".form-card");
      if (card) saveFormState(card.id);
    }
  }
  document.getElementById("date-picker-overlay").classList.remove("open");
  pickerTarget = null;
}

function initPicker(y, m, d) {
  const curY = new Date().getFullYear();
  yearArr = [];
  for (let yr = curY - 2; yr <= curY + 1; yr++) yearArr.push(yr);
  monthArr = Array.from({ length: 12 }, (_, i) => i + 1);
  const dMax = new Date(y, m, 0).getDate();
  dayArr = Array.from({ length: dMax }, (_, i) => i + 1);

  fillCol(
    "pcol-year",
    yearArr.map((v) => v - 1911 + "年"),
    yearArr.indexOf(y),
  );
  fillCol(
    "pcol-month",
    monthArr.map((v) => v + "月"),
    monthArr.indexOf(m),
  );
  fillCol(
    "pcol-day",
    dayArr.map((v) => v + "日"),
    dayArr.indexOf(d),
  );

  const onYM = debounce(rebuildDays, 120);
  document.getElementById("pcol-year").onscroll = onYM;
  document.getElementById("pcol-month").onscroll = onYM;
}

function rebuildDays() {
  const y = yearArr[getIdx("pcol-year")] || new Date().getFullYear();
  const m = monthArr[getIdx("pcol-month")] || new Date().getMonth() + 1;
  const oldD = dayArr[getIdx("pcol-day")] || 1;
  const dMax = new Date(y, m, 0).getDate();
  dayArr = Array.from({ length: dMax }, (_, i) => i + 1);
  fillCol(
    "pcol-day",
    dayArr.map((v) => v + "日"),
    Math.min(oldD, dMax) - 1,
  );
}

function fillCol(id, labels, selIdx) {
  const col = document.getElementById(id);
  col.onscroll = null;
  col.innerHTML = "";
  for (let i = 0; i < 2; i++) col.appendChild(makePad());
  labels.forEach((txt) => {
    const div = document.createElement("div");
    div.className = "picker-item";
    div.textContent = txt;
    col.appendChild(div);
  });
  for (let i = 0; i < 2; i++) col.appendChild(makePad());
  col.scrollTop = Math.max(0, selIdx) * ITEM_H;
}

function makePad() {
  const d = document.createElement("div");
  d.className = "picker-pad";
  return d;
}

function getIdx(id) {
  const col = document.getElementById(id);
  return Math.round(col.scrollTop / ITEM_H);
}

function debounce(fn, ms) {
  let t;
  return function () {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

(function setTodayOnLoad() {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const d = today.getDate();
  const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const label = `${y - 1911}.${m}.${d}`;
  document.querySelectorAll(".date-picker-trigger").forEach((el) => {
    el.dataset.date = dateStr;
    el.textContent = label;
  });
})();

document.querySelectorAll(".form-panel:not(#panel-4)").forEach((panel) => {
  panel.addEventListener("change", (e) => {
    if (e.target.type !== "checkbox" || !e.target.checked) return;
    const li = e.target.closest("li");
    if (!li) return;
    li.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      if (cb !== e.target) cb.checked = false;
    });
  });
});

function saveFormState(formId) {
  const card = document.getElementById(formId);
  if (!card) return;
  const state = { inputs: {}, checkboxes: {}, dates: {} };
  card.querySelectorAll('input[type="text"]').forEach((el, i) => {
    state.inputs[i] = el.value;
  });
  card.querySelectorAll('input[type="checkbox"]').forEach((el) => {
    state.checkboxes[el.id] = el.checked;
  });
  card.querySelectorAll(".date-picker-trigger").forEach((el, i) => {
    state.dates[i] = {
      date: el.dataset.date || "",
      text: el.textContent,
    };
  });
  localStorage.setItem("form:" + formId, JSON.stringify(state));
}

function loadFormState(formId) {
  const card = document.getElementById(formId);
  if (!card) return;
  const raw = localStorage.getItem("form:" + formId);
  if (!raw) return;
  try {
    const state = JSON.parse(raw);
    card.querySelectorAll('input[type="text"]').forEach((el, i) => {
      if (state.inputs?.[i] != null) el.value = state.inputs[i];
    });
    card.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      if (state.checkboxes?.[el.id] != null)
        el.checked = state.checkboxes[el.id];
    });
    card.querySelectorAll(".date-picker-trigger").forEach((el, i) => {
      if (state.dates?.[i]?.text) {
        if (state.dates[i].date) el.dataset.date = state.dates[i].date;
        el.textContent = state.dates[i].text;
      }
    });
  } catch {}
}

// ---- 事件綁定（取代原本的 inline onclick）----
function bindEvents() {
  document.querySelector(".tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (btn) showTab(Number(btn.dataset.tab));
  });

  document.querySelector(".content").addEventListener("click", (e) => {
    const imgBtn = e.target.closest(".view-img-link");
    if (imgBtn) return openImgModal(imgBtn.dataset.img);

    const dateTrigger = e.target.closest(".date-picker-trigger");
    if (dateTrigger) return openDatePicker(dateTrigger);

    const copyBtn = e.target.closest(".copy-btn");
    if (copyBtn)
      return copyText(copyBtn.dataset.copyForm, copyBtn.dataset.copyTitle);

    if (e.target.closest(".paste-btn")) return pasteFromClipboard();
    if (e.target.closest(".clear-btn")) return clearForm();

    const genBtn = e.target.closest(".gen-btn");
    if (genBtn) return generateFormImage(genBtn);
  });

  const pickerOverlay = document.getElementById("date-picker-overlay");
  pickerOverlay.addEventListener("click", (e) => {
    if (e.target === pickerOverlay) closeDatePicker(false);
  });
  pickerOverlay
    .querySelector(".picker-cancel-btn")
    .addEventListener("click", () => closeDatePicker(false));
  pickerOverlay
    .querySelector(".picker-confirm-btn")
    .addEventListener("click", () => closeDatePicker(true));

  document.getElementById("schedule-close").addEventListener("click", () => {
    document.getElementById("schedule-modal").classList.remove("open");
  });

  document.getElementById("img-modal").addEventListener("click", closeImgModal);
  document
    .getElementById("output-download-btn")
    .addEventListener("click", downloadGeneratedImage);
  document
    .getElementById("output-copy-btn")
    .addEventListener("click", copyGeneratedImage);
  document
    .getElementById("output-close-btn")
    .addEventListener("click", closeOutputModal);
}

bindEvents();

const _schedule = [
  { name: "終端箱拆除", date: "2026-06-03" },
  { name: "小型送風機需汰換", date: "2026-08-10" },
  { name: "保溫失效", date: "2026-05-26" },
  { name: "變頻器故障", date: "2026-04-22" },
  { name: "管路漏水故障", date: "2026-05-25" },
  { name: "工作閥故障", date: "2026-05-29" },
  { name: "中正樓拆終端箱", date: "2026-06-17" },
  { name: "全院空調噪音", date: "2026-06-22" },
];
document.addEventListener("DOMContentLoaded", function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ul = document.getElementById("schedule-list");
  _schedule.forEach(({ name, date }) => {
    const li = document.createElement("li");
    if (!date) {
      li.textContent = `${name}：不明(?天)前`;
    } else {
      const [y, m, d] = date.split("-").map(Number);
      const rocDate = `${y - 1911}.${m}.${d}`;
      const diff = Math.abs(Math.round((today - new Date(date)) / 86400000));
      li.textContent = `${name}：${rocDate}(${diff}天前)`;
      li.className = diff <= 30 ? "schedule-green" : "schedule-red";
    }
    ul.appendChild(li);
  });
  document.getElementById("schedule-modal").classList.add("open");

  [
    "form-0",
    "form-1",
    "form-2",
    "form-3",
    "form-4",
    "form-5",
    "form-6",
    "form-7",
  ].forEach(loadFormState);

  document.querySelectorAll(".form-card").forEach((card) => {
    card.addEventListener("input", () => saveFormState(card.id));
    card.addEventListener("change", () => saveFormState(card.id));
  });
});
