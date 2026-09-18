import { evaluateDay, evaluateFourDayGroup } from "./calculation";
import { nextMainCells } from "./mainCellCalendar";
import { Pattern } from "./markets";
import { nextFourStartCells, resolveSequenceForStart } from "./sequenceResolver";
import { CellValues, GroupAudit, SequenceTemplate } from "./types";

const mainValue = (value: CellValues[string] | undefined) => typeof value === "number" ? String(value) : value ?? "";

/**
 * Evaluates one branch group. Its template references always come from the imported sequence;
 * the only generated parts are the documented day-to-day main-cell and group progression.
 */
export function runFourDayGroup(
  pattern: Pattern, templates: SequenceTemplate[], values: CellValues, cellOrder: string[],
  firstMainCell: string, firstStartCell: string
): GroupAudit {
  const mainCells = nextMainCells(pattern, firstMainCell, 4);
  const startCells = nextFourStartCells(pattern, firstStartCell);
  const days = mainCells.map((mainCell, index) => {
    const sequence = resolveSequenceForStart(pattern, templates, startCells[index]);
    return evaluateDay(sequence, values, mainCell, mainValue(values[mainCell]), cellOrder, index === 3);
  });
  return evaluateFourDayGroup(days);
}
