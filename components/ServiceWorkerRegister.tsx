"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // If an updated SW is found, tell it to take over immediately and
        // reload once, so the user gets the latest code without having to
        // manually clear anything. This fixes "stuck on old behavior".
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // A new version is ready and an old one is currently in control.
              newWorker.postMessage("SKIP_WAITING");
            }
          });
        });

        // Check for updates whenever the app regains focus / comes online.
        const check = () => registration.update().catch(() => {});
        window.addEventListener("online", check);
        window.addEventListener("focus", check);
      })
      .catch(() => {});

    // When the controlling SW changes (new version activated), reload once so
    // the page runs the new code. Guard against reload loops.
    let refreshed = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshed) return;
      refreshed = true;
      window.location.reload();
    });
  }, []);

  return null;
}
