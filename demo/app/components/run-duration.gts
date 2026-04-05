import Component from '@glimmer/component';

function formatMicroseconds(us: number): string {
  if (us < 1000) return `${us.toFixed(1)} µs`;
  if (us < 1_000_000) return `${Math.round(us / 1000)} ms`;

  return `${(us / 1_000_000).toFixed(1)} s`;
}

/** Format a millisecond duration for display. */
export function formatMs(ms: number): string {
  const us = ms * 1000;

  return us < 1000 ? '< 1 ms' : formatMicroseconds(us);
}

interface RunDurationSignature {
  Args: {
    /** Elapsed time in milliseconds (from performance.now delta) */
    ms: number | null;
  };
}
export default class RunDuration extends Component<RunDurationSignature> {
  get display(): string {
    const ms = this.args.ms;

    if (ms == null) return '';

    return formatMs(ms);
  }

  <template>
    <span class='timing'>{{this.display}}</span>
  </template>
}
