import { useRef, useEffect } from "react";
import { useScroll, type MotionValue } from "framer-motion";
import avatarFullstack from "@/assets/badge-fullstack.png";
import avatarLaweb from "@/assets/badge-laweb.png";
import avatarBullet from "@/assets/badge-bullet.png";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Interface mantida para compatibilidade — a seção rastreia
 * seu próprio scroll via useScroll({ target: sectionRef }).
 */
interface HeroSectionProps {
  scrollYProgress?: MotionValue<number>;
}

// ── Constantes da animação ────────────────────────────────────────────────
// SIZE_MAX_PX e computeSlideOffset eram hardcoded aqui.
// Agora são calculados dinamicamente por frame em frame() via dynMax / dynSlide,
// preservando 920 / vw*0.22 em desktop (≥768px) e usando valores responsivos
// no mobile — sem qualquer mudança visual no desktop.

const ANIM = {
  sizeMin:   8,
  // sizeMax removido daqui — substituído por dynMax calculado por frame
  borderMin: 5,
  borderMax: 6,
  colorA: [0, 255, 110] as const,
  colorB: [0, 200,  70] as const,
  P1_END:    0.45,
  P2_END:    0.52,
  P3_END:    0.78,
  LERP:      0.08,
} as const;

const lp    = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const remap = (v: number, a: number, b: number, c: number, d: number) =>
  c + (d - c) * clamp((v - a) / (b - a), 0, 1);

// Wrapper que segura o círculo+imagem e aplica o slide horizontal (fase 4).
const stageStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%) translateZ(0)",
  willChange: "transform",
  pointerEvents: "none",
  zIndex: 2,
};

// Círculo: cresce em width/height. A imagem dentro preenche 100%.
// Tamanho inicial fixo em 8px — igual em todos os viewports.
const portalBaseStyle: React.CSSProperties = {
  position: "relative",
  borderRadius: "50%",
  overflow: "hidden",
  background: "#000",
  outline: "5px solid rgba(0,255,110,1)",
  outlineOffset: "0",
  width: `${ANIM.sizeMin}px`,
  height: `${ANIM.sizeMin}px`,
  willChange: "width, height, outline-color, box-shadow",
};

// A imagem interna permanece em 920px em todos os breakpoints —
// está contida pelo overflow:hidden do círculo, garantindo qualidade
// máxima mesmo quando o círculo é menor no mobile.
const portalImgStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "50%",
  width: "920px",
  height: "920px",
  transform: "translate(-50%, -50%)",
  objectFit: "cover",
  display: "block",
  userSelect: "none",
  pointerEvents: "none",
};

/**
 * HeroSection — Animação Portal Reveal
 *
 * Fase 1 (0→45%):  círculo cresce do centro até dynMax.
 * Fase 2 (45→52%): hold + pulso do anel verde.
 * Fase 3 (52→78%): círculo permanece em dynMax, anel visível.
 * Fase 4 (78→100%): círculo desliza para a direita por dynSlide px,
 *                   painel de texto aparece à esquerda.
 *
 * Desktop (≥768px): dynMax=920px, dynSlide=vw×0.22 — idêntico ao original.
 * Mobile  (<768px): dynMax=vw×0.85, dynSlide=vw×0.54 — portal adaptado.
 */
