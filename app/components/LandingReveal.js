"use client";

import { useEffect } from "react";

export default function LandingReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

    const sections = document.querySelectorAll(".landing-reveal");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove("is-pending");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });

    for (const section of sections) {
      if (section.getBoundingClientRect().top > window.innerHeight * 0.9) {
        section.classList.add("is-pending");
        observer.observe(section);
      }
    }

    return () => {
      observer.disconnect();
      for (const section of sections) section.classList.remove("is-pending");
    };
  }, []);

  return null;
}
