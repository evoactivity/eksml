import '../styles/visualiser.css';

import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import pageTitle from 'ember-page-title/helpers/page-title';

import TwoPaneLayout from '#components/two-pane-layout.gts';
import PlaybackControls from '#components/visualiser/playback-controls.gts';
import SourcePane from '#components/visualiser/source-pane.gts';
import StatePane from '#components/visualiser/state-pane.gts';
import { generateSteps } from '#utils/parser-stepper.ts';

import type { VisualiseModel } from '../routes/visualise';
import type Owner from '@ember/owner';
import type { Step } from '#utils/parser-stepper.ts';

interface VisualiseTemplateSignature {
  Args: {
    model: VisualiseModel;
  };
}

class VisualiseTemplate extends Component<VisualiseTemplateSignature> {
  @tracked inputContent = '';
  @tracked steps: Step[] = [];
  @tracked stepIndex = 0;
  @tracked playing = false;
  @tracked speed = 150;

  private timerId: ReturnType<typeof setTimeout> | null = null;

  constructor(owner: Owner, args: VisualiseTemplateSignature['Args']) {
    super(owner, args);
    this.inputContent = this.args.model.defaultXml;
    this.regenerate();
  }

  willDestroy(): void {
    super.willDestroy();
    this.stopPlayback();
  }

  get currentStep(): Step {
    return (
      (this.steps[this.stepIndex] ?? this.steps[0]) || {
        pos: 0,
        phase: 'idle',
        description: '',
        highlight: [0, 0],
        stack: [],
        currentTagName: '',
        currentAttrName: '',
        currentAttrValue: '',
        currentAttributes: {},
        nodesEmitted: 0,
      }
    );
  }

  get totalSteps(): number {
    return this.steps.length;
  }

  get maxStepIndex(): number {
    return Math.max(0, this.steps.length - 1);
  }

  get stepDisplay(): number {
    return this.stepIndex + 1;
  }

  get atEnd(): boolean {
    return this.stepIndex >= this.steps.length - 1;
  }

  get atStart(): boolean {
    return this.stepIndex === 0;
  }

  get attributes(): { name: string; value: string | null }[] {
    const attrs = this.currentStep.currentAttributes;
    const keys = Object.keys(attrs);

    return keys.map((k) => ({ name: k, value: attrs[k] ?? null }));
  }

  get speedLabel(): string {
    if (this.speed <= 50) return 'Fast';
    if (this.speed <= 150) return 'Normal';
    if (this.speed <= 400) return 'Slow';

    return 'Very slow';
  }

  get sliderSpeed(): number {
    return 810 - this.speed;
  }

  private regenerate(): void {
    this.steps = generateSteps(this.inputContent);
    this.stepIndex = 0;
    this.stopPlayback();
  }

  private stopPlayback(): void {
    this.playing = false;

    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private scheduleNext(): void {
    if (!this.playing || this.atEnd) {
      this.playing = false;

      return;
    }

    this.timerId = setTimeout(() => {
      if (!this.playing) return;
      this.stepIndex++;

      if (this.atEnd) {
        this.playing = false;
      } else {
        this.scheduleNext();
      }
    }, this.speed);
  }

  play = (): void => {
    if (this.atEnd) {
      this.stepIndex = 0;
    }

    this.playing = true;
    this.scheduleNext();
  };

  pause = (): void => {
    this.stopPlayback();
  };

  stepForward = (): void => {
    this.stopPlayback();

    if (!this.atEnd) {
      this.stepIndex++;
    }
  };

  stepBackward = (): void => {
    this.stopPlayback();

    if (!this.atStart) {
      this.stepIndex--;
    }
  };

  reset = (): void => {
    this.stopPlayback();
    this.stepIndex = 0;
  };

  onSpeedChange = (event: Event): void => {
    this.speed = 810 - parseInt((event.target as HTMLInputElement).value, 10);
  };

  onSliderChange = (event: Event): void => {
    this.stopPlayback();
    this.stepIndex = parseInt((event.target as HTMLInputElement).value, 10);
  };

  onSourceChange = (value: string): void => {
    this.inputContent = value;
    this.regenerate();
  };

  <template>
    {{pageTitle 'Visualise'}}
    <h1>Visualise Parser</h1>
    <p class='subtitle'>
      Step through the XML parser algorithm character by character. See what the
      parser sees at each point.
    </p>

    <PlaybackControls
      @playing={{this.playing}}
      @atStart={{this.atStart}}
      @atEnd={{this.atEnd}}
      @speed={{this.sliderSpeed}}
      @speedLabel={{this.speedLabel}}
      @stepDisplay={{this.stepDisplay}}
      @totalSteps={{this.totalSteps}}
      @stepIndex={{this.stepIndex}}
      @maxStepIndex={{this.maxStepIndex}}
      @onPlay={{this.play}}
      @onPause={{this.pause}}
      @onStepForward={{this.stepForward}}
      @onStepBackward={{this.stepBackward}}
      @onReset={{this.reset}}
      @onSpeedChange={{this.onSpeedChange}}
      @onSliderChange={{this.onSliderChange}}
    />

    <TwoPaneLayout>
      <:left>
        <SourcePane
          @step={{this.currentStep}}
          @stepIndex={{this.stepIndex}}
          @source={{this.inputContent}}
          @onChange={{this.onSourceChange}}
        />
      </:left>

      <:right>
        <StatePane
          @phase={{this.currentStep.phase}}
          @description={{this.currentStep.description}}
          @nodesEmitted={{this.currentStep.nodesEmitted}}
          @tagName={{this.currentStep.currentTagName}}
          @attributes={{this.attributes}}
          @stack={{this.currentStep.stack}}
        />
      </:right>
    </TwoPaneLayout>
  </template>
}

export default VisualiseTemplate;
