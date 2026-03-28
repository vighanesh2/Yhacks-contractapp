export function redactPII(text: string): string {
  let r = text;
  r = r.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]");
  r = r.replace(/\b\d{8,17}\b/g, "[ACCOUNT_REDACTED]");
  r = r.replace(/[\w.-]+@[\w.-]+\.\w+/g, "[EMAIL_REDACTED]");
  r = r.replace(
    /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    "[PHONE_REDACTED]",
  );
  r = r.replace(
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    "[CC_REDACTED]",
  );
  return r;
}
