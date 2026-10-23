import { describe, expect, it } from "vitest";

import {
  detectLevel,
  LEVEL_INHERITED,
  LEVELS,
  type LevelMatch,
  type LogLevel,
  levelCode,
  levelOfCode,
  stripAnsi,
} from "../../src/parse/index.ts";
import { LOG_SAMPLE } from "./log-sample.ts";

/** `«…»` marks the range the detector should return; the marks are removed. */
function expected(
  marked: string,
  level: LogLevel | null,
): [string, LevelMatch | null] {
  const from = marked.indexOf("«");
  const to = marked.indexOf("»") - 1;
  const text = marked.replace("«", "").replace("»", "");
  if (!level) return [text, null];
  return [text, from < 0 ? { level } : { level, from, to }];
}

const check = (marked: string, level: LogLevel | null) => {
  const [text, match] = expected(marked, level);
  expect(detectLevel(text)).toEqual(match);
};

describe("level codes", () => {
  it("numbers the levels 1 to 6, fatal first", () => {
    expect(LEVELS).toEqual([
      "fatal",
      "error",
      "warn",
      "info",
      "debug",
      "trace",
    ]);
    LEVELS.forEach((level, i) => {
      expect(levelCode(level)).toBe(i + 1);
      expect(levelOfCode(i + 1)).toBe(level);
      expect(levelOfCode((i + 1) | LEVEL_INHERITED)).toBe(level);
    });
  });

  it("maps 0 and unknown codes to null", () => {
    expect(LEVEL_INHERITED).toBe(0x80);
    expect(levelOfCode(0)).toBeNull();
    expect(levelOfCode(LEVEL_INHERITED)).toBeNull();
    expect(levelOfCode(7)).toBeNull();
    expect(levelCode("loud" as LogLevel)).toBe(0);
  });
});

