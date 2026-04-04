import Component from '@glimmer/component';

import { modifier } from 'ember-modifier';
import { init } from 'modern-monaco';

interface MonacoEditorSignature {
  Args: {
    language?: string;
    readOnly?: boolean;
    content?: string;
    onChange?: (value: string) => void;
    onReady?: (editor: MonacoEditorInstance, monaco: MonacoApi) => void;
  };
  Element: HTMLDivElement;
}

type MonacoApi = Awaited<ReturnType<typeof init>>;
type MonacoEditorInstance = ReturnType<MonacoApi['editor']['create']>;

const EDITOR_THEME = 'vitesse-dark';

let monacoInstance: MonacoApi | null = null;

async function getMonaco(): Promise<MonacoApi> {
  if (!monacoInstance) {
    monacoInstance = await init();
  }

  return monacoInstance;
}

export default class MonacoEditor extends Component<MonacoEditorSignature> {
  private editor: MonacoEditorInstance | null = null;
  private model: ReturnType<MonacoApi['editor']['createModel']> | null = null;
  private suppressChange = false;
  private destroyed = false;

  private setupEditor = modifier((element: HTMLDivElement) => {
    this.destroyed = false;

    const setup = async () => {
      const monaco = await getMonaco();

      if (this.destroyed) return;

      const language = this.args.language ?? 'xml';

      this.model = monaco.editor.createModel(this.args.content ?? '', language);

      this.editor = monaco.editor.create(element, {
        automaticLayout: true,
        fontSize: 13,
        lineHeight: 1.5,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        padding: { top: 10 },
        theme: EDITOR_THEME,
        readOnly: this.args.readOnly ?? false,
        tabSize: 2,
        model: this.model,
      });

      if (this.destroyed) {
        this.editor.dispose();
        this.model.dispose();
        this.editor = null;
        this.model = null;

        return;
      }

      if (this.args.onChange) {
        const onChange = this.args.onChange;

        this.model.onDidChangeContent(() => {
          if (!this.suppressChange && this.model) {
            onChange(this.model.getValue());
          }
        });
      }

      if (this.args.onReady) {
        this.args.onReady(this.editor, monaco);
      }
    };

    void setup();

    return () => {
      this.destroyed = true;
      this.editor?.dispose();
      this.model?.dispose();
      this.editor = null;
      this.model = null;
    };
  });

  updateContent = modifier((element: HTMLDivElement) => {
    void element;

    const content = this.args.content ?? '';

    if (this.model && this.model.getValue() !== content) {
      this.suppressChange = true;
      this.model.setValue(content);
      this.suppressChange = false;
    }
  });

  <template>
    <div
      class='editor-container'
      {{this.setupEditor}}
      {{this.updateContent}}
      ...attributes
    ></div>
  </template>
}
