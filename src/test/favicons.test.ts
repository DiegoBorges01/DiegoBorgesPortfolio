/**
 * Teste de regressão para favicons e ícones de toque.
 *
 * Não é um diff de pixels (que exigiria Playwright + baseline images),
 * mas valida de forma determinística tudo o que faz os ícones aparecerem
 * corretamente em desktop e mobile:
 *
 *  - Tags <link> corretas no <head> do index.html
 *  - Arquivos físicos presentes em public/ e não vazios
 *  - Assinaturas binárias (PNG/ICO) válidas
 *  - Dimensões reais dos PNGs (16, 32, 180, 192, 512)
 *  - site.webmanifest com ícones 192 e 512 e theme_color casando com o <meta>
 */
import { describe, it, expect } from "vitest";
import { readFileSync, statSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const manifest = JSON.parse(
  readFileSync(resolve(root, "public/site.webmanifest"), "utf8"),
);

/** Lê width/height de um PNG (bytes 16-23 do header IHDR). */
function pngSize(path: string): { w: number; h: number } {
  const buf = readFileSync(path);
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  expect(buf.slice(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function fileOk(rel: string) {
  const p = resolve(root, "public", rel);
  expect(existsSync(p), `arquivo ausente: public/${rel}`).toBe(true);
  expect(statSync(p).size, `arquivo vazio: public/${rel}`).toBeGreaterThan(0);
  return p;
}

describe("Favicons e ícones de toque — desktop", () => {
  it("declara favicon.ico universal", () => {
    expect(html).toMatch(
      /<link\s+rel="icon"\s+href="\/favicon\.ico(\?[^"]*)?"\s+sizes="any"\s*\/>/,
    );
    const p = fileOk("favicon.ico");
    expect(readFileSync(p).slice(0, 4).toString("hex")).toBe("00000100");
  });

  it("declara favicon PNG 32x32 (Chrome/Firefox/Edge)", () => {
    expect(html).toMatch(
      /<link\s+rel="icon"\s+type="image\/png"\s+sizes="32x32"\s+href="\/favicon-32\.png(\?[^"]*)?"\s*\/>/,
    );
    expect(pngSize(fileOk("favicon-32.png"))).toEqual({ w: 32, h: 32 });
  });

  it("declara favicon PNG 16x16 (abas em alta densidade)", () => {
    expect(html).toMatch(
      /<link\s+rel="icon"\s+type="image\/png"\s+sizes="16x16"\s+href="\/favicon-16\.png(\?[^"]*)?"\s*\/>/,
    );
    expect(pngSize(fileOk("favicon-16.png"))).toEqual({ w: 16, h: 16 });
  });
});

describe("Favicons e ícones de toque — mobile", () => {
  it("declara apple-touch-icon 180x180 (iOS/iPadOS)", () => {
    expect(html).toMatch(
      /<link\s+rel="apple-touch-icon"\s+sizes="180x180"\s+href="\/apple-touch-icon\.png(\?[^"]*)?"\s*\/>/,
    );
    expect(pngSize(fileOk("apple-touch-icon.png"))).toEqual({ w: 180, h: 180 });
  });

  it("declara o webmanifest (Android/Chrome PWA)", () => {
    expect(html).toMatch(
      /<link\s+rel="manifest"\s+href="\/site\.webmanifest(\?[^"]*)?"\s*\/>/,
    );
    fileOk("site.webmanifest");
  });

  it("webmanifest expõe icon-192 e icon-512 com dimensões reais corretas", () => {
    const byName = Object.fromEntries(
      manifest.icons.map((i: { src: string }) => [i.src, i]),
    );
    expect(byName["/icon-192.png"]).toBeTruthy();
    expect(byName["/icon-512.png"]).toBeTruthy();
    expect(byName["/icon-192.png"].sizes).toBe("192x192");
    expect(byName["/icon-512.png"].sizes).toBe("512x512");

    expect(pngSize(fileOk("icon-192.png"))).toEqual({ w: 192, h: 192 });
    expect(pngSize(fileOk("icon-512.png"))).toEqual({ w: 512, h: 512 });
  });

  it("theme-color do <meta> casa com o do manifest (sem flash de cor errada)", () => {
    const meta = html.match(
      /<meta\s+name="theme-color"\s+content="(#[0-9a-fA-F]{3,8})"/,
    );
    expect(meta).not.toBeNull();
    expect(meta![1].toLowerCase()).toBe(
      String(manifest.theme_color).toLowerCase(),
    );
  });
});

describe("Higiene: nada de favicons antigos pendurados", () => {
  it("não existem links para /favicon.png legado", () => {
    expect(html).not.toMatch(/href="\/favicon\.png"/);
  });
  it("não existem links para o ícone /placeholder.svg como favicon", () => {
    expect(html).not.toMatch(
      /<link[^>]+rel="icon"[^>]+href="\/placeholder\.svg"/,
    );
  });
});
