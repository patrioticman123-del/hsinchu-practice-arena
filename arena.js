const $ = selector => document.querySelector(selector);
const subjects = ["數學", "自然", "國文", "英文", "英聽"];
const titles = { 自然: "自然（含理化）" };
const icons = { 數學: "∑", 自然: "⚗", 國文: "文", 英文: "Aa", 英聽: "♫" };
const display = subject => titles[subject] || subject;
const sets = catalog.sort((a, b) => b.year - a.year || subjects.indexOf(a.subject) - subjects.indexOf(b.subject));
const setsById = new Map(sets.map(set => [set.id, set]));
const key = "hsinchu-arena-v2";
const original = "t-115-math-數學";
const questionId = (id, n) => id + ":" + n;
const items = new Map();
for (const set of sets) {
  set.ids = set.items.map(([number, answer, page, position]) => {
    const id = questionId(set.id, number);
    items.set(id, { id, set, number, answer, page, position,
      written: set.id === original ? questions[number - 1] : null });
    return id;
  });
}
function load(k) {
  try { return JSON.parse(localStorage.getItem(k)); }
  catch { return null; }
}
const state = load(key) || { attempts: {}, wrong: {}, font: 0, filter: "全部" };
let saving = true;
function save() {
  try { localStorage.setItem(key, JSON.stringify(state)); }
  catch { saving = false; }
}
function newAttempt(ids) {
  return { ids, index: 0, answers: {}, flags: {}, unlocked: {} };
}
function record(attempt) {
  const checked = attempt.ids.filter(id => attempt.answers[id] === items.get(id).answer);
  const wrong = attempt.ids.filter(id => attempt.answers[id] !== items.get(id).answer);
  for (const id of wrong) {
    if (attempt.answers[id]) state.wrong[id] = (state.wrong[id] || 0) + 1;
  }
  return { ...attempt, wrong, score: Math.round(100 * checked.length / attempt.ids.length), at: Date.now() };
}
function bucket(session) {
  return state.attempts[session] ||= { history: [] };
}
if (!state.migrated) {
  const old = load("hsinchu-practice-tcsh-115-math-v1");
  if (old?.answers?.length === 25 && setsById.has(original)) {
    const attempt = newAttempt(setsById.get(original).ids);
    attempt.index = Math.min(24, Math.max(0, old.index || 0));
    attempt.ids.forEach((id, i) => {
      if (old.answers[i]) attempt.answers[id] = old.answers[i];
      if (old.flags?.[i]) attempt.flags[id] = true;
      if (old.unlocked?.[i]) attempt.unlocked[id] = true;
    });
    const existing = bucket(original);
    if (old.submitted) existing.history.push(record(attempt));
    else if (Object.keys(attempt.answers).length || Object.keys(attempt.flags).length ||
      Object.keys(attempt.unlocked).length || attempt.index) existing.draft = attempt;
  }
  state.migrated = true;
  save();
}

let session;
let attempt;
let reportIndex;
let contextPage;
let action;
let reportMode = "wrong";
const practice = $("#practice");
const report = $("#report");
const dialog = $("#action-dialog");
const answerOptions = item => item.set.subject === "英聽" ? "ABC" : "ABCD";
const pct = attempt => attempt.ids.filter(id => attempt.answers[id]).length;
const esc = text => String(text).replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[s]);
const button = (cmd, label, style = "", attrs = "") =>
  `<button type="button" class="button ${style}" data-action="${cmd}" ${attrs}>${label}</button>`;

function applyFont() {
  const size = [16, 18, 20, 23, 26][state.font + 1] || 18;
  document.documentElement.style.fontSize = size + "px";
  document.documentElement.style.setProperty("--paper-zoom", [100, 100, 112, 128, 145][state.font + 1] + "%");
  $("#font-minus").disabled = state.font <= -1;
  $("#font-plus").disabled = state.font >= 3;
}
for (const [selector, change] of [["#font-minus", -1], ["#font-plus", 1]]) {
  $(selector).addEventListener("click", () => {
    state.font += change;
    applyFont();
    save();
  });
}
applyFont();

