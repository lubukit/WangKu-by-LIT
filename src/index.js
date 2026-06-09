import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

// Register Service Worker for PWA (Add to Home Screen + Offline)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const publicUrl = process.env.PUBLIC_URL || ".";
    const swUrl = `${publicUrl.replace(/\/$/, "")}/sw.js`;
    navigator.serviceWorker
      .register(swUrl)
      .catch(() => {});
  });
}
