import { CI_RUN } from "@orz/fixtures/ci-run.ts";

export function JobStatusAsDots() {
  return (
    <ul className="grid gap-2 text-ui">
      {CI_RUN.jobs.map((job) => (
        <li key={job.id} className="flex h-5.5 items-center justify-between">
          {job.name}
          <span
            className={
              job.status === "failed"
                ? "size-2.5 rounded-full bg-red-500"
                : "size-2.5 rounded-full bg-green-500"
            }
          />
        </li>
      ))}
    </ul>
  );
}
