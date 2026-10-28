const FILES = [
  { name: "retry.test.ts", time: "0.51 s" },
  { name: "fetch-task.test.ts", time: "61 ms" },
  { name: "is-done.test.ts", time: "4ms" },
];

export function RaggedTestTimes() {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
      {FILES.map((file) => (
        <div key={file.name} className="contents">
          <dt className="truncate font-mono text-xs leading-5">{file.name}</dt>
          <dd>{file.time}</dd>
        </div>
      ))}
    </dl>
  );
}
