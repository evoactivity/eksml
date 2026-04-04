import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/eksml.ts',
    'src/parser.ts',
    'src/writer.ts',
    'src/fastStream.ts',
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
