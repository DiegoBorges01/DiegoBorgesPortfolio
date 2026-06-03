import { useEffect, useRef } from "react";
import initFluidCursor from "@/hooks/use-fluid-cursor";

interface FluidCursorProps {
  /** Controlled by CursorManager — fades canvas in/out without remounting WebGL. */
  visible?: boolean;
}

/**
 * Desktop-only WebGL fluid cursor overlay. Assumes the parent already gated
 * mounting to desktop devices (see CursorManager).
 */
const FluidCursor = ({ visible = true }: FluidCursorProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const cleanup = initFluidCursor(canvasRef.current);
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden
    >
      <canvas ref={canvasRef} className="h-screen w-screen" />
    </div>
  );
};

export default FluidCursor;
