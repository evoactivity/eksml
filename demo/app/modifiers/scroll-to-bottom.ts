import { modifier } from 'ember-modifier';

/**
 * Scrolls the element to the bottom whenever the tracked `count` changes.
 *
 * Usage:
 *   <div {{scrollToBottom @entries.length}}>...</div>
 */
const scrollToBottom = modifier((element: HTMLElement, [count]: [number]) => {
  void count;
  element.scrollTop = element.scrollHeight;
});

export default scrollToBottom;
