const FILES = [
  { name: "retry.test.ts", ms: 512 },
  { name: "fetch-task.test.ts", ms: 61 },
  { name: "is-done.test.ts", ms: 4 },
];

export function AlignedTestTimes() {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-ui">
      {FILES.map((file) => (
        <div key={file.name} className="contents">
          <dt className="truncate font-mono text-ui-sm leading-5">
            {file.name}
          </dt>
          <dd className="text-right tabular-nums">{file.ms} ms</dd>
        </div>
      ))}
    </dl>
  );
}
