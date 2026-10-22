// Runs before the page draws: light (UF Proton) by default, dark only if chosen on this computer.
try {
  document.documentElement.dataset.theme = localStorage.getItem("qa-portal-theme") === "dark" ? "dark" : "light";
} catch {
  document.documentElement.dataset.theme = "light";
}
