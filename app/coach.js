(() => {
  const root = document.getElementById("chess-coach");
  const panel = root.querySelector("[data-ai-coach]");
  const positionLabel = panel.querySelector("[data-ai-position]");
  const status = panel.querySelector("[data-ai-status]");
  const unlockForm = panel.querySelector("[data-ai-unlock]");
  const code = panel.querySelector("[data-ai-code]");
  const chat = panel.querySelector("[data-ai-chat]");
  const log = panel.querySelector("[data-ai-turns]");
  const form = panel.querySelector("[data-ai-form]");
  const question = panel.querySelector("[data-ai-question]");
  const send = panel.querySelector("[data-ai-send]");
  const why = panel.querySelector("[data-ai-why]");
  let position;
  let turns = [];
  let pending;
  let unlocked = false;

  async function call(body, signal) {
    const response = await fetch("/api/coach", body ? {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body),
      signal,
    } : {cache: "no-store"});
    const payload = await response.json();
    return {ok: response.ok, status: response.status, payload};
  }

  function showAccess(state) {
    unlocked = state;
    unlockForm.hidden = state;
    chat.hidden = !state;
  }

  function addMessage(role, text, checked = []) {
    const message = document.createElement("article");
    message.className = "ai-message";
    const label = document.createElement("strong");
    label.textContent = role === "user" ? "You" : "Coach";
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    message.append(label, paragraph);
    if (checked.length) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Stockfish examples";
      details.append(summary);
      for (const line of checked) {
        const example = document.createElement("p");
        example.textContent = line;
        details.append(example);
      }
      message.append(details);
    }
    log.append(message);
    if (log.children.length > 12) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  }

  root.addEventListener("coach-position", ({detail}) => {
    if (position?.history !== detail.history || position?.side !== detail.side) {
      pending?.abort();
      pending = null;
      send.disabled = false;
      turns = [];
      log.replaceChildren();
      question.value = "";
      if (unlocked) status.textContent = "";
    }
    position = detail;
    positionLabel.textContent = detail.history;
    why.hidden = !detail.attempted;
  });

  root.addEventListener("coach-question", ({detail}) => {
    panel.open = true;
    question.value = detail;
    panel.scrollIntoView({block: "nearest"});
    if (unlocked) form.requestSubmit();
  });

  async function checkAccess() {
    if (location.protocol === "file:" || !navigator.onLine) {
      status.textContent = "Open the hosted Chess Coach app while connected to ask a question.";
      return;
    }
    try {
      const result = await call();
      if (!result.ok) {
        status.textContent = result.payload.error ?? "The coach is temporarily unavailable.";
        return;
      }
      status.textContent = "";
      showAccess(result.payload.unlocked);
    } catch {
      status.textContent = "Couldn’t connect to the coach. Try again while online.";
    }
  }

  panel.addEventListener("toggle", () => {
    if (panel.open) checkAccess();
  });
  window.addEventListener("online", () => {
    if (panel.open) checkAccess();
  });

  unlockForm.addEventListener("submit", async event => {
    event.preventDefault();
    const button = unlockForm.querySelector("button");
    button.disabled = true;
    status.textContent = "Checking your access code…";
    try {
      const result = await call({action: "unlock", code: code.value});
      if (!result.ok) {
        status.textContent = result.payload.error ?? "Couldn’t unlock the coach.";
        return;
      }
      status.textContent = "";
      showAccess(true);
      question.focus();
    } catch {
      status.textContent = "Couldn’t unlock the coach. Try again while connected.";
    } finally {
      code.value = "";
      button.disabled = false;
    }
  });

  why.addEventListener("click", () => {
    question.value = "Why might my last move be weaker here? Show what my opponent can do.";
    question.focus();
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const message = question.value.trim();
    if (!message || !position || pending) return;
    const request = new AbortController();
    pending = request;
    send.disabled = true;
    status.textContent = "The coach is checking the position…";
    try {
      const result = await call({...position, question: message, turns}, request.signal);
      if (pending !== request) return;
      if (!result.ok) {
        status.textContent = result.payload.error ?? "The coach couldn’t answer.";
        if (result.status === 401) showAccess(false);
        return;
      }
      turns.push({role: "user", content: message}, {role: "assistant", content: result.payload.text});
      turns = turns.slice(-6);
      addMessage("user", message);
      addMessage("assistant", result.payload.text, result.payload.checked);
      question.value = "";
      status.textContent = "";
    } catch {
      if (pending === request) status.textContent = "Couldn’t reach the coach. Try again while online.";
    } finally {
      if (pending === request) {
        pending = null;
        send.disabled = false;
      }
    }
  });
})();
