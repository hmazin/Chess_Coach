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
    let registration;
    let controller = workers.controller;
    let reloadRequested = false;
    let newerController = false;

    function showUpdate() {
      update.hidden = !newerController && !registration?.waiting;
      update.textContent = newerController ? "Reload app" : "Update app";
    }

    update.addEventListener("click", () => {
      if (newerController) {
        location.reload();
      } else if (registration?.waiting) {
        reloadRequested = true;
        registration.waiting.postMessage({type: "ACTIVATE_UPDATE"});
      }
    });

    workers.addEventListener("controllerchange", () => {
      const previous = controller;
      controller = workers.controller;
      if (!previous || !controller || previous === controller) return;
      newerController = true;
      if (reloadRequested) location.reload();
      else showUpdate();
    });

    workers.register("sw.js", {updateViaCache: "none"})
      .then(link => {
        registration = link;
        registration.addEventListener("updatefound", () => {
          registration.installing?.addEventListener("statechange", showUpdate);
        });
        showUpdate();

        let lastCheck = Date.now();
        function checkForUpdate() {
          if (!navigator.onLine || Date.now() - lastCheck < 60_000) return;
          lastCheck = Date.now();
          registration.update().catch(() => {});
        }
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) checkForUpdate();
        });
        window.addEventListener("online", checkForUpdate);
        return workers.ready;
      })
      .then(() => { status.textContent = "Ready offline"; })
      .catch(error => console.warn("Offline setup could not finish:", error));
  }
})();
