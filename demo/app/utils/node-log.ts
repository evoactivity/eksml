import { tracked } from '@glimmer/tracking';

/**
 * Tracked model for an expandable node entry in the stream log.
 *
 * `expanded` and `colorizedJson` are @tracked so Glimmer re-renders
 * when they change (e.g. user clicks to expand, or async colorization
 * completes).
 */
export class NodeEntry {
  id: number;
  node: unknown;
  summary: string;
  json: string;
  @tracked colorizedJson: string | null;
  @tracked expanded: boolean;

  constructor(id: number, node: unknown, summary: string, json: string) {
    this.id = id;
    this.node = node;
    this.summary = summary;
    this.json = json;
    this.colorizedJson = null;
    this.expanded = false;
  }
}

export interface LogItem {
  type: 'node' | 'chunk' | 'done';
  entry?: NodeEntry;
  text?: string;
}
