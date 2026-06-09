import assert from "node:assert/strict";
import test from "node:test";
import { deflateSync } from "node:zlib";

import { decodePngRgba } from "../src/lib/png-rgba";

test("decodePngRgba decodes unfiltered RGBA PNG pixels", () => {
  const png = buildPng({
    width: 2,
    height: 1,
    colorType: 6,
    rows: [Buffer.from([0, 255, 0, 0, 255, 10, 20, 30, 255])],
  });

  const image = decodePngRgba(png);

  assert.equal(image.width, 2);
  assert.equal(image.height, 1);
  assert.deepEqual([...image.pixels], [255, 0, 0, 255, 10, 20, 30, 255]);
});

test("decodePngRgba applies PNG row filters", () => {
  const png = buildPng({
    width: 2,
    height: 1,
    colorType: 6,
    rows: [Buffer.from([1, 10, 20, 30, 255, 5, 5, 5, 0])],
  });

  const image = decodePngRgba(png);

  assert.deepEqual([...image.pixels], [10, 20, 30, 255, 15, 25, 35, 255]);
});

test("decodePngRgba rejects non-PNG input", () => {
  assert.throws(() => decodePngRgba(Buffer.from("not-png")), /not a PNG/);
});

function buildPng(input: { width: number; height: number; colorType: 2 | 6; rows: Buffer[] }) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(input.width, 0);
  ihdr.writeUInt32BE(input.height, 4);
  ihdr[8] = 8;
  ihdr[9] = input.colorType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(input.rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer) {
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  output.write(type, 4, 4, "ascii");
  data.copy(output, 8);
  output.writeUInt32BE(0, 8 + data.length);
  return output;
}
