/**
 * skills-data.ts
 * ─────────────────────────────────────────────────────
 * Central source of truth for all skills shown on the
 * 3D keyboard. To add, remove or edit a skill, only
 * touch this file.
 *
 * Each skill maps to one physical keycap on the keyboard.
 * The ROWS array controls layout (5 rows, left → right).
 *
 * Fields:
 *   id          — unique key, used as React key
 *   label       — displayed on the keycap and in the hover card
 *   description — shown in the hover info card
 *   color       — keycap accent colour (hex)
 *   icon        — inline SVG string OR a URL to a stable CDN asset
 *   colSpan     — optional: 2 = wider key (like Space/Enter)
 */

export interface Skill {
  id: string;
  label: string;
  description: string;
  color: string;
  textColor?: string; // defaults to white if not set
  icon: string;       // legacy inline SVG (kept for backwards compat)
  iconPath?: string;  // path to /public/icons/<name>.svg — preferred
  colSpan?: number;
}

// ─── SVG icon paths (viewBox 0 0 24 24) ─────────────────
// All icons are inline — zero CDN dependency, zero network request.
// Source: simplified paths hand-traced from official brand icons.
const ICONS: Record<string, string> = {
  java: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.85 17.4s-.9.52.64.7c1.87.21 2.82.18 4.88-.2 0 0 .54.34 1.3.63-4.62 1.98-10.45-.11-6.82-1.13zm-.55-2.52s-1.01.75.53.91c2 .2 3.57.22 6.3-.3 0 0 .38.38.97.6-5.58 1.63-11.79.13-7.8-1.21z" fill="currentColor"/><path d="M13.23 11.56c1.14 1.31-.3 2.49-.3 2.49s2.89-1.49 1.56-3.36c-1.24-1.74-2.19-2.6 2.95-5.58 0 0-8.06 2.01-4.21 6.45z" fill="currentColor"/><path d="M19.44 19.08s.67.55-.73.97c-2.66.8-11.07 1.05-13.4.03-.84-.36.73-.87 1.23-.97.51-.11.8-.09.8-.09-2.53-.16-4.87.28-5.58 1.08C.94 21.44 18.1 22.08 19.44 19.08zM9.3 13.13s-2.64.63-1.4 1.08c5.78 1.77 11.04.16 11.04.16s-.38-.41-1.3-.72c-3.8-.72-7.26-.42-8.34-.52zm9.77 5.45c0-.01.01-.01 0 0z" fill="currentColor"/><path d="M16.9 15.13c4.73-2.46 2.55-4.82 1.02-4.5-.4.08-.57.15-.57.15s.14-.23.42-.33c3.15-1.1 5.57 3.26-1.07 4.94.1-.08.2-.18.2-.26z" fill="currentColor"/><path d="M14.39 2s2.52 2.52-2.39 6.4c-3.94 3.11-.9 4.88 0 6.9-2.3-2.07-3.98-3.9-2.85-5.6 1.66-2.49 6.27-3.7 5.24-7.7z" fill="currentColor"/><path d="M9.71 21.87c4.54.29 11.51-.16 11.67-2.3 0 0-.32.81-3.75 1.45-3.87.72-8.65.64-11.48.17 0 .01.58.47 3.56.68z" fill="currentColor"/></svg>`,

  javascript: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="2" fill="#f0db4f"/><path d="M7.5 17.5c.3.9.9 1.5 2 1.5 1 0 1.7-.5 1.7-1.4 0-1-.6-1.3-1.7-1.8l-.6-.2c-1.7-.7-2.8-1.6-2.8-3.5 0-1.8 1.3-3.1 3.4-3.1 1.5 0 2.5.5 3.3 1.9l-1.8 1.1c-.4-.7-.8-1-1.5-1-.7 0-1.1.4-1.1 1 0 .7.4 1 1.4 1.4l.6.3c2 .8 3.1 1.7 3.1 3.7 0 2.1-1.6 3.2-3.8 3.2-2.1 0-3.5-1-4.2-2.4l2-1.2zm7.2.2c.3 1 .9 1.7 1.7 1.7.9 0 1.4-.3 1.4-1.6v-8.8h2.2v8.8c0 2.6-1.5 3.8-3.7 3.8-2 0-3.1-1-3.7-2.3l2.1-1.6z" fill="#323330"/></svg>`,

  python: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.95 2C7.1 2 7.4 4.1 7.4 4.1V6.2h4.6v.6H5.5S2 6.4 2 11.3c0 4.9 3.1 4.7 3.1 4.7H7v-2.3s-.1-3.1 3-3.1h5.2s2.9.05 2.9-2.8V4.9S18.55 2 11.95 2zM9 5.8c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z" fill="#3776AB"/><path d="M12.05 22c4.85 0 4.55-2.1 4.55-2.1V17.8h-4.6v-.6h6.5S22 17.6 22 12.7c0-4.9-3.1-4.7-3.1-4.7H17v2.3s.1 3.1-3 3.1H8.8S5.9 13.35 5.9 16.2V19.1S5.45 22 12.05 22zM15 18.2c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" fill="#FFD43B"/></svg>`,

  php: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="12" cy="12" rx="10" ry="6" fill="#787CB4"/><path d="M7 10h1.5l.5 2.5.5-2.5H11l-1 5H8.5L8 12.8l-.5 2.2H6L7 10zm5 0h2.5c.8 0 1.5.6 1.5 1.5S15.3 13 14.5 13H13.5l-.5 2H12L13 10zm1.5 2h.5c.3 0 .5-.2.5-.5s-.2-.5-.5-.5H13.5l-.5 1h1z" fill="white"/></svg>`,

  typescript: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="2" fill="#007acc"/><path d="M14 10.5H16.5V12H14V18H12V12H9.5V10.5H14zM18 13.5v.8c.3-.5.9-.9 1.6-.9.2 0 .4 0 .4.1V15c-.1 0-.3-.1-.6-.1-.7 0-1.2.4-1.4 1V18H16v-4.5h2z" fill="white"/></svg>`,

  react: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="2" fill="#61dafb"/><ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#61dafb" strokeWidth="1.2" fill="none"/><ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#61dafb" strokeWidth="1.2" fill="none" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#61dafb" strokeWidth="1.2" fill="none" transform="rotate(120 12 12)"/></svg>`,

  nextjs: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#000"/><path d="M9 8.5h2l5 7V8.5h1.5v7h-2L10 8.5v7H8.5l.5-7z" fill="white"/></svg>`,

  tailwind: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 6C9.6 6 8.1 7.2 7.5 9.6c.9-1.2 1.95-1.65 3.15-1.35.685.172 1.174.67 1.715 1.223C13.24 10.39 14.264 11.4 16.5 11.4c2.4 0 3.9-1.2 4.5-3.6-.9 1.2-1.95 1.65-3.15 1.35-.685-.172-1.174-.67-1.715-1.223C15.26 7.01 14.236 6 12 6zM7.5 11.4C5.1 11.4 3.6 12.6 3 15c.9-1.2 1.95-1.65 3.15-1.35.685.172 1.174.67 1.715 1.223C8.74 15.79 9.764 16.8 12 16.8c2.4 0 3.9-1.2 4.5-3.6-.9 1.2-1.95 1.65-3.15 1.35-.685-.172-1.174-.67-1.715-1.223C10.76 12.41 9.736 11.4 7.5 11.4z" fill="#38bdf8"/></svg>`,

  apis: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="8" width="9" height="8" rx="2" stroke="#10b981" strokeWidth="1.5"/><rect x="13" y="8" width="9" height="8" rx="2" stroke="#10b981" strokeWidth="1.5"/><path d="M11 12h2M8 12v-2M8 12v2M16 12v-2M16 12v2" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"/></svg>`,

  mysql: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3C7.5 3 4 4.3 4 6s3.5 3 8 3 8-1.3 8-3-3.5-3-8-3z" fill="#00618A"/><path d="M4 6v3c0 1.7 3.5 3 8 3s8-1.3 8-3V6" stroke="#00618A" strokeWidth="1.2" fill="none"/><path d="M4 9v3c0 1.7 3.5 3 8 3s8-1.3 8-3V9" stroke="#00618A" strokeWidth="1.2" fill="none"/><path d="M4 12v3c0 1.7 3.5 3 8 3s8-1.3 8-3v-3" stroke="#00618A" strokeWidth="1.2" fill="none"/></svg>`,

  n8n: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="3" fill="#ea4b71"/><circle cx="19" cy="7" r="3" fill="#ea4b71"/><circle cx="19" cy="17" r="3" fill="#ea4b71"/><path d="M8 12h5.5M13.5 12L17 7M13.5 12L17 17" stroke="#ea4b71" strokeWidth="1.5" strokeLinecap="round"/></svg>`,

  figma: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="2" width="8" height="6" rx="3" fill="#F24E1E"/><rect x="8" y="9" width="8" height="6" rx="3" fill="#FF7262"/><rect x="8" y="16" width="8" height="6" rx="3" fill="#0ACF83"/><circle cx="16" cy="12" r="3" fill="#1ABCFE"/><rect x="8" y="9" width="4" height="6" rx="0" fill="#A259FF"/></svg>`,

  photoshop: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#31A8FF"/><path d="M6.5 16V8h3.2c1.8 0 3 .9 3 2.5S11.5 13 9.7 13H8v3H6.5zm1.5-4.4h1.5c1 0 1.5-.4 1.5-1.2S10.5 9.4 9.5 9.4H8v2.2zm5.5 1.2c0-2 1.3-3.3 3.2-3.3.5 0 .9.1 1.3.2V11c-.3-.1-.7-.2-1-.2-1 0-1.7.7-1.7 2s.7 2 1.7 2c.3 0 .7-.1 1-.2v1.3c-.4.1-.8.2-1.3.2-1.9-.1-3.2-1.4-3.2-3.3z" fill="white"/></svg>`,

  blender: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="13" r="5" fill="#e87d0d" stroke="#e87d0d"/><circle cx="12" cy="13" r="2" fill="white"/><path d="M12 8V4M8 10L5 7M16 10l3-3" stroke="#e87d0d" strokeWidth="2" strokeLinecap="round"/><path d="M5 13H2M22 13h-3" stroke="#e87d0d" strokeWidth="2" strokeLinecap="round"/></svg>`,

  automation: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3a9 9 0 100 18A9 9 0 0012 3z" stroke="#8b5cf6" strokeWidth="1.5" fill="none"/><path d="M12 7v5l3 3" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round"/><path d="M16 3.5L18 6M8 3.5L6 6M19.5 8l2.5 2M4.5 8L2 10" stroke="#8b5cf6" strokeWidth="1" strokeLinecap="round" opacity=".5"/></svg>`,

  ai: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="8" height="8" rx="2" fill="#06b6d4" opacity=".7"/><rect x="13" y="3" width="8" height="8" rx="2" fill="#06b6d4"/><rect x="3" y="13" width="8" height="8" rx="2" fill="#06b6d4"/><rect x="13" y="13" width="8" height="8" rx="2" fill="#06b6d4" opacity=".7"/><circle cx="12" cy="12" r="3" fill="white"/></svg>`,

  poo: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#64748b" strokeWidth="1.5" fill="none"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#64748b" strokeWidth="1.5" fill="none"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#64748b" strokeWidth="1.5" fill="none"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#64748b" strokeWidth="1.5" fill="none"/><path d="M10 6.5h4M6.5 10v4M17.5 10v4M10 17.5h4" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/></svg>`,

  dsa: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="5" r="2.5" fill="#22c55e"/><circle cx="5" cy="17" r="2.5" fill="#22c55e"/><circle cx="19" cy="17" r="2.5" fill="#22c55e"/><path d="M12 7.5v4M12 11.5L5 14.5M12 11.5L19 14.5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/></svg>`,

  git: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.6 11.2L12.8 2.4a1.4 1.4 0 00-2 0l-1.8 1.8 2.3 2.3c.6-.2 1.3 0 1.7.5.5.5.6 1.2.4 1.8l2.2 2.2c.6-.2 1.3-.1 1.8.4.7.7.7 1.9 0 2.6a1.85 1.85 0 01-2.6 0c-.5-.5-.7-1.3-.4-1.9l-2-2v5.4c.2.1.3.2.5.3.7.7.7 1.9 0 2.6a1.85 1.85 0 01-2.6 0 1.85 1.85 0 010-2.6c.2-.2.4-.3.6-.4V9.8c-.2-.1-.4-.2-.6-.4a1.86 1.86 0 01-.4-2L5.6 5.1.4 10.3a1.4 1.4 0 000 2l8.8 8.8c.5.5 1.4.5 2 0l8.4-8.4a1.4 1.4 0 000-1.5z" fill="#F05033"/></svg>`,

  github: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.5 2 2 6.6 2 12.2c0 4.5 2.9 8.3 6.8 9.6.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.4-3.4-1.4-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 015 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9v2.7c0 .3.2.6.7.5C19.1 20.5 22 16.7 22 12.2 22 6.6 17.5 2 12 2z" fill="#fff"/></svg>`,

  docker: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 11s-1-1-3-1c-1 0-1.5.3-2 .5V8h-3v3h-2V8h-3v3H6V8H3v3c0 4 3 7 7 7h6c3 0 5-2 6-5 0 0 1.5.1 2-1z" fill="#0db7ed"/><circle cx="18" cy="6" r="1" fill="#0db7ed"/></svg>`,

  nodejs: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="#539e43"/><path d="M12 7v10M8 11h8" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>`,

  html: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 2l1.7 19L12 23l7.3-2L21 2H3z" fill="#E34F26"/><path d="M12 21V4M7 8h10l-.5 4H8l.3 4 3.7 1 3.7-1 .3-3" stroke="white" strokeWidth="1" strokeLinejoin="round" fill="none"/></svg>`,

  css: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 2l1.7 19L12 23l7.3-2L21 2H3z" fill="#1572B6"/><path d="M12 21V4M7 8h10l-.5 4H8l.3 4 3.7 1 3.7-1 .3-3" stroke="white" strokeWidth="1" strokeLinejoin="round" fill="none"/></svg>`,

  postgresql: ``,
  notion: ``,
  claude: ``,
  vscodium: ``,
};

