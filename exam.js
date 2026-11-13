const $ = (selector) => document.querySelector(selector);
const letters = "ABCD";
const storageKey = "hsinchu-practice-tcsh-115-math-v1";
const total = questions.length;
const pinDialog = $("#pin-dialog");
const submitDialog = $("#submit-dialog");
const resetDialog = $("#reset-dialog");
let storageAvailable = true;

function freshAttempt() {
  return {
    index: 0, answers: Array(total).fill(null),
    flags: Array(total).fill(false), unlocked: Array(total).fill(false),
    submitted: false
  };
}

function loadAttempt() {
  const initial = freshAttempt();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved || saved.answers?.length !== total) return initial;
    return {
      index: Number.isInteger(saved.index) && saved.index >= 0 && saved.index < total ? saved.index : 0,
      answers: initial.answers.map((_, i) => /^[A-D]$/.test(saved.answers[i]) ? saved.answers[i] : null),
      flags: initial.flags.map((_, i) => saved.flags?.[i] === true),
      unlocked: initial.unlocked.map((_, i) => saved.unlocked?.[i] === true),
      submitted: saved.submitted === true
    };
  } catch {
    return initial;
  }
}

let attempt = loadAttempt();

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(attempt));
  } catch {
    storageAvailable = false;
  }
}

function questionFigure(question) {
  const table = question.number === 3 ? `<table class="bonus-table">
      <caption>業績獎金對照表</caption>
      <thead><tr><th scope="col">業績（萬元）</th><th scope="col">獎金（元）</th></tr></thead>
      <tbody><tr><td>未滿 50</td><td>5000</td></tr><tr><td>50 以上、未滿 75</td><td>14000</td></tr>
      <tr><td>75 以上、未滿 100</td><td>29000</td></tr><tr><td>100 以上</td><td>60000</td></tr></tbody></table>` : "";
  const figure = question.figure
    ? `<figure class="question-figure"><img src="./figures/q${question.number}.webp" alt="${question.figure}"></figure>`
    : "";
  return table + figure;
}

function renderQuestion() {
  const i = attempt.index;
  const question = questions[i];
  const selected = attempt.answers[i];
  const flagged = attempt.flags[i];
  const unlocked = attempt.unlocked[i];
  $("#question").innerHTML = `
    <div class="question-meta">
      <div class="question-number">第 <strong>${question.number}</strong> 題 <span>/ ${total}</span></div>
      <button type="button" class="button flag-button" aria-pressed="${flagged}" id="flag">
        <span aria-hidden="true">${flagged ? "⚑" : "⚐"}</span> ${flagged ? "已標記" : "標記不確定"}
      </button>
    </div>
    <h2 id="question-title" tabindex="-1">${question.prompt}</h2>
    ${questionFigure(question)}
    <fieldset class="choices" aria-labelledby="question-title">
      ${question.choices.map((choice, j) => `<label class="choice">
        <input type="radio" name="answer" value="${letters[j]}" ${selected === letters[j] ? "checked" : ""}>
        <span class="letter">${letters[j]}</span><span>${choice}</span>
      </label>`).join("")}
    </fieldset>
    <div class="question-tools">
      <button class="text-button" type="button" id="show-pin" aria-expanded="${unlocked}">${unlocked ? "已解鎖本題詳解" : "用密碼查看詳解"}</button>
      <button class="text-button" type="button" id="clear-answer" ${selected ? "" : "disabled"}>清除選擇</button>
    </div>
    ${unlocked ? `<div class="explanation" id="unlocked-solution" tabindex="-1">
      <h3>正確答案 ${question.answer}</h3><p>${question.explanation}</p>
    </div>` : ""}`;
}

function renderProgress() {
  const answered = attempt.answers.filter(Boolean).length;
  $("#progress-count").textContent = `${answered} / ${total}`;
  $("#progress").value = answered;
  $("#save-status").textContent = storageAvailable
    ? "作答進度儲存在此瀏覽器" : "瀏覽器無法保存進度，請保持此分頁開啟。";
  $("#flag-count").textContent = `${attempt.flags.filter(Boolean).length} 題標記`;
  const map = $("#question-map");
  if (!map.childElementCount) {
    map.innerHTML = questions.map((q, i) =>
      `<button type="button" data-index="${i}">${q.number}</button>`).join("");
  }
  Array.from(map.children).forEach((button, i) => {
    const answered = Boolean(attempt.answers[i]);
    const flagged = attempt.flags[i];
    button.classList.toggle("answered", answered);
    button.classList.toggle("flagged", flagged);
    if (i === attempt.index) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
    button.setAttribute("aria-label", `第 ${i + 1} 題，${answered ? "已作答" : "未作答"}${flagged ? "，有標記" : ""}`);
  });
}

function moveTo(index) {
  attempt.index = index;
  save();
  render();
  $("#question-title").focus();
}

