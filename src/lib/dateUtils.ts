/**
 * Get the current Indian Standard Time (IST) date as YYYY-MM-DD.
 * Handles the UTC timezone offset on Vercel deployments.
 *
 * @param offsetDays Number of days to add/subtract (e.g., 0 = today, 1 = tomorrow)
 * @returns YYYY-MM-DD string
 */
export function getISTDate(offsetDays = 0): string {
  const now = new Date();
  const ist = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  ist.setDate(ist.getDate() + offsetDays);
  return ist.toISOString().split("T")[0];
}

/**
 * Get formatted IST timestamp for debugging or display
 */
export function getISTTimestamp(): string {
  return new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
}
