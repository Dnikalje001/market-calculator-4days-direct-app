import { Pattern } from "./markets";

const MAIN_COLUMNS: Record<Pattern, string[]> = {
  FINAL_DAYS_6: ["B", "G", "L", "Q", "V", "AA"],
  FINAL_DAYS_5: ["B", "G", "L", "Q", "V"]
};

const splitMainCell = (cell: string) => {
  const match = /^([A-Z]+)(\d+)$/i.exec(cell.trim());
  if (!match) throw new Error(`Invalid main cell: ${cell}`);
  return { column: match[1].toUpperCase(), row: Number(match[2]) };
};

/** Returns the exact next calendar main cell for the selected final pattern. */
export function nextMainCell(pattern: Pattern, current: string): string {
  const { column, row } = splitMainCell(current);
  const calendar = MAIN_COLUMNS[pattern];
  const index = calendar.indexOf(column);
  if (index < 0) throw new Error(`${current} is not a ${pattern} main cell.`);
  const nextIndex = (index + 1) % calendar.length;
  return `${calendar[nextIndex]}${row + (nextIndex === 0 ? 1 : 0)}`;
}

export function nextMainCells(pattern: Pattern, first: string, count: number): string[] {
  const cells = [first.toUpperCase()];
  while (cells.length < count) cells.push(nextMainCell(pattern, cells[cells.length - 1]));
  return cells;
}