export const HeroSection = ({ scrollYProgress: _ignored }: HeroSectionProps) => {
  const sectionRef   = useRef<HTMLElement>(null);
  const stageRef     = useRef<HTMLDivElement>(null);
  const portalRef    = useRef<HTMLDivElement>(null);
  const panelRef     = useRef<HTMLDivElement>(null);
  const stripRef     = useRef<HTMLDivElement>(null);
  const rafRef       = useRef<number>(0);

  // Used only for panel layout styles — does not touch the rAF loop.
  const isMobile = useIsMobile();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  useEffect(() => {
    const stage     = stageRef.current;
    const portal    = portalRef.current;
    const panel     = panelRef.current;
    const strip     = stripRef.current;
    const section   = sectionRef.current;
    if (!stage || !portal || !panel || !section) return;

    // Phase 2 — pause the rAF loop when the section is not in the viewport.
    // Zero visual impact (lerp snaps to target on resume because raw scroll
    // value is read fresh each frame).
    let visible = true;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const wasVisible = visible;
          visible = entry.isIntersecting;
          if (visible && !wasVisible) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(frame);
          } else if (!visible && wasVisible) {
            cancelAnimationFrame(rafRef.current);
          }
        }
      },
      { rootMargin: "200px 0px" }
    );
    io.observe(section);

    let cSize: number  = ANIM.sizeMin;
    let cAlpha: number = 1;
    let cSlide: number = 0;
    let cRise: number  = 0;

    function frame() {
      const raw = scrollYProgress.get();

      // ── Responsive values — read viewport each frame ──────────────────
      // Desktop (vw ≥ 768): dynMax=920, dynSlide=vw×0.22, dynRise=0.
      //   → byte-identical to the original code path. Zero visual change.
      // Mobile  (vw < 768): dynMax=vw×1.55 (portal opens as a large background),
      //                     dynSlide=0 (NO horizontal motion),
      //                     dynRise moves the whole ring fully above the viewport
      //                     in phase 4, while a mobile image layer remains visible.
      const vw       = window.innerWidth;
      const vh       = window.innerHeight;
      const isMob    = vw < 768;
      const dynMax   = isMob ? Math.round(vw * 1.55) : 920;
      const dynSlide = isMob ? 0 : Math.round(vw * 0.22);
      // Mobile: in phase 4 the portal rises so the image sits at the top of
      // the viewport (face/torso visible), with the panel content below.
      // Desktop: no rise — preserves original behaviour.
      const dynRise  = isMob ? -Math.round(vh * 0.22) : 0;
      // ─────────────────────────────────────────────────────────────────

      // Mobile: chega mais rápido ao estado final e mantém por mais tempo.
      // Desktop: usa as constantes ANIM originais — zero mudança visual.
      const P1 = isMob ? 0.22 : ANIM.P1_END;
      const P2 = isMob ? 0.30 : ANIM.P2_END;
      const P3 = isMob ? 0.42 : ANIM.P3_END;
      const P4_END = isMob ? 0.58 : 1;

      let tSize: number, tAlpha: number, tSlide: number, tRise: number;

      if (raw <= P1) {
        tSize  = lp(ANIM.sizeMin, dynMax, raw / P1);
        tAlpha = 1;
        tSlide = 0;
        tRise  = 0;
      } else if (raw <= P2) {
        tSize  = dynMax;
        tAlpha = 1;
        tSlide = 0;
        tRise  = 0;
      } else if (raw <= P3) {
        tSize  = dynMax;
        tAlpha = 1;
        tSlide = 0;
        tRise  = 0;
      } else {
        // Fase 4: desktop desliza horizontal (dynSlide); mobile só fade do ring.
        tSize  = dynMax;
        tAlpha = isMob ? 0 : 1;
        const t4 = clamp((raw - P3) / (P4_END - P3), 0, 1);
        tSlide = lp(0, dynSlide, t4);
        tRise  = lp(0, dynRise,  t4);
      }

      cSize  = lp(cSize,  tSize,  ANIM.LERP);
      cAlpha = lp(cAlpha, tAlpha, ANIM.LERP * 1.5);
      cSlide = lp(cSlide, tSlide, ANIM.LERP * 0.85);
      cRise  = lp(cRise,  tRise,  ANIM.LERP * 0.85);

      if (Math.abs(cSize  - tSize)  < 1)     cSize  = tSize;
      if (Math.abs(cAlpha - tAlpha) < 0.004) cAlpha = tAlpha;
      if (Math.abs(cSlide - tSlide) < 0.5)   cSlide = tSlide;
      if (Math.abs(cRise  - tRise)  < 0.5)   cRise  = tRise;

      const sz = Math.round(cSize / 2) * 2;

      // bw and p now use dynMax as denominator so the green ring colour/glow
      // saturate correctly relative to the responsive circle size.
      const bw = Math.round(lp(ANIM.borderMin, ANIM.borderMax,
                               clamp(sz / dynMax, 0, 1)));
      const p  = clamp(sz / dynMax, 0, 1);
      const gr = Math.round(lp(ANIM.colorA[1], ANIM.colorB[1], p));
      const gb = Math.round(lp(ANIM.colorA[2], ANIM.colorB[2], p));

      portal.style.width        = `${sz}px`;
      portal.style.height       = `${sz}px`;
      portal.style.outlineWidth = `${bw}px`;
      portal.style.outlineColor = `rgba(0,${gr},${gb},${cAlpha.toFixed(3)})`;

      const g1 = Math.max(8, Math.round(sz * 0.06));
      const g2 = Math.max(20, Math.round(sz * 0.16));
      portal.style.boxShadow =
        `0 0 ${g1}px ${Math.round(g1 * 0.35)}px rgba(0,${gr},${gb},${(p * 0.7 * cAlpha).toFixed(2)}),` +
        `0 0 ${g2}px ${Math.round(g2 * 0.4)}px rgba(0,${gr},${gb},${(p * 0.28 * cAlpha).toFixed(2)})`;

      stage.style.transform =
        `translate(-50%, -50%) translate3d(${Math.round(cSlide)}px, ${Math.round(cRise)}px, 0)`;

      // Mobile: delay panel fade-in until the portal has finished rising
      // (phase 4 nearly complete) so text never overlaps the image.
      // Desktop: original timing — zero visual change.
      const fadeIn = isMob
        ? clamp(remap(raw, 0.55, 0.66, 0, 1), 0, 1).toFixed(3)
        : clamp(remap(raw, ANIM.P3_END - 0.08, ANIM.P3_END + 0.04, 0, 1), 0, 1).toFixed(3);
      panel.style.opacity = fadeIn;
      if (strip) strip.style.opacity = fadeIn;

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafRef.current);
      io.disconnect();
    };
  }, [scrollYProgress]);

  return (
    <section
      ref={sectionRef}
      aria-label="Hero principal — Portal Reveal"
      className="relative z-40 bg-background text-foreground"
      style={{ height: "350vh" }}
    >
      <div
        className="sticky top-0 h-screen w-full overflow-hidden z-40"
        style={{ minHeight: "100svh" }}
      >
        {/* ── Stage: wrapper centralizado que aplica o slide na fase 4 ── */}
        <div ref={stageRef} style={stageStyle}>
          <div ref={portalRef} style={portalBaseStyle}>
            <img
              src="/images/portal-hero.webp"
              srcSet="/images/portal-hero-mobile.webp 960w, /images/portal-hero.webp 1920w"
              sizes="(max-width: 768px) 100vw, 100vw"
              alt="Diego Gomes Borges — Portfólio"
              draggable={false}
              fetchPriority="high"
              decoding="async"
              style={isMobile
                ? {
                    position: "absolute",
                    left: 0, top: 0,
                    width: "100%", height: "100%",
                    objectFit: "cover",
                objectPosition: "center 42%",
                    display: "block",
                    userSelect: "none",
                    pointerEvents: "none",
                  }
                : portalImgStyle}
            />
            {/* Mobile-only fade: integra a base do portal com o conteúdo abaixo */}
            {isMobile && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0, right: 0, bottom: 0,
                  height: "55%",
                  background:
                    "linear-gradient(to bottom, rgba(8,9,10,0) 0%, rgba(8,9,10,0.35) 40%, rgba(8,9,10,0.85) 75%, #08090a 100%)",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
        </div>

        {/* ── Painel de texto (fase 4) ──
            Desktop: width 55%, lateral, sem background — idêntico ao original.
            Mobile:  coluna centralizada na metade inferior, abaixo do portal,
                     sem sobreposição lateral. */}
        <div
          ref={panelRef}
          style={{
            position: "absolute",
            left: 0,
            top: isMobile ? "45%" : 0,
            width: isMobile ? "100%" : "55%",
            height: isMobile ? "55%" : "100%",
            display: "flex", flexDirection: "column",
            justifyContent: isMobile ? "flex-start" : "center",
            alignItems: isMobile ? "center" : "stretch",
            textAlign: isMobile ? "center" : "left",
            gap: isMobile ? "0.7rem" : "1.4rem",
            padding: isMobile
              ? "0.75rem 1rem 1.25rem"
              : "0 0 4rem clamp(2rem, 6vw, 6rem)",
            background: "none",
            opacity: 0, pointerEvents: "auto",
            zIndex: 3,
          }}
        >
          {/* Logo */}
          <div style={{
            display: "flex", alignItems: "center", gap: "0.85rem",
            justifyContent: isMobile ? "center" : "flex-start",
          }}>
            <div style={{
              width: isMobile ? 44 : 56,
              height: isMobile ? 44 : 56,
              borderRadius: "50%",
              border: "2.5px solid hsl(148 100% 50%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.4)",
              boxShadow: "0 0 14px rgba(0,255,110,0.35)",
              flexShrink: 0,
            }}>
              <svg
                width={isMobile ? 22 : 30}
                height={isMobile ? 22 : 30}
                viewBox="0 0 512 512"
                fill="none"
                stroke="hsl(148 100% 50%)"
                strokeWidth={18}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeMiterlimit={10}
                aria-hidden="true"
              >
                <line x1="395.938" y1="181.905" x2="395.938" y2="108.84"/>
                <line x1="436.344" y1="181.905" x2="436.344" y2="108.84"/>
                <polyline points="442.38,189.33 466.65,189.33 504.5,227.18 504.5,248.89"/>
                <polyline points="504.5,283.89 504.5,308.45 453.99,308.45 453.99,278.14 474.2,278.14 474.2,239.73 454.1,219.63 442.38,219.63"/>
                <polyline points="389.907,219.634 378.189,219.634 358.097,239.726 358.097,278.143 378.3,278.143 378.3,308.448 327.792,308.448 327.792,227.18 365.633,189.329 389.907,189.329"/>
                <line x1="103.465" y1="334.399" x2="103.465" y2="250.05"/>
                <line x1="133.77" y1="334.399" x2="133.77" y2="250.05"/>
                <line x1="164.075" y1="349.319" x2="164.075" y2="231.443"/>
                <line x1="73.16" y1="282.16" x2="73.16" y2="231.44"/>
                <line x1="73.16" y1="349.32" x2="73.16" y2="317.16"/>
                <line x1="245.646" y1="128.598" x2="179.106" y2="195.148"/>
                <line x1="181.369" y1="64.322" x2="114.82" y2="130.861"/>
                <line x1="189.642" y1="98.9" x2="149.398" y2="139.134"/>
                <line x1="211.068" y1="120.325" x2="170.833" y2="160.56"/>
                <circle cx="118.618" cy="403.484" r="20.203"/>
                <path d="M209.533,504.5H27.703v-16.163c0-7.811,6.332-14.142,14.142-14.142H195.39c7.811,0,14.142,6.332,14.142,14.142V504.5z"/>
                <line x1="320.81" y1="98.41" x2="294.36" y2="98.41"/>
                <line x1="382.26" y1="98.41" x2="355.81" y2="98.41"/>
                <line x1="382.26" y1="37.805" x2="294.356" y2="37.805"/>
                <line x1="27.703" y1="504.5" x2="7.5" y2="504.5"/>
                <line x1="209.533" y1="504.5" x2="229.736" y2="504.5"/>
                <path d="M189.329,474.195v-70.711c0-39.053-31.659-70.711-70.711-70.711s-70.711,31.659-70.711,70.711v70.711"/>
                <circle cx="416.145" cy="68.11" r="45.457"/>
                <circle cx="416.145" cy="204.482" r="30.305"/>
                <circle cx="416.145" cy="68.11" r="15.152"/>
                <circle cx="118.618" cy="191.35" r="60.61"/>
                <circle cx="118.618" cy="191.35" r="20.203"/>
                <circle cx="241.858" cy="68.11" r="60.61"/>
                <circle cx="241.858" cy="68.11" r="20.203"/>
              </svg>
            </div>
            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 800,
              // Mobile: clamp menor e vw-based para caber no painel estreito.
              // Desktop: clamp original intacto — zero mudança visual em ≥768px.
              fontSize: isMobile
                ? "clamp(1.0rem, 3.8vw, 1.35rem)"
                : "clamp(1.4rem, 1.8vw, 1.85rem)",
              lineHeight: 0.95,
              letterSpacing: "-0.025em",
              color: "hsl(var(--foreground))",
            }}>
              <div>Desenvolvedor<sup style={{
                fontSize: "0.48em", fontWeight: 500,
                color: "hsl(148 100% 50%)", marginLeft: 4,
                verticalAlign: "super",
              }}>de</sup></div>
              <div>Impacto</div>
            </div>
          </div>


          {/* Headline
              Mobile: maior e centralizado, ocupando largura cheia.
              Desktop: clamp original intacto — zero mudança visual em ≥768px. */}
          <h2 style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: isMobile
              ? "clamp(1.35rem, 5.6vw, 1.85rem)"
              : "clamp(1.6rem, 2.6vw, 2.55rem)",
            fontWeight: 600,
            letterSpacing: "-0.025em",
            color: "hsl(var(--foreground))",
            lineHeight: isMobile ? 1.22 : 1.18,
            margin: 0,
            maxWidth: isMobile ? "22ch" : "32ch",
            textShadow: "0 1px 8px rgba(0,0,0,0.9), 0 2px 16px rgba(0,0,0,0.7)",
          }}>
            Uso IA e automação para{" "}
            <span style={{ color: "hsl(148 100% 50%)", fontWeight: 700 }}>
              transformar seu negócio
            </span>{" "}
            em uma máquina de fechar novos Clientes
          </h2>

          {/* Badges — desktop pílulas; mobile cards 2-col */}
          <div style={{
            display: isMobile ? "grid" : "flex",
            gridTemplateColumns: isMobile ? "1fr 1fr" : undefined,
            flexWrap: isMobile ? undefined : "wrap",
            gap: isMobile ? "0.45rem" : "0.6rem",
            maxWidth: "34rem",
            width: isMobile ? "100%" : undefined,
          }}>
            {[
              { label: "Desenvolvedor FullStack" },
              { label: "Desenvolvedor de Automações" },
              { label: "APIs e Integrações" },
              { label: "Web Developer" },
            ].map(({ label }) => (
              <div key={label} style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                gap: "0.55rem",
                fontFamily: "'Inter', sans-serif",
                fontSize: isMobile ? "0.72rem" : "0.82rem",
                fontWeight: 510,
                color: "hsl(var(--foreground))",
                border: "1px solid rgba(0,255,110,0.32)",
                background: isMobile
                  ? "rgba(0,40,20,0.5)"
                  : "rgba(0,255,110,0.06)",
                borderRadius: isMobile ? 12 : 999,
                padding: isMobile ? "8px 10px" : "9px 16px",
                textAlign: "center",
                whiteSpace: isMobile ? "normal" : "nowrap",
                lineHeight: 1.2,
              }}>
                {label}
              </div>
            ))}
          </div>

          {/* Prova social */}
          <div style={{
            display: "flex", alignItems: "center", gap: "0.85rem",
            marginTop: "0.2rem",
            justifyContent: isMobile ? "center" : "flex-start",
          }}>
            <div style={{ display: "flex" }}>
              {[avatarFullstack, avatarLaweb, avatarBullet].map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                  style={{
                    width: 32, height: 32, borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid #08090a",
                    marginLeft: i === 0 ? 0 : -10,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                    background: "#08090a",
                  }}
                />
              ))}
            </div>
            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "0.82rem", lineHeight: 1.3,
              color: "hsl(var(--foreground))",
            }}>
              <div style={{ fontWeight: 700 }}>Mais de 10 Empresas Satisfeitas</div>
              <div style={{
                fontWeight: 400,
                color: "hsl(var(--muted-foreground))",
                fontSize: "0.74rem",
              }}>Acelerando resultados.</div>
            </div>
          </div>

          {/* Mobile-only: strip verde no fluxo, abaixo da prova social */}
          {isMobile && (
            <div
              aria-hidden
              style={{
                position: "relative",
                width: "100%",
                height: 6,
                marginTop: "0.9rem",
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(0,255,110,0.85) 12%, rgba(0,255,110,1) 50%, rgba(0,255,110,0.85) 88%, transparent 100%)",
              }}
            >
              <div style={{
                position: "absolute",
                left: "50%", top: "50%",
                width: 18, height: 18,
                transform: "translate(-50%, -50%) rotate(45deg)",
                background: "hsl(148 100% 50%)",
                boxShadow: "0 0 14px rgba(0,255,110,0.85)",
              }} />
            </div>
          )}
        </div>

        {/* ── Faixa decorativa de rodapé (linha + losango) — inalterada ── */}
        <div
          ref={stripRef}
          aria-hidden
          style={{
            display: isMobile ? "none" : "block",
            position: "absolute",
            left: 0, right: 0, bottom: 64,
            height: 8,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(0,255,110,0.85) 12%, rgba(0,255,110,1) 50%, rgba(0,255,110,0.85) 88%, transparent 100%)",
            opacity: 0,
            zIndex: 50,
          }}
        >
          <div style={{
            position: "absolute",
            left: "50%", top: "50%",
            width: 28, height: 28,
            transform: "translate(-50%, -50%) rotate(45deg)",
            background: "hsl(148 100% 50%)",
            boxShadow: "0 0 22px rgba(0,255,110,0.85)",
            zIndex: 51,
          }} />
        </div>

        {/* ── Máscara sólida do rodapé: oculta qualquer elemento atrás ── */}
        <div
          aria-hidden
          style={{
            display: isMobile ? "none" : "block",
            position: "absolute",
            left: 0, right: 0, bottom: 0,
            height: 64,
            background: "hsl(var(--background))",
            zIndex: 5,
            pointerEvents: "none",
          }}
        />
      </div>
    </section>
  );
};