function renderResults() {
  const wrong = questions.filter((q, i) => attempt.answers[i] !== q.answer);
  const correct = total - wrong.length;
  const blanks = attempt.answers.filter((answer) => !answer).length;
  $("#results").innerHTML = `
    <section class="panel score-panel">
      <div class="score-number"><strong>${correct * 4}</strong><span> / 100 分</span></div>
      <div class="score-copy"><h2 id="score-heading" tabindex="-1">練習結果</h2>
        <p>答對 ${correct} 題 · 答錯 ${wrong.length - blanks} 題 · 未作答 ${blanks} 題</p>
      </div>
      <button class="button" type="button" id="reset">重新作答</button>
    </section>
    <section class="review">
      <h2>${wrong.length ? "錯題與未作答詳解" : "全部答對了"}</h2>
      ${wrong.map((question) => {
        const i = question.number - 1;
        const chosen = attempt.answers[i];
        return `<details class="panel review-item" open>
          <summary>第 ${question.number} 題 <span class="tag">${chosen ? "答錯" : "未作答"}${attempt.flags[i] ? " · 有標記" : ""}</span></summary>
          <div class="review-body">
            <h3>${question.prompt}</h3>
            ${questionFigure(question)}
            <p class="muted">你的答案：${chosen ? `${chosen} · ${question.choices[letters.indexOf(chosen)]}` : "未作答"}</p>
            <div class="explanation"><h3>正確答案 ${question.answer} · ${question.choices[letters.indexOf(question.answer)]}</h3>
              <p>${question.explanation}</p></div>
          </div></details>`;
      }).join("")}
    </section>`;
}

function render() {
  renderProgress();
  $("#workspace").hidden = attempt.submitted;
  $("#results").hidden = !attempt.submitted;
  if (attempt.submitted) {
    renderResults();
    return;
  }
  $("#results").replaceChildren();
  renderQuestion();
  $("#previous").disabled = attempt.index === 0;
  $("#next").textContent = attempt.index === total - 1 ? "交卷並看分數" : "下一題 →";
}

function showSubmit() {
  const blank = attempt.answers.filter((answer) => !answer).length;
  const flagged = attempt.flags.filter(Boolean).length;
  $("#submit-detail").textContent = `${blank ? `還有 ${blank} 題未作答，空白題以 0 分計。` : "所有題目都已作答。"}${flagged ? `另有 ${flagged} 題曾標記，可先返回檢查。` : ""}確認後會顯示分數與詳解。`;
  submitDialog.returnValue = "";
  submitDialog.showModal();
}

$("#question").addEventListener("change", (event) => {
  if (!event.target.matches('input[name="answer"]')) return;
  attempt.answers[attempt.index] = event.target.value;
  save();
  renderProgress();
  $("#clear-answer").disabled = false;
});

$("#question").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const i = attempt.index;
  if (button.id === "flag") {
    attempt.flags[i] = !attempt.flags[i];
    save();
    renderQuestion();
    renderProgress();
    $("#flag").focus();
  }
  if (button.id === "clear-answer") {
    attempt.answers[i] = null;
    save();
    renderQuestion();
    renderProgress();
    $("#question-title").focus();
  }
  if (button.id === "show-pin") {
    if (attempt.unlocked[i]) {
      $("#unlocked-solution").focus();
      return;
    }
    $("#pin-form").reset();
    $("#pin").removeAttribute("aria-invalid");
    $("#pin-error").textContent = "";
    pinDialog.showModal();
  }
});

$("#pin-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if ($("#pin").value.trim() !== "5168") {
    $("#pin").setAttribute("aria-invalid", "true");
    $("#pin-error").textContent = "密碼不正確，請再試一次。";
    $("#pin").focus();
    $("#pin").select();
    return;
  }
  attempt.unlocked[attempt.index] = true;
  save();
  pinDialog.close();
  renderQuestion();
  $("#unlocked-solution").focus();
});

$("[data-close]").addEventListener("click", () => pinDialog.close());
$("#question-map").addEventListener("click", (event) => {
  const button = event.target.closest("[data-index]");
  if (button) moveTo(Number(button.dataset.index));
});
$("#previous").addEventListener("click", () => moveTo(attempt.index - 1));
$("#next").addEventListener("click", () => {
  if (attempt.index === total - 1) showSubmit();
  else moveTo(attempt.index + 1);
});
$("#submit").addEventListener("click", showSubmit);
submitDialog.addEventListener("close", () => {
  if (submitDialog.returnValue !== "confirm") return;
  attempt.submitted = true;
  save();
  render();
  $("#score-heading").focus();
});
$("#results").addEventListener("click", (event) => {
  if (event.target.id !== "reset") return;
  resetDialog.returnValue = "";
  resetDialog.showModal();
});
resetDialog.addEventListener("close", () => {
  if (resetDialog.returnValue !== "confirm") return;
  attempt = freshAttempt();
  moveTo(0);
});

save();
render();

