import { CalculationCheckpoint, CellValues } from "./types";

/**
 * The traversal engine stores the next main cell whenever it cannot continue.
 * Saving a new digit for that cell makes the paused calculation eligible to resume.
 */
export function shouldResumeAfterValueUpdate(
  checkpoint: CalculationCheckpoint | null,
  changedCell: string,
  values: CellValues
): boolean {
  if (!checkpoint || checkpoint.status !== "WAITING_FOR_VALUES" || !checkpoint.nextMainCell) return false;
  if (checkpoint.nextMainCell !== changedCell) return false;
  const value = values[changedCell];
  return value !== undefined && value !== "" && value !== "*";
}
