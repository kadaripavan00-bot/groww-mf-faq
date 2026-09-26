import type { AskResponse } from "@groww-mf-faq/shared";
import { DISCLAIMER } from "@groww-mf-faq/shared";
import { postAsk, postFeedback } from "./lib/api.js";
import { embedQuery } from "./lib/vec.js";

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const input = $("q") as HTMLInputElement;
const out = $("answer");
const statusEl = $("search-status");
const countEl = $("corpus-count");

function setStatus(t: string) {
  statusEl.textContent = t;
}

function renderAnswer(r: AskResponse) {
  out.innerHTML = "";
  const p = document.createElement("p");
  p.className = "answer-text";
  p.textContent = r.answer;
  out.appendChild(p);
  if (r.list && r.list.length) {
    const ul = document.createElement("ul");
    ul.className = "fund-list";
    for (const f of r.list) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = f.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = f.name;
      li.appendChild(a);
      ul.appendChild(li);
    }
    out.appendChild(ul);
  }
  const meta = document.createElement("div");
  meta.className = "answer-meta";
  const a = document.createElement("a");
  a.href = r.source.url;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = "Source: " + r.source.title;
  const upd = document.createElement("div");
  upd.className = "updated";
  upd.textContent = "Last updated from sources: " + r.last_updated_from_sources;
  meta.appendChild(a);
  out.appendChild(meta);
  out.appendChild(upd);
  const fb = document.createElement("div");
  fb.className = "feedback";
  const yes = document.createElement("button");
  yes.textContent = "Helpful";
  const no = document.createElement("button");
  no.textContent = "Not helpful";
  yes.onclick = () => { void postFeedback(null, true); fb.textContent = "Thanks!"; };
  no.onclick = () => { void postFeedback(null, false); fb.textContent = "Thanks!"; };
  fb.appendChild(yes);
  fb.appendChild(no);
  out.appendChild(fb);
}

async function ask(query: string) {
  setStatus("Searching…");
  let vector: number[] | undefined;
  try {
    setStatus("Semantic search loading (one-time ~25MB download)…");
    vector = (await embedQuery(query)) ?? undefined;
  } catch {
    vector = undefined;
  } finally {
    setStatus("");
  }
  try {
    renderAnswer(await postAsk(query, vector));
  } catch {
    out.innerHTML = "<p>Couldn't reach the server. Please retry in a moment.</p>";
  }
}

async function boot() {
  countEl.textContent = "Facts-only. No investment advice.";
  document.querySelectorAll("[data-example]").forEach((btn) => {
    btn.addEventListener("click", () => {
      input.value = btn.getAttribute("data-example") || "";
      void ask(input.value);
    });
  });
  ($("ask-form") as HTMLFormElement).addEventListener("submit", (e) => {
    e.preventDefault();
    void ask(input.value);
  });
  // Popular + all FAQs need curated facts: derive from sources endpoint? No -
  // the ask API is the contract; FAQ sections are rendered from a tiny static
  // bundle generated at build time (see scripts/build_faq_bundle.py).
  try {
    const bundle = await (await fetch("./faqs.json")).json();
    renderSections(bundle.faqs || []);
    const total = bundle.meta?.funds_indexed ? ` Corpus: ${bundle.meta.funds_indexed} funds indexed.` : "";
    countEl.textContent = `Facts-only. No investment advice.${total}`;
  } catch {
    /* FAQ sections are progressive enhancement; ask box works regardless */
  }
  const detail = $("corpus-detail");
  if (detail) detail.textContent += " " + DISCLAIMER;
}

function renderSections(faqs: Array<{ question: string; answer: string; source_title: string; source_url: string; is_popular: boolean }>) {
  const popular = $("popular-faqs");
  const all = $("all-faqs");
  for (const f of faqs.filter((x) => x.is_popular)) {
    const btn = document.createElement("button");
    btn.className = "faq-chip";
    btn.textContent = f.question;
    btn.onclick = () => {
      input.value = f.question;
      void ask(f.question);
      out.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    popular.appendChild(btn);
  }
  for (const f of faqs) {
    const d = document.createElement("details");
    d.className = "faq-item";
    const s = document.createElement("summary");
    s.textContent = f.question;
    const p = document.createElement("p");
    p.textContent = f.answer;
    const meta = document.createElement("div");
    meta.className = "answer-meta";
    const a = document.createElement("a");
    a.href = f.source_url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Source: " + f.source_title;
    meta.appendChild(a);
    d.appendChild(s);
    d.appendChild(p);
    d.appendChild(meta);
    all.appendChild(d);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  boot().catch(() => {
    out.innerHTML = "<p>Couldn't load. Hard-refresh (Ctrl+F5) once.</p>";
  });
});
