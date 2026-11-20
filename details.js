// Details sheet for a single movie, shown in the native <dialog id="details">.

const dialog = document.getElementById("details");
const body = dialog.querySelector(".details-body");

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  node.append(...children.filter((c) => c != null && c !== ""));
  return node;
}

export function openDetails(movie) {
  if (!movie) return;
  const img = el("img", {
    class: "details-cover", src: movie.cover, alt: `Cover of ${movie.title}`,
    width: movie.coverWidth || 100, height: movie.coverHeight || 140,
  });
  img.addEventListener("error", () => img.remove(), { once: true });

  const meta = [
    movie.director,
    movie.rating != null ? `★ ${movie.rating}` : null,
  ].filter(Boolean).join(" · ");

  body.replaceChildren(...[
    img,
    el("div", { class: "details-info" },
      el("h2", { id: "details-title" }, movie.title),
      meta ? el("p", { class: "details-meta" }, meta) : null,
      movie.formats.length
        ? el("p", { class: "badges" }, ...movie.formats.map((f) => el("span", { class: "badge" }, f)))
        : null,
      el("p", { class: "details-owned" }, "✓ In your library")),
    movie.description ? el("p", { class: "details-description" }, movie.description) : null,
    movie.asin
      ? el("a", {
        class: "details-amazon", href: `https://www.amazon.com/dp/${encodeURIComponent(movie.asin)}`,
        target: "_blank", rel: "noopener",
      }, "View on Amazon")
      : null,
  ].filter(Boolean));

  if (!dialog.open) {
    dialog.showModal();
    history.pushState({ details: true }, "");
  }
  body.scrollTop = 0;
}

// Close via the back gesture/button: the pushed history entry is popped.
addEventListener("popstate", () => {
  if (dialog.open) dialog.close();
});

// Any other way of closing (button, Escape, backdrop) drops our history entry.
dialog.addEventListener("close", () => {
  if (history.state?.details) history.back();
});

dialog.querySelector(".details-close").addEventListener("click", () => dialog.close());

// Tap on the backdrop (outside the sheet) closes it.
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close();
});
