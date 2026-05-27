export class CodexHistoryError extends Error {
  constructor(
    message: string,
    readonly exitCode = 1,
  ) {
    super(message);
    this.name = "CodexHistoryError";
  }
}

export class UsageError extends CodexHistoryError {
  constructor(message: string) {
    super(message, 2);
    this.name = "UsageError";
  }
}

export class SafetyRefusalError extends CodexHistoryError {
  constructor(message: string) {
    super(message, 3);
    this.name = "SafetyRefusalError";
  }
}

