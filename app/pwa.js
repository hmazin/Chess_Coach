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
    const workers = navigator.serviceWorker;
    const update = document.querySelector("[data-update]");
    let controller = workers.controller;

    update.addEventListener("click", () => location.assign("refresh.html"));
    workers.addEventListener("controllerchange", () => {
      const previous = controller;
      controller = workers.controller;
      if (previous && controller && previous !== controller) location.reload();
    });

    workers.register("sw.js", {updateViaCache: "none"})
      .then(registration => {
        update.hidden = !navigator.onLine;
        let lastCheck = Date.now();
        function checkForUpdate() {
          if (!navigator.onLine || Date.now() - lastCheck < 60_000) return;
          lastCheck = Date.now();
          registration.update().catch(() => {});
        }
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) checkForUpdate();
        });
        window.addEventListener("online", () => {
          update.hidden = false;
          lastCheck = 0;
          checkForUpdate();
        });
        window.addEventListener("offline", () => { update.hidden = true; });
        setInterval(() => {
          if (!document.hidden) checkForUpdate();
        }, 60_000);
        return workers.ready;
      })
      .then(() => { status.textContent = "Ready offline"; })
      .catch(error => console.warn("Offline setup could not finish:", error));
  }
})();
