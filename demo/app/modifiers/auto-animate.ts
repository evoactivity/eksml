import { modifier } from 'ember-modifier';

// const opacityAnimation: AutoAnimationPlugin = (currentElement, action) => {
//   let keyframes: Keyframe[] = [];

//   if (action === 'add') {
//     keyframes = [{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }];
//   }

//   if (action === 'remove') {
//     keyframes = [{ opacity: 1 }, { opacity: 0 }];
//   }

//   return new KeyframeEffect(currentElement, keyframes, {
//     duration: action === 'add' ? 500 * 2 : 500,
//     easing: 'ease-in-out',
//   });
// };

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
