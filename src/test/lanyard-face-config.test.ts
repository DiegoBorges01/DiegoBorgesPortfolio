import { describe, expect, it } from "vitest";
import { CARD_FACE_CONFIG } from "@/components/lanyard/cardFaceConfig";

describe("lanyard card face textures", () => {
  const cardBounds = {
    minX: -0.35820895433425903,
    maxX: 0.35820895433425903,
    minY: 0.02290511131286621,
    maxY: 1.0229052305221558,
    minZ: 0.001373126171529293,
    maxZ: 0.005398052278906107,
  };

  it("keeps front and back image planes fully inside the physical badge rectangle", () => {
    const { width, height, centerY, radius } = CARD_FACE_CONFIG;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    expect(radius).toBeGreaterThan(0);
    expect(-halfWidth).toBeGreaterThan(cardBounds.minX);
    expect(halfWidth).toBeLessThan(cardBounds.maxX);
    expect(centerY - halfHeight).toBeGreaterThan(cardBounds.minY);
    expect(centerY + halfHeight).toBeLessThan(cardBounds.maxY);
  });

  it("separates front and back faces with tiny Z offsets so they cannot bleed into each other", () => {
    const { frontZ, backZ } = CARD_FACE_CONFIG;

    expect(frontZ).toBeGreaterThan(cardBounds.maxZ);
    expect(backZ).toBeLessThan(cardBounds.minZ);
    expect(Math.abs(frontZ)).toBeLessThanOrEqual(0.011);
    expect(Math.abs(backZ)).toBeLessThanOrEqual(0.011);
  });
});