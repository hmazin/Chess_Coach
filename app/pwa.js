(() => {
  if (location.protocol === "file:") return;

  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = "manifest.webmanifest";
  document.head.append(manifest);

  const status = document.querySelector("[data-offline-status]");
  const install = document.querySelector("[data-install]");
  status.textContent = "Online practice";

  let prompt;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    prompt = event;
    install.hidden = false;
  });

  install.addEventListener("click", () => {
    const availablePrompt = prompt;
    prompt = null;
    install.hidden = true;
    availablePrompt?.prompt().catch(() => {});
  });

  window.addEventListener("appinstalled", () => {
    prompt = null;
    install.hidden = true;
  });

  if ("serviceWorker" in navigator && isSecureContext) {
    navigator.serviceWorker.register("sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then(() => { status.textContent = "Ready offline"; })
      .catch(error => console.warn("Offline setup could not finish:", error));
  }
})();
