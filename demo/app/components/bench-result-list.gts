import Component from '@glimmer/component';

import BenchResultRow from '#components/bench-result-row.gts';
import autoAnimate from '#modifiers/auto-animate.ts';

import type { BenchResult } from '#utils/bench-result.ts';

// ---------------------------------------------------------------------------
// Signature
// ---------------------------------------------------------------------------

interface BenchResultListSignature {
  Args: {
    results: BenchResult[];
    running: boolean;
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default class BenchResultList extends Component<BenchResultListSignature> {
  get sortedResults(): BenchResult[] {
    return [...this.args.results].sort((a, b) => b.iterations - a.iterations);
  }

  get maxIterations(): number {
    let max = 0;

    for (const r of this.args.results) {
      if (r.iterations > max) max = r.iterations;
    }

    return max;
  }

  get completedCount(): number {
    return this.args.results.filter(
      (r) => r.status === 'done' || r.status === 'error',
    ).length;
  }

  get totalCount(): number {
    return this.args.results.length;
  }

  get hasResults(): boolean {
    return this.args.results.length > 0;
  }

  // ------- Template -------

  <template>
    <div class='pane-header'>
      <span>Results</span>
      {{#if @running}}
        <span class='bench-progress-text'>
          {{this.completedCount}}/{{this.totalCount}}
          complete
        </span>
      {{/if}}
    </div>

    <div class='bench-results' {{autoAnimate}}>
      {{#if this.hasResults}}
        {{#each this.sortedResults key='id' as |result|}}
          <BenchResultRow
            @result={{result}}
            @maxIterations={{this.maxIterations}}
          />
        {{/each}}
      {{else}}
        <div class='bench-empty'>
          Click "Run Benchmark" to start comparing parsers.
        </div>
      {{/if}}
    </div>
  </template>
}
