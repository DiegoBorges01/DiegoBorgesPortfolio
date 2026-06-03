import { useEffect, useRef, useState } from "react";
import "./LoadingScreen.css";

type Props = {
  onComplete?: () => void;
  dropSrc?: string;
  exitColor?: string;
  holdAfterComplete?: boolean;
  /**
   * Lista de promises a aguardar antes do contador atingir 100%
   * (ex.: chunks dinâmicos, fetch de dados, decode de imagens chave).
   */
  waitFor?: Promise<unknown>[];
  /**
   * URLs de imagens a pré-carregar (entram no cálculo de progresso real).
   */
  preloadImages?: string[];
  /** Tempo mínimo para a Phase 1, mesmo que tudo carregue instantâneo. */
  minDurationMs?: number;
  /** Tempo máximo de espera por assets antes de destravar (failsafe). */
  maxDurationMs?: number;
};

const TARGETS = {
  name: "DIEGO BORGES",
  role: "DEVELOP & DESIGN",
  title: "ENGINEER",
};

const POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@%&*+=/<>?$!~";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const randCh = () => POOL[(Math.random() * POOL.length) | 0];

/**
 * Anima o contador de 0 → 100 ao longo de `minDurationMs`, mas trava em 99
 * enquanto `getProgress() < 1`. Failsafe via `maxDurationMs`.
 */
