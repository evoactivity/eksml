/**
 * Minimal declarations for benchmark competitors that ship no types.
 * Only the surface used by the benchmarks is declared.
 */

declare module '@tuananh/sax-parser' {
  class SaxParser {
    on(event: string, listener: (...args: never[]) => void): this;
    write(data: string | null): void;
    end(data?: string | null): void;
  }
  export default SaxParser;
}

declare module 'easysax' {
  class EasySax {
    on(event: string, listener: (...args: never[]) => void): void;
    write(chunk: string): void;
    end(): void;
  }
  export default EasySax;
}
