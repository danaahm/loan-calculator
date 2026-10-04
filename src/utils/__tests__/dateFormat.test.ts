import * as Localization from "expo-localization";

import { DATE_FORMATS } from "../../types/dateFormat";
import {
  formatDateWith,
  getActiveDateFormat,
  resolveDateFormat,
  setActiveDateFormat,
} from "../dateFormat";
import { formatDisplayDate } from "../dateIso";
import { FALLBACK_DATE_FORMAT, detectDateFormat } from "../locale";

jest.mock("expo-localization", () => ({ getLocales: jest.fn() }));

const getLocales = Localization.getLocales as jest.Mock;

const deviceLocale = (languageTag: string, regionCode: string | null) => {
  getLocales.mockReturnValue([{ languageTag, regionCode }]);
};

afterEach(() => {
  getLocales.mockReset();
  setActiveDateFormat("auto");
});

describe("formatDateWith", () => {
  // 4 October: a day under 13, so a swapped day and month would show.
  const date = new Date(2026, 9, 4);

  it.each([
    ["dmy-slash", "04/10/2026"],
    ["dmy-dot", "04.10.2026"],
    ["d-mon-y", "4 Oct 2026"],
    ["ymd-dash", "2026-10-04"],
    ["mdy-slash", "10/04/2026"],
    ["mon-d-y", "Oct 4, 2026"],
  ] as const)("writes %s as %s", (format, expected) => {
    expect(formatDateWith(date, format, "en")).toBe(expected);
  });

  it("offers every format it can write", () => {
    expect(DATE_FORMATS).toHaveLength(6);
    DATE_FORMATS.forEach((format) => {
      expect(formatDateWith(date, format, "en")).toMatch(/2026/);
    });
  });
});

describe("detectDateFormat", () => {
  it.each([
    ["en-AU", "AU", "dmy-slash"],
    ["en-GB", "GB", "dmy-slash"],
    ["de-DE", "DE", "dmy-dot"],
    ["en-US", "US", "mdy-slash"],
    ["ja-JP", "JP", "ymd-dash"],
  ])("reads %s as %s", (languageTag, regionCode, expected) => {
    deviceLocale(languageTag, regionCode);
    expect(detectDateFormat()).toBe(expected);
  });

  it("falls back to the region when the locale tag is unusable", () => {
    deviceLocale("", "US");
    expect(detectDateFormat()).toBe("mdy-slash");
    deviceLocale("", "NZ");
    expect(detectDateFormat()).toBe("dmy-slash");
  });

  it("falls back to the unambiguous default with nothing to go on", () => {
    getLocales.mockReturnValue([]);
    expect(detectDateFormat()).toBe(FALLBACK_DATE_FORMAT);
    getLocales.mockImplementation(() => {
      throw new Error("no native module");
    });
    expect(detectDateFormat()).toBe(FALLBACK_DATE_FORMAT);
  });

  it("never defaults to month-first", () => {
    expect(FALLBACK_DATE_FORMAT).not.toBe("mdy-slash");
    expect(FALLBACK_DATE_FORMAT).not.toBe("mon-d-y");
  });
});

describe("active date format", () => {
  it("follows the device while set to auto", () => {
    deviceLocale("en-AU", "AU");
    expect(resolveDateFormat("auto")).toBe("dmy-slash");
    setActiveDateFormat("auto");
    expect(formatDisplayDate("2026-10-04")).toBe("04/10/2026");
  });

  it("keeps a chosen format whatever the device uses", () => {
    deviceLocale("en-US", "US");
    setActiveDateFormat("ymd-dash");
    expect(getActiveDateFormat()).toBe("ymd-dash");
    expect(formatDisplayDate("2026-10-04")).toBe("2026-10-04");
  });

  it("treats an unknown setting as auto", () => {
    deviceLocale("de-DE", "DE");
    expect(setActiveDateFormat("dd.MM.yyyy")).toBe("dmy-dot");
  });

  it("passes anything that is not a date through untouched", () => {
    expect(formatDisplayDate("not-a-date")).toBe("not-a-date");
  });
});
