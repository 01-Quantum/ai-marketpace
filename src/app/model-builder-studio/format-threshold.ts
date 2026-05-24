/** Formats a threshold for canvas display (max 5 significant digits). */
export function formatThresholdDisplay(value: number): string {
  return Number.parseFloat(value.toPrecision(5)).toString();
}
