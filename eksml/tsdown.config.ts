import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/parser.ts',
    'src/writer.ts',
    'src/sax.ts',
    'src/transformStream.ts',
    'src/converters/lossy.ts',
    'src/converters/lossless.ts',
    'src/converters/fromLossy.ts',
    'src/converters/fromLossless.ts',
    'src/utilities/index.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
});