// ─── Skill definitions ───────────────────────────────────
export const SKILLS: Skill[] = [
  // Row 1
  {
    id: "java",
    label: "Java",
    description: "POO, backend enterprise e sistemas escalaveis.",
    color: "#ff8a00",
    textColor: "#000",
    icon: ICONS.java,
    iconPath: "/icons/java.svg",
  },
  {
    id: "javascript",
    label: "JavaScript",
    description: "ES6+, DOM, async/await e logica web.",
    color: "#008cff",
    textColor: "#000",
    icon: ICONS.javascript,
    iconPath: "/icons/javascript.svg",
  },
  {
    id: "python",
    label: "Python",
    description: "Automacao, dados e integracao com IA.",
    color: "#7a3cff",
    icon: ICONS.python,
    iconPath: "/icons/python.svg",
  },
  {
    id: "php",
    label: "PHP",
    description: "Backend, APIs REST e sistemas web.",
    color: "#7df0ff",
    icon: ICONS.php,
    iconPath: "/icons/php.svg",
  },
  {
    id: "typescript",
    label: "TypeScript",
    description: "Tipagem estatica para JS seguro.",
    color: "#ff2d4d",
    icon: ICONS.typescript,
    iconPath: "/icons/typescript.svg",
  },

  // Row 2
  {
    id: "react",
    label: "React",
    description: "Componentes, hooks e interfaces modernas.",
    color: "#008cff",
    icon: ICONS.react,
    iconPath: "/icons/react.svg",
  },
  {
    id: "nextjs",
    label: "Next.js",
    description: "SSR, rotas e deploy otimizado.",
    color: "#7df0ff",
    icon: ICONS.nextjs,
    iconPath: "/icons/nextjs.svg",
  },
  {
    id: "tailwind",
    label: "Tailwind",
    description: "Utilitarios CSS para UI rapida.",
    color: "#2B2B2B",
    icon: ICONS.tailwind,
    iconPath: "/icons/tailwind.svg",
  },
  // Row 3
  {
    id: "mysql",
    label: "MySQL",
    description: "Modelagem relacional e queries.",
    color: "#ff2d4d",
    icon: ICONS.mysql,
    iconPath: "/icons/mysql.svg",
  },
  {
    id: "n8n",
    label: "n8n",
    description: "Automacao no-code de fluxos e APIs.",
    color: "#2B2B2B",
    icon: ICONS.n8n,
    iconPath: "/icons/n8n.svg",
  },
  {
    id: "figma",
    label: "Figma",
    description: "Prototipagem e design de interfaces.",
    color: "#f97316",
    icon: ICONS.figma,
    iconPath: "/icons/figma.svg",
  },
  {
    id: "photoshop",
    label: "Photoshop",
    description: "Edicao, composicao e assets visuais.",
    color: "#06b6d4",
    icon: ICONS.photoshop,
    iconPath: "/icons/photoshop.svg",
  },

  // Row 4
  {
    id: "blender",
    label: "Blender",
    description: "Modelagem 3D, animacao e render.",
    color: "#166534",
    icon: ICONS.blender,
    iconPath: "/icons/blender.svg",
  },

  // Row 5
  {
    id: "dsa",
    label: "Estruturas de Dados",
    description: "Algoritmos, grafos e Big-O.",
    color: "#16a34a",
    icon: ICONS.dsa,
    iconPath: "/icons/dsa.svg",
  },
  {
    id: "git",
    label: "Git",
    description: "Versionamento, branches e merges.",
    color: "#dc2626",
    icon: ICONS.git,
    iconPath: "/icons/git.svg",
  },
  {
    id: "github",
    label: "GitHub",
    description: "Colaboracao, review e CI/CD.",
    color: "#ca8a04",
    icon: ICONS.github,
    iconPath: "/icons/github.svg",
  },
  {
    id: "docker",
    label: "Docker",
    description: "Containers do dev a producao.",
    color: "#1e3a8a",
    icon: ICONS.docker,
    iconPath: "/icons/docker.svg",
  },
  {
    id: "nodejs",
    label: "Node.js",
    description: "Backend JS e APIs performaticas.",
    color: "#22c55e",
    icon: ICONS.nodejs,
    iconPath: "/icons/nodejs.svg",
  },
  {
    id: "html",
    label: "HTML",
    description: "Marcacao semantica e acessivel.",
    color: "#4ade80",
    icon: ICONS.html,
    iconPath: "/icons/html.svg",
  },
  {
    id: "css",
    label: "CSS",
    description: "Layouts, flex/grid e animacoes.",
    color: "#52525b",
    icon: ICONS.css,
    iconPath: "/icons/css.svg",
  },
  {
    id: "postgresql",
    label: "PostgreSQL",
    description: "Banco relacional avancado.",
    color: "#2B2B2B",
    icon: ICONS.postgresql,
    iconPath: "/icons/postgresql.svg",
  },
  {
    id: "notion",
    label: "Notion",
    description: "Documentacao e gestao de projetos.",
    color: "#14532d",
    icon: ICONS.notion,
    iconPath: "/icons/notion.svg",
  },
  {
    id: "claude",
    label: "Claude",
    description: "IA assistida para desenvolvimento.",
    color: "#008cff",
    icon: ICONS.claude,
    iconPath: "/icons/claude.svg",
  },
  {
    id: "vscodium",
    label: "VSCodium",
    description: "Editor open-source e extensivel.",
    color: "#2563eb",
    icon: ICONS.vscodium,
    iconPath: "/icons/vscodium.svg",
  },
  {
    id: "wordpress",
    label: "WordPress",
    description: "Sites, temas e plugins customizados.",
    color: "#2B2B2B",
    icon: "",
    iconPath: "/icons/wordpress.svg",
  },
];

// Layout: uniform 6×4 grid (24 keys) → rectangular keyboard like the reference
export const KEYBOARD_ROWS: string[][] = [
  ["java", "javascript", "typescript", "python", "php", "html"],
  ["react", "nextjs", "nodejs", "tailwind", "css", "photoshop"],
  ["mysql", "postgresql", "docker", "git", "github", "vscodium"],
  ["n8n", "claude", "notion", "figma", "blender", "wordpress"],
];
