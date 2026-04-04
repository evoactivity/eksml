declare module 'txml' {
  interface TNode {
    tagName: string;
    attributes: Record<string, string>;
    children: (TNode | string)[];
  }

  interface TParseOptions {
    keepComments?: boolean;
    keepWhitespace?: boolean;
    simplify?: boolean;
    noChildNodes?: string[];
    setPos?: boolean;
    filter?: (node: TNode) => boolean;
  }

  export function parse(
    xml: string,
    options?: TParseOptions,
  ): (TNode | string)[];
}
