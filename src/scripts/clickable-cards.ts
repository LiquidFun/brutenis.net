function setupClickableCards() {
  for (const card of document.querySelectorAll<HTMLElement>(".clickable-card")) {
    if (card.dataset.clickBound) continue;
    card.dataset.clickBound = "1";
    card.addEventListener("click", (e) => {
      // Don't hijack clicks on links inside the card (tags, external links)
      if ((e.target as HTMLElement).closest("a:not(.card-main-link)")) return;
      const link = card.querySelector<HTMLAnchorElement>("a.card-main-link");
      if (link) link.click();
    });
  }
}

setupClickableCards();
document.addEventListener("astro:after-swap", setupClickableCards);
