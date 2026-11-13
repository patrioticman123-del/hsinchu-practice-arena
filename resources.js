function link(href, label, primary = false) {
  const anchor = document.createElement("a");
  const url = new URL(href);
  if (url.protocol !== "https:") throw new Error("Official links must use HTTPS");
  anchor.href = url.href;
  anchor.target = "_blank";
  anchor.rel = "noopener";
  anchor.className = primary ? "button primary" : "button";
  anchor.textContent = label;
  return anchor;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

const schoolList = document.querySelector("#school-list");
for (const type of ["公立資優鑑定", "私中國中部"]) {
  const title = element("h3", type, "group-title");
  const grid = element("div", "", "school-grid");
  resources.schools.filter((row) => row[0] === type).forEach(([, name, subjects, current, tip, url]) => {
    const card = element("article", "", "panel school-card");
    card.append(
      element("h4", name),
      element("p", subjects),
      element("p", current, "muted"),
      element("p", tip, "school-tip"),
      link(url, "查看官方資訊 ↗")
    );
    grid.append(card);
  });
  schoolList.append(title, grid);
}

const priority = document.querySelector("#priority");
const reserve = document.querySelector("#reserve");
const papersList = document.querySelector("#papers-list");

function renderPapers(showPriority) {
  priority.setAttribute("aria-pressed", String(showPriority));
  reserve.setAttribute("aria-pressed", String(!showPriority));
  const rows = showPriority ? resources.priority.map((row) => row.slice(1)) : resources.reserve;
  papersList.replaceChildren();
  rows.forEach(([year, school, subject, content, note, file, fallback]) => {
    const row = element("article", "", "paper-row");
    const title = element("div", "", "paper-name");
    title.append(element("span", year + " 學年度", "paper-year"), element("h3", subject), element("p", school, "muted"));
    const description = element("div", "", "paper-description");
    description.append(element("span", content, "tag"), element("p", note, "muted"));
    const actions = element("div", "", "paper-actions");
    const isPortal = content.includes("入口");
    const direct = file.replace(/https:\/\/drive\.google\.com\/file\/d\/([^/]+)\/view.*/, "https://drive.google.com/uc?export=download&id=$1");
    const label = isPortal ? "開啟官方題庫 ↗" : content.includes("解答") && !content.includes("試題") || content.includes("答案") ? "下載解答 ↗" : "下載考卷 ↗";
    actions.append(link(direct, label, true));
    if (fallback && fallback !== file) actions.append(link(fallback, "官方題庫 ↗"));
    else if (direct !== file) actions.append(link(file, "開啟檔案 ↗"));
    row.append(title, description, actions);
    papersList.append(row);
  });
}

priority.addEventListener("click", () => renderPapers(true));
reserve.addEventListener("click", () => renderPapers(false));
renderPapers(true);
