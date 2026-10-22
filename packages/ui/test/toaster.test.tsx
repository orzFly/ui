import { builtinThemes } from "@orz/themes";
import { act, render, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "../src/components/sonner.tsx";
import { createThemeStore, ThemeProvider } from "../src/theme/index.ts";

/** sonner mounts its list only once a toast exists, and not synchronously. */
async function toasterTheme() {
  act(() => {
    toast("Saved");
  });
  const list = await waitFor(() => {
    const found = document.querySelector("[data-sonner-toaster]");
    if (found === null) throw new Error("no toast list yet");
    return found;
  });
  return list.getAttribute("data-sonner-theme");
}

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("Toaster", () => {
  it("takes the provider's color scheme, not the OS's", async () => {
    // The OS says light, so a toaster following the OS would come out light.
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
    const store = createThemeStore({
      storageKey: "app-theme",
      themes: builtinThemes,
    });
    store.setPref({ ui: { theme: "dracula", mode: "dark" } });
    render(
      <ThemeProvider store={store}>
        <Toaster />
      </ThemeProvider>,
    );
    expect(await toasterTheme()).toBe("dark");
    store.dispose();
  });

  it("renders light with no provider", async () => {
    render(<Toaster />);
    expect(await toasterTheme()).toBe("light");
  });
});
