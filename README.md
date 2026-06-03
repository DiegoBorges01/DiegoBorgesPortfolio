# Portfólio — Diego Borges

Portfólio pessoal de desenvolvedor full stack. Aplicação web single-page com
cenas 3D interativas, animações de scroll e foco em performance.

## Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Three.js / React Three Fiber / Rapier (cenas e física 3D)
- Framer Motion, GSAP e Lenis (animações e smooth scroll)

## Rodando localmente

```bash
npm install
npm run dev
```

A aplicação sobe em `http://localhost:8080`.

## Build de produção

```bash
npm run build
```

Os arquivos finais ficam em `dist/`.

## Testes

```bash
npm run test
```

## Deploy

Hospedado na Vercel. O `vercel.json` define o fallback de SPA para que as
rotas do React Router funcionem em refresh e links diretos.
