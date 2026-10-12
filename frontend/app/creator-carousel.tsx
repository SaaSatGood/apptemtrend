"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReelVideo } from "../lib/landing-data";

export default function CreatorCarousel({ videos }: { videos: ReelVideo[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const isVisibleRef = useRef(false);
  const isHoveredRef = useRef(false);
  const isFocusedRef = useRef(false);
  const manualPauseUntilRef = useRef(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const markInteraction = () => {
    manualPauseUntilRef.current = Date.now() + 7000;
  };

  const updateControls = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setCanPrev(rail.scrollLeft > 8);
    setCanNext(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 8);
  }, []);

  const move = useCallback((direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector<HTMLElement>(".tt-reel-card");
    const gap = Number.parseFloat(window.getComputedStyle(rail).gap) || 0;
    rail.scrollBy({
      left: direction * ((card?.offsetWidth || 260) + gap),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, []);

  useEffect(() => {
    const carousel = carouselRef.current;
    const rail = railRef.current;
    if (!carousel || !rail || isPaused || videos.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

    const visibilityObserver = new IntersectionObserver((entries) => {
      isVisibleRef.current = entries[0]?.isIntersecting ?? false;
    }, { threshold: 0.25 });
    visibilityObserver.observe(rail);
    const timer = window.setInterval(() => {
      if (!isVisibleRef.current || document.hidden || isHoveredRef.current || isFocusedRef.current || Date.now() < manualPauseUntilRef.current) return;
      if (rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 12) {
        rail.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        move(1);
      }
    }, 4800);

    return () => {
      window.clearInterval(timer);
      visibilityObserver.disconnect();
      isVisibleRef.current = false;
    };
  }, [isPaused, move, videos.length]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    updateControls();
    const resizeObserver = new ResizeObserver(updateControls);
    resizeObserver.observe(rail);
    const videoElements = rail.querySelectorAll<HTMLVideoElement>("video");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      return () => resizeObserver.disconnect();
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting && !document.hidden) void video.play().catch(() => {});
        else video.pause();
      });
    }, { threshold: 0.6 });
    videoElements.forEach((video) => observer.observe(video));
    const onVisibilityChange = () => {
      videoElements.forEach((video) => {
        if (document.hidden) {
          video.pause();
          return;
        }
        const bounds = video.getBoundingClientRect();
        const visibleWidth = Math.max(0, Math.min(bounds.right, window.innerWidth) - Math.max(bounds.left, 0));
        const visibleHeight = Math.max(0, Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0));
        if (visibleWidth * visibleHeight >= bounds.width * bounds.height * 0.6) void video.play().catch(() => {});
      });
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      resizeObserver.disconnect();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      videoElements.forEach((video) => video.pause());
    };
  }, [updateControls]);

  return (
    <div
      ref={carouselRef}
      className="tt-carousel"
      onMouseEnter={() => { isHoveredRef.current = window.matchMedia("(hover: hover)").matches; }}
      onMouseLeave={() => { isHoveredRef.current = false; }}
      onFocusCapture={(event) => { isFocusedRef.current = event.target.matches(":focus-visible"); }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) isFocusedRef.current = false;
      }}
    >
      <div className="tt-carousel-toolbar">
        <p>Referências de gravação com celular para adaptar ao seu jeito.</p>
        <div className="tt-carousel-controls" aria-label="Controles do carrossel">
          <button type="button" onClick={() => { markInteraction(); move(-1); }} disabled={!canPrev} aria-label="Ver vídeos anteriores">←</button>
          <button type="button" onClick={() => { markInteraction(); move(1); }} disabled={!canNext} aria-label="Ver próximos vídeos">→</button>
          <button
            className="tt-carousel-toggle"
            type="button"
            onClick={() => setIsPaused((current) => !current)}
            aria-label={isPaused ? "Retomar avanço automático" : "Pausar avanço automático"}
            aria-pressed={isPaused}
          >{isPaused ? "▶" : "Ⅱ"}</button>
        </div>
      </div>
      <div
        ref={railRef}
        className="tt-reel-grid"
        role="region"
        aria-roledescription="carrossel"
        aria-label="Exemplos em vídeo de estilos de criação"
        aria-live="off"
        tabIndex={0}
        onScroll={updateControls}
        onPointerDown={markInteraction}
        onWheel={markInteraction}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            markInteraction();
            move(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        {videos.map((media, index) => (
          <article key={media.src} className="tt-reel-card tt-reel-video" aria-label={`Vídeo ${index + 1} de ${videos.length}: ${media.label}`}>
            <video muted loop playsInline preload="none" poster={media.poster} aria-hidden="true">
              <source src={media.src} type="video/mp4" />
            </video>
            <span className="tt-reel-live" aria-hidden="true"><i /> VÍDEO</span>
            <div className="tt-reel-caption">
              <small>0{index + 1} · INSPIRAÇÃO</small>
              <strong>{media.label}</strong>
              {media.tiktokHandle && media.tiktokUrl ? (
                <a className="tt-reel-account" href={media.tiktokUrl} target="_blank" rel="noopener noreferrer">
                  <span className="tt-reel-avatar" aria-hidden="true">{media.tiktokHandle.replace(/^@/, "").charAt(0).toUpperCase()}</span>
                  <span><b>{media.tiktokHandle.startsWith("@") ? media.tiktokHandle : `@${media.tiktokHandle}`}</b><small>Ver no TikTok ↗</small></span>
                </a>
              ) : (
                <a className="tt-reel-account" href={media.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <span className="tt-reel-avatar" aria-hidden="true">{media.creator.charAt(0)}</span>
                  <span><b>{media.creator}</b><small>Vídeo de acervo · Pexels ↗</small></span>
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
      <p className="tt-carousel-note">{isPaused ? "Avanço automático pausado" : "Avança automaticamente · deslize para explorar"} <span aria-hidden="true">→</span></p>
    </div>
  );
}
