import { type UpdateState } from "../../../modules/play-updates";
import { nextUpdateAction } from "../useAppUpdate";

const state = (overrides: Partial<UpdateState> = {}): UpdateState => ({
  availability: "none",
  installStatus: "unknown",
  flexibleAllowed: false,
  stalenessDays: null,
  ...overrides,
});

describe("nextUpdateAction", () => {
  it("does nothing when Play updates are unavailable", () => {
    expect(nextUpdateAction(null, false)).toBe("none");
  });

  it("does nothing when the app is up to date", () => {
    expect(nextUpdateAction(state(), false)).toBe("none");
  });

  it("offers a new version once per launch", () => {
    const available = state({ availability: "available", flexibleAllowed: true });

    expect(nextUpdateAction(available, false)).toBe("offerUpdate");
    expect(nextUpdateAction(available, true)).toBe("none");
  });

  it("only offers updates Play allows to download in the background", () => {
    expect(
      nextUpdateAction(state({ availability: "available", flexibleAllowed: false }), false)
    ).toBe("none");
  });

  it("asks to restart once a download has finished, even if already offered", () => {
    const downloaded = state({
      availability: "available",
      installStatus: "downloaded",
      flexibleAllowed: true,
    });

    expect(nextUpdateAction(downloaded, false)).toBe("showRestart");
    expect(nextUpdateAction(downloaded, true)).toBe("showRestart");
  });

  it("waits while an update is still downloading", () => {
    expect(
      nextUpdateAction(
        state({ availability: "inProgress", installStatus: "downloading" }),
        true
      )
    ).toBe("none");
  });
});
