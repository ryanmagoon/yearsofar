/** One game's license acquisition date, as loaded into the license_dates table. */
export interface LicenseDate {
  appid: number
  /** ISO calendar date (yyyy-mm-dd) the license was added to the account. */
  acquired: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isRealDate(iso: string): boolean {
  const parsed = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(iso)
}

/**
 * Validates the admin-route payload for loading license dates. Returns the
 * parsed rows, or an error message describing the first problem found.
 */
export function parseLicenseDatesPayload(
  body: unknown,
): { dates: LicenseDate[] } | { error: string } {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('dates' in body) ||
    !Array.isArray(body.dates)
  ) {
    return { error: 'Body must be a JSON object with a "dates" array.' }
  }
  if (body.dates.length === 0) {
    return { error: '"dates" is empty.' }
  }

  const dates: LicenseDate[] = []
  for (const [index, entry] of body.dates.entries()) {
    const candidate = entry as { appid?: unknown; acquired?: unknown }
    if (
      typeof candidate.appid !== 'number' ||
      !Number.isInteger(candidate.appid) ||
      candidate.appid <= 0
    ) {
      return {
        error: `Entry at index ${index}: appid must be a positive integer.`,
      }
    }
    if (
      typeof candidate.acquired !== 'string' ||
      !ISO_DATE.test(candidate.acquired) ||
      !isRealDate(candidate.acquired)
    ) {
      return {
        error: `Entry at index ${index}: acquired must be a valid yyyy-mm-dd date.`,
      }
    }
    dates.push({ appid: candidate.appid, acquired: candidate.acquired })
  }
  return { dates }
}
