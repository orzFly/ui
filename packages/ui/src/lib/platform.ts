/**
 * Whether the keyboard is an Apple one, which prints Alt as ⌥.
 * `navigator.platform` is deprecated but still the only answer Safari and
 * Firefox give; Chromium's userAgentData comes first where it exists. False
 * on the server.
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const data = (navigator as { userAgentData?: { platform?: string } })
    .userAgentData;
  // userAgentData says "macOS", navigator.platform "MacIntel".
  return /mac|iphone|ipad/i.test(data?.platform ?? navigator.platform ?? "");
}
