"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReelVideo } from "../lib/landing-data";

export default function CreatorCarousel({ videos }: { videos: ReelVideo[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

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
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, []);

  const toggleVideo = async (index: number) => {
    const selected = videoRefs.current[index];
    if (!selected) return;
    if (!selected.paused) {
      selected.pause();
      return;
    }
    videoRefs.current.forEach((video, videoIndex) => {
      if (videoIndex !== index) video?.pause();
    });
    try {
      await selected.play();
    } catch {
      setPlayingIndex(null);
    }
  };

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    updateControls();
    const resizeObserver = new ResizeObserver(updateControls);
    resizeObserver.observe(rail);
    const videoElements = videoRefs.current.filter((video): video is HTMLVideoElement => video !== null);
    const visibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) (entry.target as HTMLVideoElement).pause();
      });
    }, { threshold: 0.5 });
    videoElements.forEach((video) => visibilityObserver.observe(video));
    const onVisibilityChange = () => {
      if (document.hidden) videoElements.forEach((video) => video.pause());
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      videoElements.forEach((video) => video.pause());
    };
  }, [updateControls]);

  return (
    <div className="tt-carousel">
      <div className="tt-carousel-toolbar">
        <p><span className="tt-rd-reel-count">01 — 06</span> Ideias para testar com o celular</p>
        <div className="tt-carousel-controls" aria-label="Controles do carrossel">
          <button type="button" onClick={() => move(-1)} disabled={!canPrev} aria-label="Ver vídeos anteriores">Anteriores</button>
          <button type="button" onClick={() => move(1)} disabled={!canNext} aria-label="Ver próximos vídeos">Próximos</button>
        </div>
      </div>
      <div
        ref={railRef}
        className="tt-reel-grid"
        role="region"
        aria-roledescription="carrossel"
        aria-label="Exemplos em vídeo de estilos de criação"
        tabIndex={0}
        onScroll={updateControls}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            move(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        {videos.map((media, index) => (
          <article key={media.src} className={`tt-reel-card tt-reel-video${playingIndex === index ? " tt-reel-is-playing" : ""}`} aria-label={`Vídeo ${index + 1} de ${videos.length}: ${media.label}`}>
            <video
              ref={(element) => { videoRefs.current[index] = element; }}
              muted
              loop
              playsInline
              preload="none"
              poster={media.poster}
              aria-hidden="true"
              onPlay={() => setPlayingIndex(index)}
              onPause={() => setPlayingIndex((current) => current === index ? null : current)}
            >
              <source src={media.src} type="video/mp4" />
            </video>
            <span className="tt-reel-live" aria-hidden="true"><i /> EXEMPLO</span>
            <button
              className="tt-rd-video-toggle"
              type="button"
              onClick={() => void toggleVideo(index)}
              aria-label={`${playingIndex === index ? "Pausar" : "Reproduzir"} vídeo: ${media.label}`}
            ><span aria-hidden="true">{playingIndex === index ? "Ⅱ" : "▶"}</span></button>
            <div className="tt-reel-caption">
              <small>0{index + 1} · IDEIA PARA TESTAR</small>
              <strong>{media.label}</strong>
              <span className="tt-rd-reel-tip">{media.tip}</span>
              <span className="tt-reel-account">
                <span className="tt-reel-avatar" aria-hidden="true">{media.creator.charAt(0)}</span>
                <span><b>{media.creator}</b><small>Vídeo de acervo · Pexels</small></span>
              </span>
            </div>
          </article>
        ))}
      </div>
      <p className="tt-carousel-note">Toque para reproduzir · vídeos sem áudio</p>
    </div>
  );
}
