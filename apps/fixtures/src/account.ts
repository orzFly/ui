/** What the Profile form edits and saves. */
export interface Profile {
  name: string;
  email: string;
  timeZone: string;
  showEmail: boolean;
}

export const PROFILE: Profile = {
  name: "alice",
  email: "alice@example.com",
  timeZone: "Europe/Berlin",
  showEmail: false,
};

export const sameProfile = (a: Profile, b: Profile) =>
  a.name === b.name &&
  a.email === b.email &&
  a.timeZone === b.timeZone &&
  a.showEmail === b.showEmail;

export const TIME_ZONES = [
  { value: "Pacific/Honolulu", label: "Honolulu (UTC−10)" },
  { value: "America/Los_Angeles", label: "Los Angeles (UTC−8)" },
  { value: "America/Denver", label: "Denver (UTC−7)" },
  { value: "America/Chicago", label: "Chicago (UTC−6)" },
  { value: "America/New_York", label: "New York (UTC−5)" },
  { value: "America/Sao_Paulo", label: "São Paulo (UTC−3)" },
  { value: "Europe/London", label: "London (UTC+0)" },
  { value: "Europe/Berlin", label: "Berlin (UTC+1)" },
  { value: "Europe/Helsinki", label: "Helsinki (UTC+2)" },
  { value: "Asia/Kolkata", label: "Kolkata (UTC+5:30)" },
  { value: "Asia/Shanghai", label: "Shanghai (UTC+8)" },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
  { value: "Australia/Sydney", label: "Sydney (UTC+10)" },
];

export const LANGUAGES = [
  { value: "plain", label: "Plain text" },
  { value: "markdown", label: "Markdown" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "rust", label: "Rust" },
  { value: "go", label: "Go" },
  { value: "shell", label: "Shell" },
  { value: "yaml", label: "YAML" },
];

export interface AccessToken {
  id: string;
  name: string;
  scopes: string;
  /** Written out rather than computed, so the prerendered page and the browser agree. */
  lastUsed: string;
}

export const TOKENS: AccessToken[] = [
  {
    id: "ci",
    name: "ci-runner",
    scopes: "Read and write runs",
    lastUsed: "Used 4 minutes ago",
  },
  {
    id: "deploy",
    name: "deploy-bot",
    scopes: "Read runs, publish releases",
    lastUsed: "Used yesterday",
  },
  {
    id: "backup",
    name: "backup-script",
    scopes: "Read everything",
    lastUsed: "Never used",
  },
];
