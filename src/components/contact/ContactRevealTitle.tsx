import { useEffect, useRef } from "react";

export default function ContactSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const iframeSrc =
      "https://forms.visme.co/formsPlayer/_embed/q74pzeyw-untitled-project?embedIframeId=1";

    const preloadId = "visme-contact-preload";
    if (!document.getElementById(preloadId)) {
      const preload = document.createElement("link");
      preload.id = preloadId;
      preload.rel = "prefetch";
      preload.href = iframeSrc;
      preload.crossOrigin = "anonymous";
      document.head.appendChild(preload);
    }

    const section = sectionRef.current;
    const reactHost = mountRef.current;
    if (!section || !reactHost) return;

    const host = document.createElement("div");
    host.className = "visme-embed-inner";
    host.style.width = "100%";
    host.style.height = "100%";
    reactHost.appendChild(host);

    // Cria o iframe uma única vez. Marca "is-loaded" quando a Visme termina
    // de carregar (já passou da tela branca interna dela).
    const inject = () => {
      if (host.querySelector("iframe.vismeForms")) return;
      const iframe = document.createElement("iframe");
      iframe.className = "vismeForms contact-canvas-frame";
      iframe.title = "Formulário de contato";
      iframe.src = iframeSrc;
      iframe.loading = "eager";
      iframe.setAttribute("scrolling", "no");
      iframe.setAttribute("allowfullscreen", "true");
      iframe.setAttribute("webkitallowfullscreen", "true");
      iframe.setAttribute("mozallowfullscreen", "true");
      iframe.addEventListener(
        "load",
        () => requestAnimationFrame(() => reactHost.classList.add("is-loaded")),
        { once: true },
      );
      host.appendChild(iframe);
    };

    // 1) CARREGA cedo, em segundo plano, assim que o navegador fica ocioso.
    //    A seção fica escondida (opacity 0 via CSS), então a tela branca da
    //    Visme acontece fora da vista do usuário.
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;
    let idleId: number | undefined;
    let timerId: number | undefined;
    if (ric) {
      idleId = ric(inject, { timeout: 2500 });
    } else {
      timerId = window.setTimeout(inject, 1200);
    }

    // 2) ATIVA a revelação só quando a seção entra na viewport.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            inject(); // garante o iframe mesmo se o idle ainda não rodou
            reactHost.classList.add("is-active");
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "400px 0px", threshold: 0 },
    );
    io.observe(section);

    return () => {
      io.disconnect();
      const cic = (window as unknown as {
        cancelIdleCallback?: (id: number) => void;
      }).cancelIdleCallback;
      if (idleId !== undefined && cic) cic(idleId);
      if (timerId !== undefined) window.clearTimeout(timerId);
      if (host.parentNode === reactHost) reactHost.removeChild(host);
    };
  }, []);


  return (
    <section
      id="contact"
      ref={sectionRef}
      className="contact-section w-full min-h-screen bg-background py-0 px-0 overflow-hidden"
    >
      {/* suppressHydrationWarning + ref vazio: React não gerencia os filhos,
          o Visme pode mutar livremente sem quebrar a reconciliação. */}
      <div
        className="visme-embed-mask contact-canvas-wrapper"
        ref={mountRef}
        suppressHydrationWarning
      />
    </section>
  );
}
