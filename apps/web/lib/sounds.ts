let ctx: AudioContext | null = null;

async function getCtx(): Promise<AudioContext> {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Must await resume — calling start() on a suspended context produces silence
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
}

/** Single soft ding — played when a new message arrives (not from self, not active channel). */
export async function playMessagePing() {
  try {
    const c = await getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(1046, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, c.currentTime + 0.12);

    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, c.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.55);

    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.55);
  } catch {}
}

/** Repeating phone ring — call `stop()` to silence it. */
export function playRingtone(): () => void {
  let stopped = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  function burst(c: AudioContext, delay: number) {
    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    const gain = c.createGain();
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(c.destination);

    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(480, c.currentTime);
    osc2.frequency.setValueAtTime(440, c.currentTime);

    const t0 = c.currentTime + delay;
    const t1 = t0 + 0.4;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.35, t0 + 0.02);
    gain.gain.setValueAtTime(0.35, t1 - 0.04);
    gain.gain.linearRampToValueAtTime(0, t1);

    osc1.start(t0); osc1.stop(t1);
    osc2.start(t0); osc2.stop(t1);
  }

  async function ring() {
    if (stopped) return;
    try {
      const c = await getCtx();
      if (stopped) return;
      burst(c, 0);
      burst(c, 0.5);
    } catch {}
    const t = setTimeout(ring, 2800);
    timers.push(t);
  }

  ring();

  return () => {
    stopped = true;
    timers.forEach(clearTimeout);
  };
}
