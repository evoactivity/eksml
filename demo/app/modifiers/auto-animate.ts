import { modifier } from 'ember-modifier';

export default modifier(function autoAnimate(
  element: HTMLElement,
  _,
  named: { duration?: number },
) {
  void (async () => {
    let { duration } = named;

    if ((duration && typeof duration !== 'number') || !duration) {
      duration = 250;
    }

    const autoAnimate = (await import('@formkit/auto-animate')).default;

    autoAnimate(element, { duration });
  })();
});
