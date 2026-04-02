import type { TNode, ParseOptions } from "./txml.js";
import { parse } from "./txml.js";

/**
 * Internal type for the parse result when setPos is true.
 * When setPos is enabled, parse returns a TNode with an additional `pos` property.
 */
interface TNodeWithPos extends TNode {
  pos: number;
}

/**
 * Create a TransformStream that incrementally parses XML chunks.
 * Uses the Web Streams API, which is available in browsers, Node.js 18+, Deno, and Bun.
 *
 * @param offset - Starting offset or string whose length is the offset
 * @param parseOptions - Options for the XML parser
 * @returns TransformStream that emits parsed XML nodes
 */
export function transformStream(
  offset?: number | string,
  parseOptions?: ParseOptions,
): TransformStream<string, TNode | string> {
  const opts: ParseOptions = parseOptions ? { ...parseOptions } : {};
  let position: number =
    typeof offset === "string" ? offset.length : offset || 0;
  let data = "";

  return new TransformStream<string, TNode | string>({
    transform(
      chunk: string,
      controller: TransformStreamDefaultController<TNode | string>,
    ): void {
      data += chunk;
      let lastPos = 0;

      while (true) {
        position = data.indexOf("<", position) + 1;

        if (!position) {
          position = lastPos;
          return;
        }

        if (data[position] === "/") {
          position = position + 1;
          lastPos = position;
          continue;
        }

        if (
          data[position] === "!" &&
          data[position + 1] === "-" &&
          data[position + 2] === "-"
        ) {
          const commentEnd = data.indexOf("-->", position + 3);
          if (commentEnd === -1) {
            data = data.slice(lastPos);
            position = 0;
            return;
          }

          if (opts.keepComments) {
            controller.enqueue(data.substring(position - 1, commentEnd + 3));
          }

          position = commentEnd + 1;
          lastPos = commentEnd;
          continue;
        }

        const res = parse(data, {
          ...opts,
          pos: position - 1,
          parseNode: true,
          setPos: true,
        }) as TNodeWithPos;

        position = res.pos;

        if (position > data.length - 1 || position < lastPos) {
          data = data.slice(lastPos);
          position = 0;
          return;
        } else {
          controller.enqueue(res);
          lastPos = position;
        }
      }
    },
    flush(
      controller: TransformStreamDefaultController<TNode | string>,
    ): void {
      // Emit any remaining buffered node that was deferred during transform.
      if (!data) return;
      position = data.indexOf("<", position) + 1;
      while (position) {
        if (data[position] === "/") {
          position = position + 1;
          continue;
        }

        if (
          data[position] === "!" &&
          data[position + 1] === "-" &&
          data[position + 2] === "-"
        ) {
          const commentEnd = data.indexOf("-->", position + 3);
          if (commentEnd === -1) return;
          if (opts.keepComments) {
            controller.enqueue(data.substring(position - 1, commentEnd + 3));
          }
          position = commentEnd + 1;
          position = data.indexOf("<", position) + 1;
          continue;
        }

        const res = parse(data, {
          ...opts,
          pos: position - 1,
          parseNode: true,
          setPos: true,
        }) as TNodeWithPos;

        controller.enqueue(res);
        position = res.pos;
        position = data.indexOf("<", position) + 1;
      }
    },
  });
}
