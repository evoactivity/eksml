import Component from '@glimmer/component';
import { htmlSafe } from '@ember/template';

import { formatNumber } from '#utils/bench-result.ts';

import type { BenchResult } from '#utils/bench-result.ts';

// ---------------------------------------------------------------------------
// Signature
// ---------------------------------------------------------------------------

interface BenchResultRowSignature {
  Args: {
    result: BenchResult;
    maxIterations: number;
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default class BenchResultRow extends Component<BenchResultRowSignature> {
  // ------- Status predicates -------

  get isRunning(): boolean {
    return this.args.result.status === 'running';
  }

  get isPending(): boolean {
    return this.args.result.status === 'pending';
  }

  get isDone(): boolean {
    return this.args.result.status === 'done';
  }

  get isError(): boolean {
    return this.args.result.status === 'error';
  }

  // ------- Display values -------

  get barWidth(): ReturnType<typeof htmlSafe> {
    const max = this.args.maxIterations;
    const iters = this.args.result.iterations;

    if (max === 0 || iters === 0) return htmlSafe('width: 0%');

    const pct = (iters / max) * 100;

    return htmlSafe(`width: ${pct.toFixed(1)}%`);
  }

  get barColor(): ReturnType<typeof htmlSafe> {
    return htmlSafe(`background: ${this.args.result.def.color}`);
  }

  get iterationsText(): string {
    const r = this.args.result;

    if (r.status === 'error') return `Error: ${r.errorMessage}`;
    if (r.status === 'pending') return 'Waiting...';
    if (r.status === 'running') return 'Running...';

    return `${formatNumber(r.iterations)} iterations`;
  }

  get opsText(): string {
    const r = this.args.result;

    if (r.status !== 'done') return '';

    return `${formatNumber(Math.round(r.opsPerSec))} ops/s`;
  }

  // ------- Template -------

  <template>
    <div
      class='bench-row
        {{if this.isRunning "bench-running"}}
        {{if this.isPending "bench-pending"}}
        {{if this.isError "bench-error"}}'
    >
      <div class='bench-row-header'>
        <span class='bench-parser-name'>
          {{#if this.isRunning}}
            <span class='bench-spinner'></span>
          {{/if}}
          {{@result.def.label}}
        </span>
        <div class='bench-iterations'>
          {{this.iterationsText}}
          <span class='bench-ops'>{{this.opsText}}</span>
        </div>

      </div>

      <div class='bench-bar-track'>
        <div class='bench-bar-fill' style={{this.barWidth}}>
          <div class='bench-bar-color' style={{this.barColor}}></div>
        </div>
      </div>

    </div>
  </template>
}
