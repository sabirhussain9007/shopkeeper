export class ApiRequestError extends Error {
  status: number;
  code?: string;
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, status: number, options?: { code?: string; fieldErrors?: Record<string, string[]> }) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = options?.code;
    this.fieldErrors = options?.fieldErrors;
  }
}

export function applyFieldErrors<T extends Record<string, unknown>>(
  setError: (name: keyof T & string, error: { message?: string }) => void,
  fieldErrors?: Record<string, string[]>,
) {
  if (!fieldErrors) return;
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages[0]) setError(field as keyof T & string, { message: messages[0] });
  }
}
