import { describe, expect, it } from "vitest";

import { decodeAll, float16 } from "../src/decode.ts";

function values(
  bytes: number[],
  littleEndian: boolean,
  available = bytes.length,
) {
  return Object.fromEntries(
    decodeAll(new Uint8Array(bytes), available, littleEndian).map((row) => [
      row.label,
      row.value,
    ]),
  );
}

describe("decodeAll", () => {
  const bytes = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08];

  it("reads little endian", () => {
    const v = values(bytes, true);
    expect(v.Binary).toBe("00000001");
    expect(v.Int8).toBe("1");
    expect(v.Uint8).toBe("1");
    expect(v.Int16).toBe("513");
    expect(v.Uint16).toBe("513");
    expect(v.Int32).toBe("67305985");
    expect(v.Uint32).toBe("67305985");
    expect(v.Int64).toBe("578437695752307201");
    expect(v.Uint64).toBe("578437695752307201");
  });

  it("reads big endian", () => {
    const v = values(bytes, false);
    expect(v.Int16).toBe("258");
    expect(v.Int32).toBe("16909060");
    expect(v.Int64).toBe("72623859790382856");
  });

  it("reads signed 8- and 16-bit extremes", () => {
    expect(values([0x80, 0x00], false).Int16).toBe("-32768");
    expect(values([0x7f, 0xff], false).Int16).toBe("32767");
    expect(values([0x80, 0x00], false).Uint16).toBe("32768");
    expect(values([0xff], true).Int8).toBe("-1");
    expect(values([0xff], true).Uint8).toBe("255");
  });

  it("reads 64-bit extremes", () => {
    const min = [0x80, 0, 0, 0, 0, 0, 0, 0];
    const max = [0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
    const ones = new Array(8).fill(0xff);
    expect(values(min, false).Int64).toBe("-9223372036854775808");
    expect(values(max, false).Int64).toBe("9223372036854775807");
    expect(values(ones, false).Uint64).toBe("18446744073709551615");
    expect(values(ones, false).Int64).toBe("-1");
  });

  it("matches DataView for floats", () => {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setFloat64(0, Math.PI, true);
    expect(values([...new Uint8Array(buffer)], true).Float64).toBe(
      String(Math.PI),
    );
    view.setFloat32(0, 1.5, false);
    expect(values([...new Uint8Array(buffer)], false).Float32).toBe("1.5");
  });

  it("gives null where the bytes run out", () => {
    const v = values([0x01, 0x02, 0x03], true);
    expect(v.Int16).toBe("513");
    expect(v.Int32).toBeNull();
    expect(v.Float64).toBeNull();
    const none = values([], true);
    expect(none.Binary).toBeNull();
  });

  it("honours available below the buffer length", () => {
    const v = values(bytes, true, 1);
    expect(v.Uint8).toBe("1");
    expect(v.Int16).toBeNull();
  });
});

describe("float16", () => {
  it("decodes normals, subnormals and specials", () => {
    expect(float16(0x3c00)).toBe(1);
    expect(float16(0xc000)).toBe(-2);
    expect(float16(0x0001)).toBe(2 ** -24);
    expect(float16(0x03ff)).toBe(1023 * 2 ** -24);
    expect(float16(0x7bff)).toBe(65504);
    expect(float16(0x7c00)).toBe(Infinity);
    expect(float16(0xfc00)).toBe(-Infinity);
    expect(float16(0x7e00)).toBeNaN();
    expect(Object.is(float16(0x8000), -0)).toBe(true);
  });

  it("feeds the Float16 row in both endiannesses", () => {
    expect(values([0x00, 0x3c], true).Float16).toBe("1");
    expect(values([0x3c, 0x00], false).Float16).toBe("1");
    expect(values([0x00, 0x80], true).Float16).toBe("-0");
  });
});
