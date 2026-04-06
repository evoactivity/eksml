import type { Phase } from '#utils/parser-stepper.ts';

export function phaseLabel(phase: Phase): string {
  switch (phase) {
    case 'idle':
      return 'Idle';
    case 'scanning':
      return 'Scanning';
    case 'open-tag-start':
      return 'Found <';
    case 'reading-tag-name':
      return 'Reading tag name';
    case 'reading-attr-name':
      return 'Reading attribute name';
    case 'reading-attr-value':
      return 'Reading attribute value';
    case 'open-tag-end':
      return 'Tag opened';
    case 'self-close':
      return 'Self-closing tag';
    case 'close-tag':
      return 'Closing tag';
    case 'reading-text':
      return 'Reading text';
    case 'reading-comment':
      return 'Comment';
    case 'reading-cdata':
      return 'CDATA section';
    case 'reading-doctype':
      return 'Declaration';
    case 'error':
      return 'Error';
    case 'done':
      return 'Complete';
  }
}

export function phaseColor(phase: Phase): string {
  switch (phase) {
    case 'open-tag-start':
    case 'reading-tag-name':
    case 'open-tag-end':
      return 'vis-phase-tag';
    case 'reading-attr-name':
    case 'reading-attr-value':
      return 'vis-phase-attr';
    case 'close-tag':
      return 'vis-phase-close';
    case 'reading-text':
      return 'vis-phase-text';
    case 'reading-comment':
      return 'vis-phase-comment';
    case 'reading-cdata':
      return 'vis-phase-cdata';
    case 'reading-doctype':
      return 'vis-phase-pi';
    case 'self-close':
      return 'vis-phase-selfclose';
    case 'error':
      return 'vis-phase-error';
    case 'done':
      return 'vis-phase-done';
    default:
      return 'vis-phase-idle';
  }
}
