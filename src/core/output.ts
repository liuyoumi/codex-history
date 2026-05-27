export type OutputMode = "text" | "json";

export function printOutput(value: unknown, mode: OutputMode): void {
  if (mode === "json") {
    console.log(JSON.stringify(value, null, 2));
    return;
  }

  if (typeof value === "string") {
    console.log(value);
    return;
  }

  console.log(JSON.stringify(value, null, 2));
}

export function formatDate(valueMs: number | null): string {
  if (valueMs === null || Number.isNaN(valueMs)) {
    return "-";
  }

  return new Date(valueMs).toISOString();
}

export function shortId(id: string): string {
  return id.length <= 8 ? id : id.slice(0, 8);
}

