// A TypeScript file uploaded as application/octet-stream: the filename says it is text, and the
// .ts extension never makes it a video.
export type Task = { id: number; title: string; done: boolean };

export async function fetchTask(id: number): Promise<Task> {
  const response = await fetch(`https://app.example/api/tasks/${id}`);
  if (!response.ok) throw new Error(`task ${id}: ${response.status}`);
  return (await response.json()) as Task;
}
