/** Owns the short visual hand-off after a decision and invalidates stale work. */
export interface TransitionClock {
  set(callback: () => void, delay: number): unknown;
  clear(handle: unknown): void;
}

const browserClock: TransitionClock = {
  set: (callback, delay) => window.setTimeout(callback, delay),
  clear: handle => window.clearTimeout(handle as number),
};

export function createDecisionTransition(clock: TransitionClock = browserClock) {
  let generation = 0;
  let timer: unknown;
  let locked = false;

  return {
    get locked() { return locked; },
    begin(): number | null {
      if (locked) return null;
      locked = true;
      generation += 1;
      return generation;
    },
    finish(token: number, callback: () => void, delay = 150): void {
      if (!locked || token !== generation) return;
      timer = clock.set(() => {
        timer = undefined;
        if (token !== generation) return;
        locked = false;
        callback();
      }, delay);
    },
    cancel(): void {
      generation += 1;
      if (timer !== undefined) clock.clear(timer);
      timer = undefined;
      locked = false;
    },
  };
}
