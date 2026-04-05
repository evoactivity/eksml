import Component from '@glimmer/component';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';

interface DurationOption {
  value: string;
  label: string;
}

const OPTIONS: DurationOption[] = [
  { value: '500', label: '500 ms' },
  { value: '1000', label: '1 s' },
  { value: '2000', label: '2 s' },
  { value: '5000', label: '5 s' },
  { value: '10000', label: '10 s' },
];

interface DurationSelectSignature {
  Args: {
    value: string;
    onChange: (value: string) => void;
  };
}
export default class DurationSelect extends Component<DurationSelectSignature> {
  isSelected = (optionValue: string): boolean => {
    return this.args.value === optionValue;
  };

  handleChange = (onChange: (value: string) => void, event: Event): void => {
    onChange((event.target as HTMLSelectElement).value);
  };

  <template>
    <label for='duration'>Duration per parser</label>
    <select id='duration' {{on 'change' (fn this.handleChange @onChange)}}>
      {{#each OPTIONS as |opt|}}
        <option value={{opt.value}} selected={{this.isSelected opt.value}}>
          {{opt.label}}
        </option>
      {{/each}}
    </select>
  </template>
}
