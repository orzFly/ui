import { Input } from "@orz/ui/components/input";

export function PlaceholderAsLabel() {
  return (
    <Input
      type="email"
      autoComplete="email"
      aria-label="Email"
      placeholder="Email"
    />
  );
}
