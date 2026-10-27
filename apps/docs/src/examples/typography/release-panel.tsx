const PACKAGES = [
  { name: "@orz/ui", size: 412.6, change: 1.2 },
  { name: "@orz/ui-code", size: 88.1, change: -0.4 },
  { name: "@orz/themes", size: 31, change: 0 },
];

export function ReleasePanel() {
  return (
    <section className="grid gap-4 rounded-xl border bg-card p-4 text-card-foreground">
      <header className="grid gap-1">
        <h3 className="font-heading font-medium text-base leading-snug">
          Release 0.4.0
        </h3>
        <p className="text-muted-foreground text-sm">
          Tagged <time dateTime="2026-10-27T09:12:00Z">27 Oct 2026, 09:12</time>{" "}
          from <code className="font-mono text-xs">9f3c2e1</code>
        </p>
      </header>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground text-xs">
            <th className="pb-1 font-medium">Package</th>
            <th className="pb-1 text-right font-medium">Size (KB)</th>
            <th className="pb-1 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody>
          {PACKAGES.map((pkg) => (
            <tr key={pkg.name} className="border-t">
              <td className="py-1.5 font-mono text-xs">{pkg.name}</td>
              <td className="py-1.5 text-right tabular-nums">
                {pkg.size.toFixed(1)}
              </td>
              <td className="py-1.5 text-right text-muted-foreground tabular-nums">
                {pkg.change > 0 ? "+" : ""}
                {pkg.change.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="max-w-prose text-sm leading-6">
        The theme store follows a pick made in another tab. Apps that listened
        for <code className="font-mono text-xs">storage</code> events to do the
        same can drop that code.
      </p>
    </section>
  );
}
