document.querySelectorAll("[data-revoke]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    const prefix = (btn as HTMLElement).dataset.revoke!;
    if (!confirm("Revoke key " + prefix + "?")) return;
    fetch("/api/keys/" + prefix, { method: "DELETE" }).then(function () {
      btn.closest("tr")?.remove();
    });
  });
});
