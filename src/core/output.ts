export function printOutput(value: unknown): void {
  if (typeof value === "string") {
    if (value.length === 0) {
      return;
    }

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
