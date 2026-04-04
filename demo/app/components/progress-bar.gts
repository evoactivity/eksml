import { concat } from '@ember/helper';
import { htmlSafe } from '@ember/template';

import type { TOC } from '@ember/component/template-only';

interface ProgressBarSignature {
  Args: {
    percent: number;
  };
}

const ProgressBar: TOC<ProgressBarSignature> = <template>
  <div class='progress-bar'>
    <div
      class='fill'
      style='{{htmlSafe (concat "width: " @percent "%")}}'
    ></div>
  </div>
</template>;

export default ProgressBar;
