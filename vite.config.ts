import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: "examples",
  resolve: {
    alias: {
      "#src": resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    outDir: resolve(import.meta.dirname, "examples-dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "examples/index.html"),
        parse: resolve(import.meta.dirname, "examples/parse.html"),
        "fast-stream": resolve(import.meta.dirname, "examples/fast-stream.html"),
        "transform-stream": resolve(
          import.meta.dirname,
          "examples/transform-stream.html",
        ),
      },
    },
  },
});
