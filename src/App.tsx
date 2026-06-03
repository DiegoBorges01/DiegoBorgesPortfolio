import { lazy, Suspense, useMemo, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LoadingScreen from "@/components/LoadingScreen";
import { LoaderGateProvider } from "@/providers/LoaderGate";
import NotFound from "./pages/NotFound.tsx";
import cardFrontImg from "@/assets/lanyard/card-front.webp";
import cardBackImg from "@/assets/lanyard/card-back.webp";
import profileImg from "@/assets/lanyard/profile.webp";

const Index = lazy(() => import("./pages/Index.tsx"));

// Deve casar exatamente com `--background` (src/index.css) — hsl(0 0% 0%) = #000.
const SITE_BG = "#000000";

const App = () => {
  const [loaderDone, setLoaderDone] = useState(false);

  // Pré-carrega chunks pesados em paralelo ao loading screen — o contador
  // só chega em 100% quando todos estes resolvem.
  const waitFor = useMemo<Promise<unknown>[]>(
    () => [
      import("./pages/Index.tsx"),
      import("@/components/splash/SplashScreen"),
      import("@/components/hero/HeroSection"),
    ],
    [],
  );

  const preloadImages = useMemo(
    () => [cardFrontImg, cardBackImg, profileImg, "/ink-drop.webp"],
    [],
  );

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <LoaderGateProvider started={loaderDone}>
        <BrowserRouter>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </LoaderGateProvider>
      {!loaderDone && (
        <LoadingScreen
          dropSrc="/ink-drop.webp"
          exitColor={SITE_BG}
          holdAfterComplete
          waitFor={waitFor}
          preloadImages={preloadImages}
          onComplete={() => setLoaderDone(true)}
        />
      )}
    </TooltipProvider>
  );
};

export default App;
