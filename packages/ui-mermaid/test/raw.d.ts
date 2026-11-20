// Vitest loads these through Vite, which hands over the file as text.
declare module "*.svg?raw" {
  const text: string;
  export default text;
}
