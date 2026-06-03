import { useRef } from "react";
import { useScroll } from "framer-motion";
import { SplashScreen } from "@/components/splash/SplashScreen";
import { HeroSection } from "@/components/hero/HeroSection";
import { GeometricStaggeredLines } from "@/components/transition/GeometricStaggeredLines";
import MyJourneyTitle from "@/components/journey/MyJourneyTitle";
import InfiniteTunnel from "@/components/journey/InfiniteTunnel";
import ProjectsTitle from "@/components/projects/ProjectsTitle";
import SkillsStacksTitle from "@/components/skills/SkillsStacksTitle";
import SkillsStacks from "@/components/skills/SkillsStacks";   // ← NEW
import ContactRevealTitle from "@/components/contact/ContactRevealTitle";
import CursorManager from "@/components/cursor/CursorManager";
import CustomScrollIndicator from "@/components/scroll/CustomScrollIndicator";
import SiteFooter from "@/components/footer/SiteFooter";

/**
 * Página inicial:
 * 1. Splash — headline.
 * 2. Bridge — container dedicado que hospeda o funil de linhas (sticky)
 *    cobrindo apenas a transição entre Splash e Hero, sem sobrepor as
 *    duas seções.
 * 3. Hero — headline com gradiente.
 */
const Index = () => {
  const bridgeRef = useRef<HTMLDivElement>(null);
  // Progresso 0 → 1 enquanto o usuário rola pela bridge.
  const { scrollYProgress } = useScroll({
    target: bridgeRef,
    offset: ["start end", "end start"],
  });

  return (
    <main className="relative w-full bg-background text-foreground">
      <CursorManager />
      <CustomScrollIndicator />
      <SplashScreen scrollYProgress={scrollYProgress} />
      {/* Bridge: começa no fim da Splash e termina no início da Hero.
          O funil é sticky dentro dela — só aparece nessa faixa. */}
      <div
        ref={bridgeRef}
        aria-hidden
        className="relative z-30 w-full"
        style={{ height: "120vh" }}
      >
        <div className="sticky top-0 h-screen w-full">
          <GeometricStaggeredLines scrollYProgress={scrollYProgress} />
        </div>
      </div>
      <HeroSection scrollYProgress={scrollYProgress} />
      <MyJourneyTitle />
      <InfiniteTunnel />
      <ProjectsTitle />
      <div data-cursor-zone="fluid">
        <SkillsStacksTitle />
        <SkillsStacks />
        <ContactRevealTitle />
        <SiteFooter />
      </div>
    </main>
  );
};

export default Index;
