document.documentElement.classList.add("js");

const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector("#site-nav");

if (navToggle && nav) {
  const setNav = (open) => {
    nav.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
  };

  navToggle.addEventListener("click", () => {
    setNav(navToggle.getAttribute("aria-expanded") !== "true");
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) setNav(false);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) setNav(false);
  });
}

const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxCaption = document.querySelector("#lightbox-caption");

if (lightbox && lightboxImage && lightboxCaption) {
  document.querySelectorAll("[data-lightbox]").forEach((button) => {
    button.addEventListener("click", () => {
      const figure = button.closest("figure");
      const image = button.querySelector("img");
      const title = figure?.querySelector("figcaption strong")?.textContent;
      const note = figure?.querySelector("figcaption span")?.textContent;
      if (!image) return;

      lightboxImage.src = image.currentSrc || image.src;
      lightboxImage.alt = image.alt;
      lightboxCaption.textContent = [title, note].filter(Boolean).join(" · ");
      lightbox.showModal();
    });
  });

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });
}

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const container = button.closest(".code-card, .markdown-sample");
    const code = container?.querySelector("pre code");
    if (!code) return;

    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(code.textContent);
      button.textContent = "已复制";
    } catch {
      button.textContent = "复制失败";
    }
    setTimeout(() => {
      button.textContent = original;
    }, 1600);
  });
});

const reveals = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window && reveals.length > 0) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -36px 0px", threshold: 0.08 },
  );

  reveals.forEach((element) => observer.observe(element));
} else {
  reveals.forEach((element) => element.classList.add("is-visible"));
}
