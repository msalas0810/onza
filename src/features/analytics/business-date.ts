export function businessDate(instant = new Date()) {
  return new Date(instant.getTime() - 12 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}
