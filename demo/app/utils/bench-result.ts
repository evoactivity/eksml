import { tracked } from '@glimmer/tracking';

import type { ParserDef } from '../routes/benchmark';

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export type BenchStatus = 'pending' | 'running' | 'done' | 'error';

export class BenchResult {
  def: ParserDef;
  id: string = crypto.randomUUID();
  @tracked iterations = 0;
  @tracked elapsed = 0;
  @tracked status: BenchStatus = 'pending';
  @tracked errorMessage = '';

  constructor(def: ParserDef) {
    this.def = def;
  }

  get opsPerSec(): number {
    if (this.elapsed === 0) return 0;

    return (this.iterations / this.elapsed) * 1000;
  }
}
