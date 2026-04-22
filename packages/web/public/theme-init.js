(() => {
  var t;
  try {
    t = localStorage.getItem("jinn-theme") || "dark";
    if (t === "system") {
      t = window.matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", t);
  } catch (_e) {}
})();
