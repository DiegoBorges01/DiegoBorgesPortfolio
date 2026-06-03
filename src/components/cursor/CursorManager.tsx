import { useEffect, useState } from "react";
import FluidCursor from "./FluidCursor";
import SmoothFollower from "./SmoothFollower";

/**
 * Desktop-only cursor coordinator.
 *
 * - SmoothFollower is shown by default across the page.
 * - FluidCursor takes over inside any element marked with
 *   `data-cursor-zone="fluid"` (e.g. SkillsStacksTitle, SkillsStacks, Contact).
 *
 * Both cursors mount once on desktop; only their visibility toggles, avoiding
 * costly WebGL teardown/re-init when entering/leaving zones.
 */
const CursorManager = () => {
  const [enabled, setEnabled] = useState(false);
  const [inFluidZone, setInFluidZone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(
      "(pointer: fine) and (hover: hover) and (min-width: 1024px)",
    );
    const apply = () => setEnabled(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Hide the native arrow cursor only while custom cursors are active (desktop).
  useEffect(() => {
    if (!enabled) return;
    document.documentElement.classList.add("custom-cursor-active");
    return () => {
      document.documentElement.classList.remove("custom-cursor-active");
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const zone = el?.closest('[data-cursor-zone="fluid"]');
      setInFluidZone(!!zone);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <FluidCursor visible={inFluidZone} />
      <SmoothFollower visible={!inFluidZone} />
    </>
  );
};

export default CursorManager;
