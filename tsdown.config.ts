import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/parser.ts',
    'src/writer.ts',
    'src/fastStream.ts',
    'src/transformStream.ts',
    'src/converters/lossy.ts',
    'src/converters/lossless.ts',
    'src/utilities/index.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
})
