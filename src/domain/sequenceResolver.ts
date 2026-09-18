import { Pattern } from "./markets";
import { ReferenceTriplet, SequenceTemplate } from "./types";

type GroupName = "AB" | "C" | "H" | "M" | "R" | "W";

const GROUP_COLUMNS: Record<GroupName, string[]> = {
  AB: ["AB", "AC", "AD", "AE"], C: ["C", "D", "E", "F"], H: ["H", "I", "J", "K"],
  M: ["M", "N", "O", "P"], R: ["R", "S", "T", "U"], W: ["W", "X", "Y", "Z"]
};

const GROUP_ORDER: Record<Pattern, GroupName[]> = {
  FINAL_DAYS_6: ["AB", "C", "H", "M", "R", "W"],
  FINAL_DAYS_5: ["W", "C", "H", "M", "R"]
};

const splitCell = (cell: string) => {
  const match = /^([A-Z]+)(\d+)$/i.exec(cell.trim());
  if (!match) throw new Error(`Invalid cell number: ${cell}`);
  return { column: match[1].toUpperCase(), row: Number(match[2]) };
};

export function groupOf(cell: string): GroupName {
  const { column } = splitCell(cell);
  const group = (Object.keys(GROUP_COLUMNS) as GroupName[]).find((name) => GROUP_COLUMNS[name].includes(column));
  if (!group) throw new Error(`No four-cell group is defined for ${cell}.`);
  return group;
}

/** Converts any cell in a four-cell group to that group's first cell on the same row. */
export function groupStartForCell(cell: string): string {
  const { row } = splitCell(cell);
  return `${GROUP_COLUMNS[groupOf(cell)][0]}${row}`;
}

/**
 * Selects the exact template that begins with the requested four-cell group.
 * The template itself still comes from the imported Sequence for calculation file.
 */
export function resolveSequenceForStart(
  pattern: Pattern, templates: SequenceTemplate[], startCell: string
): ReferenceTriplet[] {
  const requestedGroup = groupOf(startCell);
  const template = templates.find((candidate) => {
    const anchor = candidate.sequence.find((line) => line.criteria === 1 && line.subCriteria === 1)?.references[0];
    return anchor && groupOf(anchor) === requestedGroup;
  });
  if (!template) throw new Error(`No imported sequence template starts with ${requestedGroup}.`);

  const anchor = template.sequence.find((line) => line.criteria === 1 && line.subCriteria === 1)!.references[0];
  const start = splitCell(startCell);
  const base = splitCell(anchor);
  if (start.column !== base.column) throw new Error(`Start cell ${startCell} does not match template anchor ${anchor}.`);
  const rowOffset = start.row - base.row;
  const shift = (cell: string) => {
    const parsed = splitCell(cell);
    return `${parsed.column}${parsed.row + rowOffset}`;
  };
  return template.sequence.map((line) => ({ ...line, references: line.references.map(shift) as [string, string, string] }));
}

/** Resolves a root/overlapping-group day from the template that has the same main-cell column. */
export function resolveSequenceForMain(templates: SequenceTemplate[], targetMainCell: string): ReferenceTriplet[] {
  const target = splitCell(targetMainCell);
  const candidates = templates
    .filter((candidate) => splitCell(candidate.templateMainCell).column === target.column)
    .sort((a, b) => splitCell(a.templateMainCell).row - splitCell(b.templateMainCell).row);
  if (!candidates.length) throw new Error(`No imported sequence template exists for main cell ${targetMainCell}.`);
  const template = candidates[0];
  const baseRow = splitCell(template.templateMainCell).row;
  const rowOffset = target.row - baseRow;
  const shift = (cell: string) => {
    const parsed = splitCell(cell);
    return `${parsed.column}${parsed.row + rowOffset}`;
  };
  return template.sequence.map((line) => ({ ...line, references: line.references.map(shift) as [string, string, string] }));
}

/** Returns the start groups for the four valid days of a branch. */
export function nextStartCells(pattern: Pattern, firstStartCell: string, count: number): string[] {
  const order = GROUP_ORDER[pattern];
  const first = splitCell(firstStartCell);
  const firstGroup = groupOf(firstStartCell);
  const startIndex = order.indexOf(firstGroup);
  if (startIndex < 0) throw new Error(`${firstStartCell} is not valid for ${pattern}.`);

  let row = first.row;
  const starts: string[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const index = (startIndex + offset) % order.length;
    const previousIndex = (startIndex + offset - 1 + order.length) % order.length;
    if (offset > 0 && previousIndex === 0 && index === 1) row += 1; // AB→C (Days 6) or W→C (Days 5) enters the next row.
    starts.push(`${GROUP_COLUMNS[order[index]][0]}${row}`);
  }
  return starts;
}

export function nextFourStartCells(pattern: Pattern, firstStartCell: string): string[] {
  return nextStartCells(pattern, firstStartCell, 4);
}
