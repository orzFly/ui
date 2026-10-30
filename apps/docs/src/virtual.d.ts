declare module "virtual:orz-install" {
  const installs: import("../../../scripts/install.ts").InstallText[];
  export default installs;
}

declare module "virtual:orz-packages" {
  const packages: import("../scripts/data.ts").PackageSummary[];
  export default packages;
}

declare module "virtual:orz-themes" {
  const table: import("../../../scripts/themes.ts").ThemeTable;
  export default table;
}

declare module "virtual:orz-demo-api" {
  /** The Storybook titles each demo's files use, by the demo's directory under src/demos/. */
  const apis: Record<string, string[]>;
  export default apis;
}

declare module "virtual:orz-ui-source" {
  const source: {
    classes: import("../scripts/data.ts").InternalClasses;
    css: import("../scripts/data.ts").CssLengths;
    tokens: import("../scripts/data.ts").StyleTokens;
  };
  export default source;
}