function wrongIds(subject) {
  return [...items.values()].filter(item => item.set.subject === subject && state.wrong[item.id]).map(item => item.id);
}

function show(section, focus = true) {
  for (const name of ["library", "practice", "report"]) $("#" + name).hidden = name !== section;
  if (focus) {
    window.scrollTo(0, 0);
    $("#" + section).querySelector("h1,h2")?.focus({ preventScroll: true });
  }
}

function renderLibrary(focus = true) {
  const done = sets.filter(set => state.attempts[set.id]?.history.length).length;
  const active = sets.filter(set => !set.unavailable);
  const bankCount = active.reduce((sum, set) => sum + set.ids.length, 0);
  $("#stats").textContent = `${active.length} 份可作答 · ${bankCount} 題 · 已完成 ${done} 份`;
  $("#filters").innerHTML = ["全部", ...subjects].map(subject =>
    button("filter", display(subject), "", `data-id="${subject}" aria-pressed="${state.filter === subject}"`)).join("");
  const wrongSubjects = state.filter === "全部" ? subjects : [state.filter];
  $("#wrong-tools").innerHTML = wrongSubjects.map(subject => {
    const count = wrongIds(subject).length;
    return count || state.filter !== "全部"
      ? button("wrong", `重練${subject}錯題 · ${count} 題`, "wrong-button", `data-id="${subject}" ${count ? "" : "disabled"}`) : "";
  }).join("");
  const visible = sets.filter(set => state.filter === "全部" || set.subject === state.filter);
  $("#paper-grid").innerHTML = visible.map(set => {
    const saved = state.attempts[set.id];
    const latest = saved?.history.at(-1);
    return `<article class="panel arena-card">
      <div class="card-top"><span class="subject-icon" aria-hidden="true">${icons[set.subject]}</span>
      <span class="status ${latest ? "done" : saved?.draft ? "in-progress" : ""}">${latest ? "已完成" : saved?.draft ? "作答中" : set.unavailable ? "缺英聽音檔" : "未作答"}</span></div>
      <h3>${display(set.subject)}</h3><p class="muted">${set.year} 學年度 · ${set.school}</p>
      <p class="card-score">${latest ? `最近 ${latest.score} 分 · 共 ${saved.history.length} 次` : `${set.ids.length} 題`}${saved?.draft ? ` · 草稿 ${pct(saved.draft)}/${set.ids.length}` : ""}</p>
      ${set.unavailable ? `<p class="muted">${set.unavailable}</p>` : ""}
      <div class="card-actions">
        ${latest ? button("history", "看成績與錯題", "primary", `data-id="${set.id}"`) : ""}
        ${set.unavailable ? `<a class="button" href="${esc(set.source)}" target="_blank" rel="noopener">開啟官方原卷 ↗</a>` :
          button("open", saved?.draft ? "繼續作答" : latest ? "再作答一次" : "開始作答", latest ? "" : "primary", `data-id="${set.id}"`)}
      </div></article>`;
  }).join("");
  show("library", focus);
}

function paperRetryId(paperId, index) {
  return `retry:${index}:${paperId}`;
}
function paperRetrySource(id) {
  const match = /^retry:(\d+):(.+)$/.exec(id);
  if (!match) return null;
  return { paperId: match[2], index: Number(match[1]) };
}
function selectedMistakes(result) {
  return result.wrong.filter(id => Boolean(result.answers[id]));
}