function runRealCounter(
  el: HTMLElement,
  getProgress: () => number,
  opts: { minDurationMs: number; maxDurationMs: number },
) {
  return new Promise<void>((resolve) => {
    const start = performance.now();
    let lastShown = -1;
    function frame(now: number) {
      const elapsed = now - start;
      const timePct = Math.min(100, (elapsed / opts.minDurationMs) * 100);
      const realDone = getProgress() >= 1;
      // Sobe linearmente com o tempo; trava em 99 enquanto algo pende.
      const target = realDone ? timePct : Math.min(timePct, 99);
      const shown = Math.floor(target + 0.0001);
      if (shown !== lastShown) {
        el.textContent = String(shown).padStart(3, "0");
        lastShown = shown;
      }
      const done =
        (realDone && timePct >= 100) || elapsed >= opts.maxDurationMs;
      if (!done) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = "100";
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}


type MorphOpts = {
  initialText?: string;
  settleHead?: number;
  settleTail?: number;
  onSettle?: (i: number, len: number) => void;
};

function morphScramble(
  el: HTMLElement,
  target: string,
  durMs: number,
  opts: MorphOpts = {}
) {
  const settleHead = opts.settleHead ?? 0.4;
  const settleTail = opts.settleTail ?? 0.95;
  const onSettle = opts.onSettle ?? (() => {});
  const initialText = opts.initialText ?? "";
  return new Promise<void>((resolve) => {
    const start = performance.now();
    const len = target.length;
    const initLen = Math.min(initialText.length, len);
    const revealAt = Array.from({ length: len }, (_, i) => {
      if (i < initLen) return 0;
      const gi = (i - initLen + 1) / Math.max(1, len - initLen);
      return easeOutCubic(gi) * 0.5;
    });
    const settleAt = revealAt.map((r, i) => {
      const base =
        settleHead + (i / Math.max(1, len - 1)) * (settleTail - settleHead);
      return Math.max(base, r + 0.08);
    });
    const settled = new Array(len).fill(false);

    function frame(now: number) {
      const t = Math.min(1, (now - start) / durMs);
      let out = "";
      for (let i = 0; i < len; i++) {
        if (t < revealAt[i]) continue;
        const tch = target[i];
        if (t >= settleAt[i]) {
          out += tch;
          if (!settled[i]) {
            settled[i] = true;
            try {
              onSettle(i, len);
            } catch {}
          }
        } else if (tch === " ") {
          out += Math.random() < 0.5 ? " " : randCh();
        } else if (tch === "&") {
          out += Math.random() < 0.4 ? "&" : randCh();
        } else {
          out += randCh();
        }
      }
      el.textContent = out;
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = target;
        for (let i = 0; i < len; i++) {
          if (!settled[i]) {
            settled[i] = true;
            try {
              onSettle(i, len);
            } catch {}
          }
        }
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

function morphWithTrigger(
  el: HTMLElement,
  target: string,
  durMs: number,
  triggerIdx: number,
  opts: MorphOpts = {}
) {
  let triggerResolve: (() => void) | null = null;
  const triggerPromise = new Promise<void>((r) => (triggerResolve = r));
  const fullPromise = morphScramble(el, target, durMs, {
    ...opts,
    onSettle: (i, len) => {
      if (i === triggerIdx && triggerResolve) {
        triggerResolve();
        triggerResolve = null;
      }
      opts.onSettle?.(i, len);
    },
  });
  fullPromise.then(() => {
    if (triggerResolve) {
      triggerResolve();
      triggerResolve = null;
    }
  });
  return { triggerPromise, fullPromise };
}

export default function LoadingScreen({
  onComplete,
  dropSrc = "/ink-drop.png",
  exitColor = "#111111",
  holdAfterComplete = false,
  waitFor = [],
  preloadImages = [],
  minDurationMs = 4500,
  maxDurationMs = 14000,
}: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const sqRef = useRef<HTMLSpanElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const roleRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const spreadRef = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  // Refs estáveis pras props que entram no efeito (não queremos reexecutar).
  const waitForRef = useRef(waitFor);
  const preloadRef = useRef(preloadImages);

  useEffect(() => {
    let cancelled = false;

    // ── Coleta de tarefas reais a aguardar (com telemetria) ──────────
    type Task = { label: string; done: boolean; startedAt: number; doneAt?: number };
    const tasks: Task[] = [];
    const t0 = performance.now();
    const track = <T,>(label: string, p: Promise<T>) => {
      const task: Task = { label, done: false, startedAt: performance.now() };
      tasks.push(task);
      p.then(
        () => {
          task.done = true;
          task.doneAt = performance.now();
          console.log(
            `[LoadingScreen] ✓ ${label} — ${(task.doneAt - task.startedAt).toFixed(0)}ms`,
          );
        },
        (err) => {
          task.done = true;
          task.doneAt = performance.now();
          console.warn(
            `[LoadingScreen] ✗ ${label} — ${(task.doneAt - task.startedAt).toFixed(0)}ms (erro)`,
            err,
          );
        },
      );
      return p;
    };

    // window load (todas as <img>, <link>, scripts iniciais)
    if (document.readyState === "complete") {
      tasks.push({ label: "window.load", done: true, startedAt: t0, doneAt: t0 });
      console.log("[LoadingScreen] ✓ window.load — já estava completo");
    } else {
      track(
        "window.load",
        new Promise<void>((resolve) => {
          const onLoad = () => {
            window.removeEventListener("load", onLoad);
            resolve();
          };
          window.addEventListener("load", onLoad);
        }),
      );
    }

    // fontes
    if ("fonts" in document) {
      track("document.fonts.ready", document.fonts.ready.then(() => undefined));
    }

    // promises externas (chunks, etc.)
    waitForRef.current.forEach((p, i) => track(`waitFor[${i}]`, p));

    // imagens pré-declaradas
    for (const src of preloadRef.current) {
      track(
        `img:${src}`,
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = img.onerror = () => resolve();
          img.src = src;
        }),
      );
    }

    // Relatório final quando tudo carregar
    Promise.all(
      tasks
        .filter((t) => !t.done)
        .map(
          (t) =>
            new Promise<void>((r) => {
              const check = () => (t.done ? r() : setTimeout(check, 50));
              check();
            }),
        ),
    ).then(() => {
      const total = performance.now() - t0;
      const rows = tasks
        .map((t) => ({
          task: t.label,
          ms: t.doneAt ? +(t.doneAt - t.startedAt).toFixed(0) : 0,
        }))
        .sort((a, b) => b.ms - a.ms);
      console.groupCollapsed(
        `[LoadingScreen] ⏱ tudo carregado em ${total.toFixed(0)}ms`,
      );
      console.table(rows);
      console.groupEnd();
    });


    const getProgress = () => {
      if (tasks.length === 0) return 1;
      const done = tasks.reduce((acc, t) => acc + (t.done ? 1 : 0), 0);
      return done / tasks.length;
    };

    async function play() {
      const row = rowRef.current!;
      const sq = sqRef.current!;
      const nameEl = nameRef.current!;
      const roleEl = roleRef.current!;
      const titleEl = titleRef.current!;
      const countEl = countRef.current!;
      const inkDrop = dropRef.current!;
      const inkSpread = spreadRef.current!;

      // Reset
      row.classList.remove("expand", "fade-out");
      inkDrop.classList.remove("fall");
      inkDrop.style.display = "";
      inkSpread.classList.remove("takeover");
      sq.classList.remove("hidden");
      nameEl.textContent = "LOADING";
      roleEl.textContent = "";
      titleEl.textContent = "";
      countEl.textContent = "000";

      // Phase 1 — contador acompanhando carregamento real
      await wait(300);
      if (cancelled) return;
      await runRealCounter(countEl, getProgress, { minDurationMs, maxDurationMs });
      if (cancelled) return;

      // Phase 2 — name morph
      sq.classList.add("hidden");
      const name = TARGETS.name;
      const t1 = morphWithTrigger(nameEl, name, 1500, name.length - 3, {
        initialText: "LOADING",
        settleHead: 0.35,
        settleTail: 0.95,
      });

      // Phase 3 — cascade
      await t1.triggerPromise;
      if (cancelled) return;
      const role = TARGETS.role;
      const t2 = morphWithTrigger(roleEl, role, 1700, role.length - 3, {
        settleHead: 0.3,
        settleTail: 0.95,
      });
      await t2.triggerPromise;
      if (cancelled) return;
      const title = TARGETS.title;
      const t3 = morphScramble(titleEl, title, 1300, {
        settleHead: 0.3,
        settleTail: 0.95,
      });

      await Promise.all([t1.fullPromise, t2.fullPromise, t3]);
      if (cancelled) return;

      await wait(260);
      if (cancelled) return;

      // Phase 4/5 — expand + ink drop choreography
      row.classList.add("expand");
      await wait(800);
      if (cancelled) return;
      inkDrop.classList.add("fall");
      await wait(1000);
      if (cancelled) return;

      // Impact
      inkDrop.style.display = "none";
      row.classList.add("fade-out");
      inkSpread.classList.add("takeover");

      await wait(1600);
      if (cancelled) return;

      setDone(true);
      onComplete?.();
    }

    play();
    return () => {
      cancelled = true;
    };
  }, [onComplete]);

  return (
    <div
      className={`ls-stage ${done ? "ls-done" : ""}`}
      aria-hidden={done}
      style={
        done && holdAfterComplete
          ? { background: exitColor, pointerEvents: "none" }
          : undefined
      }
    >
      <div className="ls-rail">
        <div className="ls-row" ref={rowRef}>
          <div className="ls-col ls-col-left">
            <div className="ls-cell">
              <span className="ls-sq" ref={sqRef}>
                ■
              </span>
              <span className="ls-val" ref={nameRef}>
                LOADING
              </span>
            </div>
            <div className="ls-cell">
              <span className="ls-val" ref={roleRef}></span>
            </div>
          </div>
          <div className="ls-col ls-col-right">
            <div className="ls-cell">
              <span className="ls-val" ref={titleRef}></span>
            </div>
            <div className="ls-cell ls-count">
              <span className="ls-val" ref={countRef}>
                000
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        className="ls-ink-drop"
        ref={dropRef}
        style={{ backgroundImage: `url('${dropSrc}')` }}
      />
      <div
        className="ls-ink-spread"
        ref={spreadRef}
        style={{ backgroundColor: exitColor }}
      />
    </div>
  );
}
