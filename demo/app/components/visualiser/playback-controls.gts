import { on } from '@ember/modifier';

import type { TOC } from '@ember/component/template-only';

interface PlaybackControlsSignature {
  Args: {
    playing: boolean;
    atStart: boolean;
    atEnd: boolean;
    speed: number;
    speedLabel: string;
    stepDisplay: number;
    totalSteps: number;
    stepIndex: number;
    maxStepIndex: number;
    onPlay: () => void;
    onPause: () => void;
    onStepForward: () => void;
    onStepBackward: () => void;
    onReset: () => void;
    onSpeedChange: (event: Event) => void;
    onSliderChange: (event: Event) => void;
  };
}

const PlaybackControls: TOC<PlaybackControlsSignature> = <template>
  <div class='controls'>
    <button class='primary' {{on 'click' (if @playing @onPause @onPlay)}}>
      {{if @playing 'Pause' 'Play'}}
    </button>
    <button disabled={{@atStart}} {{on 'click' @onStepBackward}}>
      Prev
    </button>
    <button disabled={{@atEnd}} {{on 'click' @onStepForward}}>
      Next
    </button>
    <button {{on 'click' @onReset}}>Reset</button>

    <label for='vis-speed'>Speed</label>
    <input
      type='range'
      id='vis-speed'
      min='10'
      max='800'
      step='10'
      value={{@speed}}
      {{on 'input' @onSpeedChange}}
    />
    <span class='vis-speed-label'>{{@speedLabel}}</span>

    <span class='vis-step-counter'>
      Step
      {{@stepDisplay}}
      /
      {{@totalSteps}}
    </span>

    <div class='vis-slider-row'>
      <input
        type='range'
        class='vis-timeline'
        min='0'
        max={{@maxStepIndex}}
        value={{@stepIndex}}
        {{on 'input' @onSliderChange}}
      />
    </div>
  </div>
</template>;

export default PlaybackControls;