describe("detectLevel", () => {
  describe("rule 1: JSON lines", () => {
    it.each<[string, LogLevel | null]>([
      ['{"level":"«error»","msg":"upload failed"}', "error"],
      ['{"lvl":"«warn»","msg":"slow"}', "warn"],
      ['{"severity":"«ERROR»","message":"x"}', "error"],
      ['{"loglevel":"«debug»","msg":"x"}', "debug"],
      ['{"Level":"«Information»","msg":"x"}', "info"],
      ['{"level" : "«info»"}', "info"],
      ['{"time":"2026-10-23T09:14:07Z","level":"«trace»"}', "trace"],
      ['{"msg":"x","severity":"«critical»"}', "fatal"],
      // A key whose value is not a level word gives way to the next one.
      ['{"severity":"high","level":"«warn»"}', "warn"],
      // The level key wins over an uppercase word earlier in the line.
      ['{"msg":"retry after ERROR","level":"«info»"}', "info"],
      ['{"level":"«info»","msg":"ERROR in an INFO block"}', "info"],
      // No usable key: the later rules apply.
      ['{"level":"loud","msg":"«ERROR» here"}', "error"],
      ['{"msg":"no errors expected","count":3}', null],
      [' {"level":"error"}', null],
    ])("%s", check);

    it.each<[string, LogLevel]>([
      ['{"level":«70»,"msg":"x"}', "fatal"],
      ['{"level":«60»,"msg":"x"}', "fatal"],
      ['{"level":«59»,"msg":"x"}', "error"],
      ['{"level":«50»,"msg":"x"}', "error"],
      ['{"level":«40»,"msg":"x"}', "warn"],
      ['{"level":«30»,"time":1761210848000,"pid":4121}', "info"],
      ['{"level":«20»,"msg":"x"}', "debug"],
      ['{"level":«19»,"msg":"x"}', "trace"],
      ['{"level":«10»,"msg":"x"}', "trace"],
      ['{"level":«0»,"msg":"x"}', "trace"],
      ['{"name":"app","hostname":"host-one","level":«50»}', "error"],
      ['{"lvl": «40»}', "warn"],
    ])("pino / bunyan %s", check);
  });

  describe("rule 2: logfmt", () => {
    it.each<[string, LogLevel | null]>([
      ["level=«warn» ts=2026-10-23T09:14:06Z attempt=2", "warn"],
      ['ts=2026-10-23T09:14:05Z level=«error» msg="x"', "error"],
      ['level="«info»" msg="cache warmed"', "info"],
      ["lvl=«dbg» msg=x", "debug"],
      ["severity=«critical» msg=x", "fatal"],
      ['msg="x" level=«TRACE»', "trace"],
      ["time=x\tlevel=«notice»", "info"],
      ["severity=high level=«warn»", "warn"],
      // The key must open the line or follow a space.
      ["xlevel=error", null],
      ['msg="x"level=error', null],
      ["level=loud msg=x", null],
    ])("%s", check);
  });

  describe("rule 3: syslog priority", () => {
    it.each<[string, LogLevel | null]>([
      ["«<0>»Oct 23 09:14:10 host-one kernel: x", "fatal"],
      ["«<1>»Oct 23 09:14:10 host-one kernel: x", "fatal"],
      ["«<2>»Oct 23 09:14:10 host-one kernel: x", "fatal"],
      ["«<3>»Oct 23 09:14:10 host-one kernel: disk I/O error on sdb", "error"],
      ["«<4>»Oct 23 09:14:10 host-one kernel: x", "warn"],
      ["«<5>»Oct 23 09:14:10 host-one kernel: x", "info"],
      ["«<6>»Oct 23 09:14:10 host-one kernel: x", "info"],
      ["«<7>»Oct 23 09:14:10 host-one kernel: x", "debug"],
      ["«<11>»1 2026-10-23T09:14:10Z host-one app - - x", "error"],
      ["«<86>»Oct 23 09:14:10 host-one sshd: x", "info"],
      ["«<191>»Oct 23 09:14:10 host-one app: x", "debug"],
      // Past 191 it is not a priority, and the rules after it apply.
      ["<192>Oct 23 09:14:10 host-one app: x", null],
      ["<192>Oct 23 09:14:10 host-one app: «ERROR»", "error"],
      [" <3>Oct 23 09:14:10 host-one kernel: x", null],
    ])("%s", check);
  });

  describe("rule 4: glog / klog", () => {
    it.each<[string, LogLevel | null]>([
      ["«I»1023 09:14:11.000123    4121 main.go:12] started", "info"],
      ["«W»1023 09:14:11.000123    4121 main.go:12] slow", "warn"],
      ["«E»1023 09:14:11.000123    4121 controller.go:212] failed", "error"],
      ["«F»0101 00:00:00.000000    1 main.go:1] gave up", "fatal"],
      ["«E»1231 23:59:59 x", "error"],
      ["X1023 09:14:11.000123 x", null],
      ["I1023 09:14 x", null],
    ])("%s", check);
  });

  describe("rule 5: Android logcat", () => {
    it.each<[string, LogLevel | null]>([
      ["«V»/Choreographer( 1234): frame", "trace"],
      ["«D»/NetworkMonitor( 812): probe", "debug"],
      ["«I»/ActivityManager(  585): Starting activity", "info"],
      ["«W»/System(12345): slow", "warn"],
      ["«E»/AndroidRuntime( 1234): FATAL EXCEPTION: main", "error"],
      ["«F»/libc( 1234): Fatal signal 11", "fatal"],
      ["«A»/libc( 1234): abort", "fatal"],
      ["«I»/Tag: tag format, without a pid", "info"],
      ["10-23 09:14:11.123  1234  5678 «V» Tag: x", "trace"],
      ["10-23 09:14:11.123  1234  5678 «D» Tag: x", "debug"],
      ["10-23 09:14:11.123  1234  5678 «I» Tag: x", "info"],
      ["10-23 09:14:11.123  1234  5678 «W» Tag: x", "warn"],
      ["10-23 09:14:11.123  1234  5678 «E» AndroidRuntime: x", "error"],
      ["10-23 09:14:11.123  1234  5678 «F» libc: x", "fatal"],
      ["10-23 09:14:11.123  1234  5678 «A» libc: x", "fatal"],
      // A brief line needs its tag and colon.
      ["I/O failed on sdb", null],
      ["I/O «error» on sdb", "error"],
      ["E/ x", null],
    ])("%s", check);
  });

  describe("rule 6: Python traceback head", () => {
    it.each<[string, LogLevel | null]>([
      ["«Traceback» (most recent call last):", "error"],
      ["«Traceback» (most recent call last): ignored", "error"],
      ["  Traceback (most recent call last):", null],
    ])("%s", check);
  });

  describe("rule 7: level words", () => {
    it.each<[string, LogLevel | null]>([
      // UPPERCASE anywhere.
      ["2026-10-23 09:14:03.007 «WARN»  [pool-1] c.e.db.Pool - slow", "warn"],
      ["job 7 done, status «FATAL» reported", "fatal"],
      ["2026-10-23T09:14:09Z «ERROR»", "error"],
      // Any case in brackets.
      ["[«warn»] disk almost full", "warn"],
      ["<«Info»> started", "info"],
      ["(«debug») cache size 12", "debug"],
      ["2026-10-23 app [ «Error» ] request failed", "error"],
      ["host-one app [«notice»] rotated", "info"],
      // Any case followed by a colon.
      ["«warning»: unused variable", "warn"],
      ["cc1: some «error»: unknown type name", "error"],
      ["The build said «Fatal»: out of space", "fatal"],
      // Any case as the first or second word.
      ["npm «warn» deprecated inflight@1.0.6", "warn"],
      ["«info» starting worker", "info"],
      ["«Debug» value is 3", "debug"],
      ["app «error» while saving", "error"],
      ["app\t«error» while saving", "error"],
      ["«warn» and error later", "warn"],
      // The earliest form wins.
      ["«INFO» before ERROR", "info"],
      ["x [«warn»] then ERROR later", "warn"],
      ["the «ERROR» comes before [warn]", "error"],
      ["[«ERROR»] tied at one offset", "error"],
      ["a b c «error»: then WARN", "error"],
    ])("%s", check);

    it.each<[string, LogLevel | null]>([
      ["disk I/O error on sdb", null],
      ["no errors expected", null],
      ["found ERROR_CODE 7 in errorCount", null],
      ["ERROR_CODE=7", null],
      ["errorCount=3", null],
      ["the cache had an error yesterday", null],
      ["We saw an Error yesterday", null],
      ["Errors: 0", null],
      ["forewarned is WARNED", null],
      // Brackets only pair with their own closer.
      ["skipped 3 handlers (level < warn)", null],
      ["retry (error> threshold", null],
      ["x [info) y", null],
      ["Done in 3.2s.", null],
      ["", null],
      ["   ", null],
    ])("not %s", check);

    const table: [string, LogLevel][] = [
      ["fatal", "fatal"],
      ["critical", "fatal"],
      ["crit", "fatal"],
      ["emerg", "fatal"],
      ["emergency", "fatal"],
      ["alert", "fatal"],
      ["panic", "fatal"],
      ["error", "error"],
      ["err", "error"],
      ["severe", "error"],
      ["warning", "warn"],
      ["warn", "warn"],
      ["info", "info"],
      ["information", "info"],
      ["notice", "info"],
      ["debug", "debug"],
      ["dbg", "debug"],
      ["fine", "debug"],
      ["trace", "trace"],
      ["verbose", "trace"],
      ["finer", "trace"],
      ["finest", "trace"],
    ];

    it.each(table)("reads %s as %s", (word, level) => {
      const upper = word.toUpperCase();
      const title = word[0].toUpperCase() + word.slice(1);
      check(`2026-10-23 09:14:02 «${upper}» [main] x`, level);
      check(`2026-10-23 09:14:02 [«${word}»] x`, level);
      check(`2026-10-23 09:14:02 <«${title}»> x`, level);
      check(`app: «${title}»: x`, level);
      check(`«${word}» x y`, level);
      check(`app «${word}» x`, level);
      check(`{"level":"«${word}»"}`, level);
      check(`level=«${word}»`, level);
      // Lowercase, mid-message, with no colon: not a level.
      check(`the job had ${word} x`, null);
      check(`a ${upper}x b`, null);
    });
  });

  describe("the 256-unit window", () => {
    it("does not find a word past it", () => {
      check(`${"x".repeat(300)} ERROR boom`, null);
      check(`${"a ".repeat(150)}ERROR`, null);
      check(`{${"x".repeat(300)},"level":"error"}`, null);
      check(`${"x ".repeat(130)}level=error`, null);
    });

    it("finds a word inside it in a longer line", () => {
      check(`${"x ".repeat(100)}«ERROR»${" y".repeat(100)}`, "error");
      check(`${"x".repeat(250)} «ERROR»`, "error");
    });

    it("ignores a word cut off at its end", () => {
      // The window holds " ERROR", the line goes on to "ERRORS".
      check(`${"x".repeat(250)} ERRORS`, null);
      check(`${"x".repeat(244)} level=errors`, null);
      check(`{${"x".repeat(245)},"level":30}`, null);
      check(`{${"x".repeat(243)},"level":«30»}`, "info");
    });

    it("reads at most 256 units", () => {
      const text = `${"x ".repeat(100)}ERROR${" y".repeat(10_000)}`;
      expect(detectLevel(text)).toEqual({ level: "error", from: 200, to: 205 });
    });
  });

  it("gives the same answer on every call", () => {
    for (let i = 0; i < 3; i++) {
      check('{"x":1,"level":"«warn»"}', "warn");
      check("severity=high level=«error»", "error");
    }
  });

  describe("the mockup sample", () => {
    it.each(
      LOG_SAMPLE.map(([raw, level], i) => [i + 1, stripAnsi(raw), level]),
    )("line %i: %s", (_, text, level) => {
      const own = level === null || level.startsWith("^") ? null : level;
      expect(detectLevel(text)?.level ?? null).toBe(own);
    });

    it("returns the word offsets the rows colour", () => {
      const ranges = LOG_SAMPLE.map(([raw]) => {
        const text = stripAnsi(raw);
        const match = detectLevel(text);
        return match ? text.slice(match.from, match.to) : null;
      });
      expect(ranges).toEqual([
        "INFO",
        "DEBUG",
        "INFO",
        "WARN",
        "TRACE",
        "ERROR",
        null,
        null,
        null,
        null,
        null,
        null,
        "info",
        "warn",
        "error",
        "30",
        "WARN",
        "<3>",
        "E",
        "warn",
        "warning",
        "Traceback",
        null,
        null,
        null,
        "FATAL",
      ]);
    });
  });
});