function start(id) {
  const set = setsById.get(id);
  const retry = paperRetrySource(id);
  const source = retry && state.attempts[retry.paperId]?.history[retry.index];
  const ids = set?.ids || (source ? selectedMistakes(source) : wrongIds(id.slice(6)));
  if (!ids.length || set?.unavailable) return;
  practice.replaceChildren();
  practice.innerHTML = '<div class="session-audio"></div><div class="session-content"></div>';
  const saved = bucket(id);
  session = id;
  attempt = saved.draft ||= newAttempt(ids);
  contextPage = null;
  save();
  show("practice", false);
  renderPractice();
  practice.querySelector("h1").focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function sessionTitle() {
  const retry = paperRetrySource(session);
  const set = setsById.get(retry?.paperId || session);
  if (!set) return `${display(session.slice(6))}歷次錯題`;
  const title = `${set.year} 學年度 ${set.school} · ${display(set.subject)}`;
  return retry ? `${title} · 第 ${retry.index + 1} 次作答錯題` : title;
}
function itemSource(item) {
  return `${item.set.year} 學年度 ${item.set.school} · ${display(item.set.subject)} · 原卷第 ${item.number} 題`;
}
function renderWritten(item) {
  const q = item.written;
  const table = item.number === 3
    ? `<table class="bonus-table"><caption>業績獎金對照表</caption><thead><tr><th>業績（萬元）</th><th>獎金（元）</th></tr></thead><tbody><tr><td>未滿 50</td><td>5000</td></tr><tr><td>50 以上、未滿 75</td><td>14000</td></tr><tr><td>75 以上、未滿 100</td><td>29000</td></tr><tr><td>100 以上</td><td>60000</td></tr></tbody></table>` : "";
  return `<h2 class="prompt">${esc(q.prompt)}</h2>${table}${q.figure ? `<figure class="question-figure"><img src="./figures/q${q.number}.webp" alt="${esc(q.figure)}"></figure>` : ""}`;
}
function pageImage(item, page) {
  return `./bank/${item.set.asset}-${page}.webp`;
}
function renderSource(item) {
  const page = contextPage ?? item.page;
  const { start, end } = item.set;
  return `<div class="source-controls">
      ${button("source-prev", "← 題本上一頁", "", page <= start ? "disabled" : "")}
      ${button("source-home", "定位本題", "secondary")}
      ${button("source-next", "題本下一頁 →", "", page >= end ? "disabled" : "")}
    </div>
    <p class="small">可上下捲動，題組文章或圖表有時在題本上一頁。</p>
    <div class="paper-view" tabindex="0" aria-label="原卷題本第 ${page} 頁，可上下捲動">
      <img src="${pageImage(item, page)}" alt="原卷題本第 ${page} 頁，請依題號 ${item.number} 作答">
    </div>`;
}
function positionPaper(item) {
  const view = practice.querySelector(".paper-view");
  if (!view) return;
  const img = view.querySelector("img");
  const align = () => {
    if (!view.isConnected || contextPage !== null) return;
    const factor = item.set.asset === "y-113-engsci" && item.page === 5 ? .267 : 1;
    view.scrollTop = Math.max(0, img.clientHeight * item.position / factor - 12);
  };
  if (img.complete) align();
  else img.addEventListener("load", align, { once: true });
}

function explanation(item) {
  const note = item.written?.explanation || studyNotes[item.set.id]?.[item.number - item.set.items[0][0]];
  return `<div class="explanation" id="solution" tabindex="-1"><h3>官方答案 ${item.answer}${item.written ? " · " + esc(item.written.choices["ABCD".indexOf(item.answer)]) : ""}</h3>
    ${note ? `<p>${esc(note)}</p>` :
      `<p>本題來源只公布答案。<a href="${esc(item.set.source)}" target="_blank" rel="noopener">查看官方原卷 ↗</a></p>`}
    </div>`;
}
function renderPractice() {
  const item = items.get(attempt.ids[attempt.index]);
  const { ids, index } = attempt;
  const answered = pct(attempt);
  const marked = Object.values(attempt.flags).filter(Boolean).length;
  const flagged = Boolean(attempt.flags[item.id]);
  const audioSlot = practice.querySelector(".session-audio");
  const audioSrc = item.set.audio ? "./bank/" + item.set.audio : "";
  if (!audioSrc) audioSlot.replaceChildren();
  else if (audioSlot.querySelector("audio")?.getAttribute("src") !== audioSrc) {
    audioSlot.innerHTML = `<div class="panel audio-box"><label for="listening-audio">播放官方聽力音檔，依播報題號作答</label><audio controls preload="metadata" id="listening-audio" src="${audioSrc}"></audio></div>`;
  }
  practice.querySelector(".session-content").innerHTML = `<div class="screen-head"><div><button class="text-button" data-action="library">← 返回選卷</button>
    <h1 tabindex="-1">${sessionTitle()}</h1><p class="muted" id="progress-copy">已答 ${answered}/${ids.length} · 標記 ${marked} 題 · ${saving ? "本機自動儲存" : "無法保存至本機"}</p></div>
    ${button("submit", "交卷並看分數", "primary")}</div>
    <div class="arena-workspace">
    <article class="panel arena-question">
      <div class="question-meta"><div><strong>第 ${index + 1} / ${ids.length} 題</strong><p class="small">${itemSource(item)}</p></div>
        ${button("flag", flagged ? "⚑ 已標記" : "⚐ 標記不確定", "flag-button", `aria-pressed="${flagged}"`)}</div>
      ${item.written ? renderWritten(item) : renderSource(item)}
      <fieldset class="arena-choices ${item.written ? "written-choices" : ""}" aria-label="選擇答案">
        ${[...answerOptions(item)].map((letter, i) => `<label class="choice">
          <input type="radio" name="answer" value="${letter}" ${attempt.answers[item.id] === letter ? "checked" : ""}>
          <span class="letter">${letter}</span>${item.written ? esc(item.written.choices[i]) : ""}</label>`).join("")}
      </fieldset>
      <div class="question-tools">
        ${button("unlock", attempt.unlocked[item.id] ? "看已解鎖答案" : "用密碼查看答案／詳解")}
        ${button("clear", "清除選擇", "", attempt.answers[item.id] ? "" : "disabled")}
      </div>
      ${attempt.unlocked[item.id] ? explanation(item) : ""}
      <div class="pager">${button("prev", "← 上一題", "", index === 0 ? "disabled" : "")}
        ${index === ids.length - 1 ? button("submit", "交卷", "primary") : button("next", "下一題 →", "primary")}</div>
    </article>
    <aside class="panel arena-map"><h2>題目導覽</h2><div class="question-map" id="jump-map">${ids.map((id, i) => {
      const answered = Boolean(attempt.answers[id]);
      const marked = Boolean(attempt.flags[id]);
      return `<button type="button" data-action="jump" data-id="${i}" class="${answered ? "answered" : ""} ${marked ? "flagged" : ""}" ${i === index ? 'aria-current="step"' : ""} aria-label="第 ${i + 1} 題，${answered ? "已作答" : "未作答"}${marked ? "，有標記" : ""}">${i + 1}</button>`;
    }).join("")}</div></aside></div>`;
  positionPaper(item);
}
function move(i) {
  attempt.index = Math.max(0, Math.min(i, attempt.ids.length - 1));
  contextPage = null;
  save();
  renderPractice();
  practice.querySelector(".arena-question").scrollIntoView({ block: "start" });
}

function renderReport(index = bucket(session).history.length - 1) {
  const history = bucket(session).history;
  reportIndex = index;
  const result = history[index];
  const paper = setsById.has(session);
  const retry = paperRetrySource(session);
  const mistakeCount = selectedMistakes(result).length;
  const retryId = paper ? paperRetryId(session, index) : null;
  const retryState = retryId && state.attempts[retryId];
  const blank = result.ids.filter(id => !result.answers[id]).length;
  const visible = reportMode === "wrong" ? result.wrong : result.ids;
  report.innerHTML = `<div class="screen-head"><div><button class="text-button" data-action="library">← 返回選卷</button>
    <h1 tabindex="-1">${sessionTitle()}</h1></div>
    <div class="card-actions">
      ${retry ? button("source-report", "返回原卷成績") : ""}
      ${retryState?.history.length ? button("retry-history", "看錯題重練成績", "", `data-id="${retryId}"`) : ""}
      ${button("retry", paper ? "整份再作答" : "再作答一次", paper && mistakeCount ? "" : "primary")}
      ${paper && mistakeCount ? button("retry-paper", `${retryState?.draft ? "繼續重練這份錯題" : "重做這份錯題"} · ${mistakeCount} 題`, "primary", `data-id="${retryId}"`) : ""}
    </div></div>
    <div class="panel score-panel"><div class="score-number"><strong>${result.score}</strong> / 100 分</div>
      <div class="score-copy"><h2>已完成</h2><p>答對 ${result.ids.length - result.wrong.length} · 答錯 ${result.wrong.length - blank} · 未答 ${blank}</p></div>
      <label>作答紀錄 <select id="history-select">${history.map((entry, i) => `<option value="${i}" ${i === index ? "selected" : ""}>第 ${i + 1} 次 · ${entry.score} 分</option>`).reverse().join("")}</select></label></div>
    <div class="review">
      <div class="review-heading"><h2>${reportMode === "wrong" ? "錯題與未答題" : "全部作答紀錄"}</h2>
      ${button("report-filter", reportMode === "wrong" ? "查看全部題目" : "只看錯題與未答題")}</div>
      ${visible.length ? visible.map(id => {
        const item = items.get(id);
        const chosen = result.answers[id];
        return `<details class="panel review-item" data-question="${esc(id)}">
          <summary>${itemSource(item)} <span class="tag">${chosen ? chosen === item.answer ? "答對" : "答錯" : "未答"}${result.flags[id] ? " · 有標記" : ""}</span></summary>
          <div class="review-body"><p>你的答案 ${chosen || "未作答"}</p>${item.written ? renderWritten(item) :
            `<div class="paper-view review-paper" tabindex="0" aria-label="原卷第 ${item.number} 題所在頁"><img loading="lazy" src="${pageImage(item, item.page)}" alt="原卷第 ${item.number} 題所在頁"></div>`}
          ${explanation(item).replace('id="solution" ', "")}</div></details>`;
      }).join("") : '<p class="muted">這次全部答對了。</p>'}
    </div>`;
  show("report", practice.hidden === false || report.hidden);
}

function ask(type, title, detail, label) {
  action = type;
  $("#dialog-title").textContent = title;
  $("#dialog-detail").textContent = detail;
  $("#confirm-action").textContent = label;
  $("#pin-field").hidden = type !== "pin";
  $("#pin").value = "";
  $("#pin-error").textContent = "";
  dialog.showModal();
  (type === "pin" ? $("#pin") : $("#cancel-action")).focus();
}
$("#cancel-action").addEventListener("click", () => dialog.close());
$("#action-form").addEventListener("submit", event => {
  event.preventDefault();
  if (action === "pin" && $("#pin").value !== "5168") {
    $("#pin-error").textContent = "密碼不正確，請再試一次。";
    $("#pin").select();
    return;
  }
  dialog.close();
  if (action === "pin") {
    attempt.unlocked[attempt.ids[attempt.index]] = true;
    save();
    renderPractice();
    $("#solution").focus();
  } else {
    practice.querySelector("audio")?.pause();
    const saved = bucket(session);
    saved.history.push(record(attempt));
    delete saved.draft;
    save();
    reportMode = "wrong";
    renderReport();
  }
});

practice.addEventListener("change", event => {
  if (event.target.name !== "answer") return;
  const id = attempt.ids[attempt.index];
  attempt.answers[id] = event.target.value;
  save();
  $("#progress-copy").textContent = `已答 ${pct(attempt)}/${attempt.ids.length} · 標記 ${Object.values(attempt.flags).filter(Boolean).length} 題 · ${saving ? "本機自動儲存" : "無法保存至本機"}`;
  practice.querySelector('[data-action="clear"]').disabled = false;
  const jump = practice.querySelector('[aria-current="step"]');
  jump.classList.add("answered");
  jump.setAttribute("aria-label", `第 ${attempt.index + 1} 題，已作答${attempt.flags[id] ? "，有標記" : ""}`);
});
report.addEventListener("change", event => {
  if (event.target.id === "history-select") {
    renderReport(Number(event.target.value));
    $("#history-select").focus();
  }
});
report.addEventListener("toggle", event => {
  const entry = event.target;
  if (!entry.open || !entry.dataset.question) return;
  const item = items.get(entry.dataset.question);
  const view = entry.querySelector(".paper-view");
  const img = view?.querySelector("img");
  if (!img) return;
  const align = () => {
    const factor = item.set.asset === "y-113-engsci" && item.page === 5 ? .267 : 1;
    view.scrollTop = Math.max(0, img.clientHeight * item.position / factor - 12);
  };
  if (img.complete) align();
  else img.addEventListener("load", align, { once: true });
}, true);

$("#main").addEventListener("click", event => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const { action: cmd, id } = target.dataset;
  if (cmd === "filter") {
    state.filter = id;
    save();
    renderLibrary(false);
    $("#filters").querySelector('[aria-pressed="true"]').focus();
    return;
  }
  if (cmd === "library") { practice.querySelector("audio")?.pause(); renderLibrary(); return; }
  if (cmd === "open") { start(id); return; }
  if (cmd === "wrong") { start("wrong:" + id); return; }
  if (cmd === "history") { session = id; reportMode = "wrong"; renderReport(); return; }
  if (cmd === "retry") { start(session); return; }
  if (cmd === "retry-paper") { start(id); return; }
  if (cmd === "retry-history") { session = id; reportMode = "wrong"; renderReport(); return; }
  if (cmd === "source-report") {
    const retry = paperRetrySource(session);
    session = retry.paperId;
    reportMode = "wrong";
    renderReport(retry.index);
    return;
  }
  if (cmd === "report-filter") {
    reportMode = reportMode === "wrong" ? "all" : "wrong";
    renderReport(reportIndex);
    report.querySelector('[data-action="report-filter"]').focus();
    return;
  }
  const item = items.get(attempt.ids[attempt.index]);
  if (cmd === "flag") {
    attempt.flags[item.id] = !attempt.flags[item.id];
    save();
    target.setAttribute("aria-pressed", String(attempt.flags[item.id]));
    target.textContent = attempt.flags[item.id] ? "⚑ 已標記" : "⚐ 標記不確定";
    practice.querySelector('[aria-current="step"]').classList.toggle("flagged", attempt.flags[item.id]);
    $("#progress-copy").textContent = `已答 ${pct(attempt)}/${attempt.ids.length} · 標記 ${Object.values(attempt.flags).filter(Boolean).length} 題 · ${saving ? "本機自動儲存" : "無法保存至本機"}`;
  }
  if (cmd === "clear") {
    delete attempt.answers[item.id];
    save();
    renderPractice();
    practice.querySelector(".choice input").focus({ preventScroll: true });
  }
  if (cmd === "unlock") {
    if (attempt.unlocked[item.id]) $("#solution").focus();
    else ask("pin", "查看這一題", "輸入家長密碼後，只開啟目前這一題的答案與可用詳解。", "解鎖");
  }
  if (cmd === "prev") move(attempt.index - 1);
  if (cmd === "next") move(attempt.index + 1);
  if (cmd === "jump") move(Number(id));
  if (cmd.startsWith("source-")) {
    const page = contextPage ?? item.page;
    contextPage = cmd === "source-home" ? null : page + (cmd === "source-prev" ? -1 : 1);
    renderPractice();
    practice.querySelector('.paper-view').focus({ preventScroll: true });
  }
  if (cmd === "submit") {
    const blank = attempt.ids.length - pct(attempt);
    ask("submit", "確定交卷？", blank ? `還有 ${blank} 題未作答，空白題以 0 分計。` : "所有題目都已作答。", "確認交卷");
  }
});

renderLibrary(false);






