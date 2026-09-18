import { evaluateDay, evaluateFourDayGroup } from "./calculation";
import { nextMainCells } from "./mainCellCalendar";
import { Pattern } from "./markets";
import { resolveSequenceForMain } from "./sequenceResolver";
import { CellValues, GroupAudit, SequenceTemplate } from "./types";

const stringifyMainValue = (value: CellValues[string] | undefined) => typeof value === "number" ? String(value) : value ?? "";

/** Root groups use the imported main-cell templates directly; no branch start-group is inferred here. */
export function runRootFourDayGroup(
  pattern: Pattern, templates: SequenceTemplate[], values: CellValues, cellOrder: string[], firstMainCell: string
): GroupAudit {
  const mainCells = nextMainCells(pattern, firstMainCell, 4);
  const days = mainCells.map((mainCell, index) => evaluateDay(
    resolveSequenceForMain(templates, mainCell), values, mainCell, stringifyMainValue(values[mainCell]), cellOrder, index === 3
  ));
  return evaluateFourDayGroup(days);
}
