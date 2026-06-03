import { useEffect, useRef } from "react";

export default function ContactSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const iframeSrc =
      "https://forms.visme.co/formsPlayer/_embed/q74pzeyw-untitled-project?embedIframeId=1";

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

    // Carrega o iframe da Visme só quando a seção de contato se aproxima da
    // viewport (400px de antecedência). Assim esse iframe de terceiro não pesa
    // no carregamento inicial da página, e a margem evita o flash branco.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            inject();
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
