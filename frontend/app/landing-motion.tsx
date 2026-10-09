"use client";

import { useEffect } from "react";

export default function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector(".tt-home");
    if (!root) return;
    const header = root.querySelector(".tt-header");
    const updateHeader = () => header?.classList.toggle("tt-scrolled", window.scrollY > 48);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      return () => window.removeEventListener("scroll", updateHeader);
    }

    const targets = root.querySelectorAll<HTMLElement>(
      ".tt-section h2, .tt-dark-section h2, .tt-story, .tt-kit-piece, .tt-kit-breakdown-cta, .tt-feature-main, .tt-feature-small, .tt-audience-grid article, .tt-product-grid article, .tt-reel-grid article, .tt-number-grid article, .tt-steps-list article, .tt-final-card",
    );
    targets.forEach((target) => target.setAttribute("data-motion", ""));
    root.classList.add("tt-motion-ready");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("tt-in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px 60px 0px" },
    );
    targets.forEach((target) => observer.observe(target));

    return () => {
      window.removeEventListener("scroll", updateHeader);
      observer.disconnect();
      root.classList.remove("tt-motion-ready");
      targets.forEach((target) => target.removeAttribute("data-motion"));
    };
  }, []);

  return null;
}
