import { Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { TraversalRecord } from "../domain/traversal";
import { Pattern } from "../domain/markets";
import { nextMainCell } from "../domain/mainCellCalendar";

export function AuditReport({
  records,
  pattern,
}: {
  records: TraversalRecord[];
  pattern: Pattern;
}) {
const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({});

const [openSameCellGroups, setOpenSameCellGroups] = useState<
  Record<string, boolean>
>({});

const [openBranchFamilies, setOpenBranchFamilies] = useState<
  Record<string, boolean>
>({});
const [openRootSections, setOpenRootSections] = useState<
  Record<number, boolean>
>({});
const [statusFilter, setStatusFilter] = useState<
  "ALL" | "GREEN" | "RED" | "GREY"
>("ALL");


const groupedRecords: {
  root: { record: TraversalRecord; originalIndex: number } | null;
  branches: { record: TraversalRecord; originalIndex: number }[];
}[] = [];

let currentGroup:
  | {
      root: { record: TraversalRecord; originalIndex: number } | null;
      branches: { record: TraversalRecord; originalIndex: number }[];
    }
  | null = null;

records.forEach((record, originalIndex) => {
  if (record.kind === "ROOT") {
    currentGroup = {
      root: { record, originalIndex },
      branches: [],
    };

    groupedRecords.push(currentGroup);
  } else {
    if (!currentGroup) {
      currentGroup = {
        root: null,
        branches: [],
      };

      groupedRecords.push(currentGroup);
    }

    currentGroup.branches.push({
      record,
      originalIndex,
    });
  }
});

const getRootMainCells = (
  group: (typeof groupedRecords)[number]
): string[] => {
  if (!group.root) {
    return [];
  }

  return group.root.record.audit.days.map(
    (day) => day.mainCell.toUpperCase()
  );
};

const getRootStartCell = (
  group: (typeof groupedRecords)[number]
): string | undefined => {
  return getRootMainCells(group)[0];
};

const getRootEndCell = (
  group: (typeof groupedRecords)[number]
): string | undefined => {
  const cells = getRootMainCells(group);
  return cells.length ? cells[cells.length - 1] : undefined;
};

const isRootInternallySequential = (
  group: (typeof groupedRecords)[number]
): boolean => {
  const cells = getRootMainCells(group);

  if (cells.length < 2) {
    return false;
  }

  for (let index = 1; index < cells.length; index += 1) {
    const expectedCell = nextMainCell(
      pattern,
      cells[index - 1]
    ).toUpperCase();

    if (cells[index] !== expectedCell) {
      return false;
    }
  }

  return true;
};

const isMainCellGroupSequential = (
  cells: string[]
): boolean => {
  if (cells.length < 2) {
    return false;
  }

  for (let index = 1; index < cells.length; index += 1) {
    const expectedCell = nextMainCell(
      pattern,
      cells[index - 1]
    ).toUpperCase();

    if (cells[index] !== expectedCell) {
      return false;
    }
  }

  return true;
};

const getGreenBranchMainCellGroups = (
  group: (typeof groupedRecords)[number]
): string[][] => {
  const result: string[][] = [];

  group.branches
    .filter(({ record }) => {
      return (
        record.audit.days.length === 4 &&
        record.audit.commonCriteria.length > 0
      );
    })
    .forEach(({ record }) => {
      const cells = record.audit.days.map((day) =>
        day.mainCell.toUpperCase()
      );

      if (
        cells.length === 4 &&
        isMainCellGroupSequential(cells)
      ) {
        result.push(cells);
      }
    });

  return Array.from(
    new Map(
      result.map((cells) => [
        cells.join("|"),
        cells,
      ])
    ).values()
  );
};

const getEffectiveSequenceGroups = (
  group: (typeof groupedRecords)[number]
): string[][] => {
  const groups: string[][] = [];

  const rootCells = getRootMainCells(group);

  if (
    rootCells.length === 4 &&
    isMainCellGroupSequential(rootCells)
  ) {
    groups.push(rootCells);
  }

  const branchGroups = getGreenBranchMainCellGroups(group);

  branchGroups.forEach((cells) => {
    if (
      cells.length === 4 &&
      isMainCellGroupSequential(cells)
    ) {
      groups.push(cells);
    }
  });

  return groups;
};

const getEffectiveSequenceRange = (
  group: (typeof groupedRecords)[number]
): {
  startCell: string;
  endCell: string;
} | null => {
  const groups = getEffectiveSequenceGroups(group);

  if (groups.length === 0) {
    return null;
  }

  const firstGroup = groups[0];
  const lastGroup = groups[groups.length - 1];

  if (
    firstGroup.length === 0 ||
    lastGroup.length === 0
  ) {
    return null;
  }

  return {
    startCell: firstGroup[0],
    endCell: lastGroup[lastGroup.length - 1],
  };
};

const getMainCellDistance = (
  fromCell: string,
  toCell: string,
  maxSteps = 500
): number | null => {
  const from = fromCell.toUpperCase();
  const target = toCell.toUpperCase();

  if (from === target) {
    return 0;
  }

  let current = from;

  for (let step = 1; step <= maxSteps; step += 1) {
    current = nextMainCell(
      pattern,
      current
    ).toUpperCase();

    if (current === target) {
      return step;
    }
  }

  return null;
};

const getRootSequenceCoverage = (
  group: (typeof groupedRecords)[number]
): {
  startCell: string;
  endCell: string;
  groups: string[][];
} | null => {
  const branchGroups = getGreenBranchMainCellGroups(group);

  // या Root मध्ये एकही valid sequential GREEN branch group
  // नसेल तर हा Sequence candidate नाही.
  if (branchGroups.length === 0) {
    return null;
  }

  // Duplicate cell groups काढून टाका.
  const uniqueGroups = Array.from(
    new Map(
      branchGroups.map((cells) => [
        cells.join("|"),
        cells,
      ])
    ).values()
  );

  // प्रत्येक group चा start/end main-cell calendar वर
  // कुठे येतो त्यावरून groups chronological order मध्ये लावा.
  const anchorCell = uniqueGroups[0][0];

  const orderedGroups = [...uniqueGroups].sort((a, b) => {
    const aDistance =
      getMainCellDistance(anchorCell, a[0]) ?? 999999;

    const bDistance =
      getMainCellDistance(anchorCell, b[0]) ?? 999999;

    return aDistance - bDistance;
  });

  const firstGroup = orderedGroups[0];

  if (!firstGroup || firstGroup.length !== 4) {
    return null;
  }

  // प्रत्येक individual group sequential आहे हे
  // getGreenBranchMainCellGroups मध्ये आधीच check झाले आहे.
  //
  // आता एका group नंतर दुसरा group पुढेच आहे का ते check करा.
  for (let index = 1; index < orderedGroups.length; index += 1) {
    const previousGroup = orderedGroups[index - 1];
    const currentGroup = orderedGroups[index];

    const previousEnd =
      previousGroup[previousGroup.length - 1];

    const currentStart =
      currentGroup[0];

    const distance = getMainCellDistance(
      previousEnd,
      currentStart
    );

    if (distance === null) {
      return null;
    }
  }

  const lastGroup =
    orderedGroups[orderedGroups.length - 1];

  return {
    startCell: firstGroup[0],
    endCell: lastGroup[lastGroup.length - 1],
    groups: orderedGroups,
  };
};



const greenRootCoverages = groupedRecords
  .map((group, groupIndex) => {
    const rootRecord = group.root?.record;

    if (
      !rootRecord ||
      rootRecord.audit.days.length !== 4 ||
      rootRecord.audit.commonCriteria.length === 0
    ) {
      return null;
    }

    const effectiveGroups =
      getEffectiveSequenceGroups(group);

    // Sequence classification साठी एकटा 4-cell Root पुरेसा नाही.
    // Root + किमान एक matched branch group असणे आवश्यक.
    if (effectiveGroups.length < 2) {
      return null;
    }

    const coverage = getRootSequenceCoverage(group);

    if (!coverage) {
      return null;
    }

    return {
      group,
      groupIndex,
      coverage,
    };
  })
  .filter(
    (
      item
    ): item is NonNullable<typeof item> =>
      item !== null
  );

const sequenceRootIndexes = new Set<number>();

for (let i = 0; i < greenRootCoverages.length; i += 1) {
  const current = greenRootCoverages[i];

  let chainLast = current;
  const chainIndexes: number[] = [current.groupIndex];

  for (let j = i + 1; j < greenRootCoverages.length; j += 1) {
    const candidate = greenRootCoverages[j];

    const previousStart =
      chainLast.coverage.startCell;

    const previousEnd =
      chainLast.coverage.endCell;

    const candidateStart =
      candidate.coverage.startCell;

    const candidateEnd =
      candidate.coverage.endCell;


    // CASE 1:
    // Previous family संपल्यानंतर candidate पुढे सुरू होतो.
    //
    // मध्ये commonCriteria न जुळणारे groups असले
    // तरी sequence break करायची नाही.
    //
    // Example:
    // previous end = V38
    // candidate start = V39
    const forwardDistance = getMainCellDistance(
      previousEnd,
      candidateStart
    );

    const continuesForward =
      forwardDistance !== null;


    // CASE 2:
    // Candidate मागच्या family च्या coverage मध्ये
    // overlap होऊन सुरू होतो,
    // पण त्याचा END मागच्या END च्या पुढे जातो.
    //
    // Example:
    // previous coverage ... B42
    // candidate starts L41 ... and extends to G45

    const previousLength = getMainCellDistance(
      previousStart,
      previousEnd
    );

    const candidateStartFromPreviousStart =
      getMainCellDistance(
        previousStart,
        candidateStart
      );

    const candidateEndFromPreviousStart =
      getMainCellDistance(
        previousStart,
        candidateEnd
      );

    const overlapsAndExtends =
      previousLength !== null &&
      candidateStartFromPreviousStart !== null &&
      candidateEndFromPreviousStart !== null &&
      candidateStartFromPreviousStart <= previousLength &&
      candidateEndFromPreviousStart > previousLength;


    // Candidate ने sequence पुढे continue केली
    // किंवा overlap करून sequence पुढे extend केली.
    if (
      continuesForward ||
      overlapsAndExtends
    ) {
      chainIndexes.push(candidate.groupIndex);
      chainLast = candidate;
    }
  }


  // एकटा Root Sequence नाही.
  // कमीत कमी 2 valid Root families जोडल्या
  // गेल्यावरच Sequence.
  if (chainIndexes.length >= 2) {
    chainIndexes.forEach((groupIndex) => {
      sequenceRootIndexes.add(groupIndex);
    });
  }
}

  const matchesStatusFilter = (record: TraversalRecord) => {
    if (statusFilter === "ALL") return true;

    const isPartial = record.audit.days.length < 4;
    const hasCommonCriteria = record.audit.commonCriteria.length > 0;

    if (statusFilter === "GREEN") {
      return !isPartial && hasCommonCriteria;
    }

    if (statusFilter === "RED") {
      return !isPartial && !hasCommonCriteria;
    }

    if (statusFilter === "GREY") {
      return isPartial;
    }

    return true;
  };

  const renderRecord = (
    record: TraversalRecord,
    originalIndex: number,
    isBranch = false
  ) => {
    const isOpen = openGroups[originalIndex];

    return (
      <View
        key={`${record.kind}-${originalIndex}`}
        style={[
          styles.group,
          isBranch && styles.branchGroup,
        ]}
      >
        <Pressable
          onPress={() =>
            setOpenGroups((current) => ({
              ...current,
              [originalIndex]: !current[originalIndex],
            }))
          }
        >
          <Text
            style={[
              styles.heading,
              record.audit.days.length === 4
                ? record.audit.commonCriteria.length > 0
                  ? styles.headingGreen
                  : styles.headingRed
                : styles.headingNeutral,
            ]}
          >
            {isOpen ? "▼ " : "▶ "}
            {record.kind === "ROOT"
              ? "Root Group"
              : record.branch?.criteria === 0
                ? "Manual Branch"
                : `C${record.branch?.criteria} Branch`}
          </Text>
        </Pressable>

        {isOpen && (
          <>
            {record.skippedMainCells.length > 0 && (
              <Text style={styles.skip}>
                Skipped main cells: {record.skippedMainCells.join(", ")}
              </Text>
            )}

            {record.audit.days.map((day) => (
              <View key={day.mainCell} style={styles.day}>
                <Text style={styles.dayHeading}>
                  {day.mainCell} = {day.mainValue}{" "}
                  {day.isFourthDay ? "(fourth valid day)" : ""}
                </Text>

                {day.lines
                  .filter((line) => line.status === "MATCH")
                  .map((line) => (
                    <View
                      key={`${line.criteria}-${line.subCriteria}`}
                      style={styles.line}
                    >
                      <Text style={styles.match}>
                        C{line.criteria}-SC{line.subCriteria}:{" "}
                        {line.references.join(" → ")}
                      </Text>

                      <Text style={styles.detail}>
                        Values: {line.values.join(" + ")}
                        {line.total !== undefined
                          ? ` = ${line.total}; last digit ${line.directLastDigit}`
                          : ""}

                        {line.plusFiveLastDigit !== undefined
                          ? `; +5 last digit ${line.plusFiveLastDigit}`
                          : ""}

                        {(() => {
                          if (!/^\d{2}$/.test(day.mainValue)) {
                            return "";
                          }

                          const openDigit = Number(day.mainValue[0]);
                          const closeDigit = Number(day.mainValue[1]);

                          const directDigit = line.directLastDigit;
                          const oppositeDigit = line.plusFiveLastDigit;

                          const directOpen = directDigit === openDigit;
                          const directClose = directDigit === closeDigit;

                          const oppositeOpen =
                            oppositeDigit !== undefined &&
                            oppositeDigit === openDigit;

                          const oppositeClose =
                            oppositeDigit !== undefined &&
                            oppositeDigit === closeDigit;

                          if (directOpen && directClose) {
                            return " • Open + Close • Direct Match";
                          }

                          if (directOpen) {
                            return " • Open • Direct Match";
                          }

                          if (directClose) {
                            return " • Close • Direct Match";
                          }

                          if (oppositeOpen && oppositeClose) {
                            return " • Open + Close • Opposite Match";
                          }

                          if (oppositeOpen) {
                            return " • Open • Opposite Match";
                          }

                          if (oppositeClose) {
                            return " • Close • Opposite Match";
                          }

                          return "";
                        })()}
                      </Text>

                      <Text style={styles.detail}>
                        {line.status}
                        {line.skipReason ? ` (${line.skipReason})` : ""}
                      </Text>
                    </View>
                  ))}

                <Text style={styles.criteria}>
                  Matching Criteria:{" "}
                  {day.matchingCriteria.length
                    ? day.matchingCriteria
                        .map((value) => `C${value}`)
                        .join(", ")
                    : "None"}
                </Text>
              </View>
            ))}

            <Text style={styles.common}>
              Common Criteria:{" "}
              {record.audit.commonCriteria.length
                ? record.audit.commonCriteria
                    .map((value) => `C${value}`)
                    .join(", ")
                : "None"}
            </Text>
          </>
        )}
      </View>
    );
  };

  if (!records.length) return <Text style={styles.empty}>Calculation run केल्यानंतर पूर्ण audit येथे दिसेल.</Text>;
  return (
    <View style={styles.wrap}>
      <View style={styles.filterRow}>
        {(["ALL", "GREEN", "RED", "GREY"] as const).map((filter) => (
          <Pressable
            key={filter}
            onPress={() => setStatusFilter(filter)}
            style={[
              styles.filterButton,
              statusFilter === filter && styles.filterButtonActive,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                statusFilter === filter && styles.filterTextActive,
              ]}
            >
              {filter === "ALL"
                ? "All"
                : filter === "GREEN"
                  ? "Green"
                  : filter === "RED"
                    ? "Red"
                    : "Grey"}
            </Text>
          </Pressable>
        ))}
      </View>



      {groupedRecords.map((group, groupIndex) => {
        const isSequenceRoot =
          sequenceRootIndexes.has(groupIndex);

          const effectiveRange =
            getEffectiveSequenceRange(group);

          if (effectiveRange) {
            console.log("EFFECTIVE RANGE DEBUG", {
              groupIndex,
              start: effectiveRange.startCell,
              end: effectiveRange.endCell,
              groups: getEffectiveSequenceGroups(group),
            });
          }

          console.log("ROOT FAMILY DEBUG", {
              groupIndex,
              isSequenceRoot,
              root: getRootMainCells(group),
              branches: getGreenBranchMainCellGroups(group),
            });

        const visibleRoot =
          group.root && matchesStatusFilter(group.root.record)
            ? group.root
            : null;

        const visibleBranches = group.branches.filter(({ record }) =>
          matchesStatusFilter(record)
        );

        if (!visibleRoot && visibleBranches.length === 0) {
          return null;
        }

        const isRootOpen = openRootSections[groupIndex] === true;

        const branchFamilies = new Map<
          number,
          { record: TraversalRecord; originalIndex: number }[]
        >();

        visibleBranches.forEach((item) => {
          const firstCriteria = item.record.branch?.ancestry?.[0];

          if (firstCriteria === undefined) return;

          const existing = branchFamilies.get(firstCriteria) ?? [];
          existing.push(item);
          branchFamilies.set(firstCriteria, existing);
        });

          const hasBranches = branchFamilies.size > 0;

          if (statusFilter === "GREEN" && !hasBranches) {
            return null;
          }

        return (
          <View
            key={`root-section-${groupIndex}`}
            style={styles.rootSection}
          >
            <Pressable
              onPress={() =>
                setOpenRootSections((current) => ({
                  ...current,
                  [groupIndex]: !current[groupIndex],
                }))
              }
              style={styles.group}
            >
              <Text
                style={[
                  styles.heading,
                  visibleRoot?.record.audit.days.length === 4 &&
                  visibleRoot.record.audit.commonCriteria.length > 0
                    ? styles.headingGreen
                    : visibleRoot?.record.audit.days.length === 4
                      ? styles.headingRed
                      : styles.headingNeutral,
                ]}
              >
                {hasBranches
                  ? isRootOpen
                    ? "▼ "
                    : "▶ "
                  : "• "}

                Root Group

                {statusFilter === "GREEN"
                  ? isSequenceRoot
                    ? " • Sequence"
                    : " • Non-Sequence"
                  : ""}

                {!hasBranches ? " • No Branch" : ""}
              </Text>
            </Pressable>

            {isRootOpen && (
              <View style={styles.branchList}>
                {Array.from(branchFamilies.entries()).map(
                  ([criteria, familyRecords]) => {
                    const displayGroups =
                      statusFilter === "GREY"
                        ? familyRecords.filter(
                            ({ record }) => record.audit.days.length < 4
                          )
                        : familyRecords.filter(
                            ({ record }) => record.audit.days.length === 4
                          );

                    const groupCount = displayGroups.length;

                    const groupedByMainCells = new Map<
                      string,
                      {
                        mainCells: string[];
                        items: {
                          record: TraversalRecord;
                          originalIndex: number;
                          originalGroupNumber: number;
                        }[];
                        firstPosition: number;
                      }
                    >();

                    displayGroups.forEach((item, index) => {
                      const mainCells = item.record.audit.days.map(
                        (day) => day.mainCell
                      );

                      const cellKey = mainCells.join("|");

                      const existing = groupedByMainCells.get(cellKey);

                      if (existing) {
                        existing.items.push({
                          ...item,
                          originalGroupNumber: index + 1,
                        });
                      } else {
                        groupedByMainCells.set(cellKey, {
                          mainCells,
                          items: [
                            {
                              ...item,
                              originalGroupNumber: index + 1,
                            },
                          ],
                          firstPosition: index,
                        });
                      }
                    });

                    const displayCellGroups = Array.from(
                      groupedByMainCells.values()
                    ).sort((a, b) => a.firstPosition - b.firstPosition);

                    const isIncompleteBranch =
                      statusFilter === "GREY";

                    const branchKey = `${groupIndex}-${criteria}`;
                    const isBranchOpen = openBranchFamilies[branchKey] === true;

                    return (
                      <View
                        key={`branch-family-${groupIndex}-${criteria}`}
                        style={styles.branchGroup}
                      >
                        <Pressable
                          onPress={() =>
                            setOpenBranchFamilies((current) => ({
                              ...current,
                              [branchKey]: !current[branchKey],
                            }))
                          }
                        >
                          <Text
                            style={[
                              styles.heading,
                              {
                                color: isIncompleteBranch
                                  ? "#52616b"
                                  : "#1565c0",
                              },
                            ]}
                          >
                            {isBranchOpen ? "▼ " : "▶ "}
                            C{criteria} Branch •{" "}
                            {isIncompleteBranch
                              ? `${groupCount} Incomplete ${
                                  groupCount === 1 ? "Group" : "Groups"
                                }`
                              : `${groupCount} ${
                                  groupCount === 1 ? "Group" : "Groups"
                                }`}
                          </Text>
                        </Pressable>
                        {isBranchOpen && (
                          <View style={{ marginTop: 10, gap: 8 }}>
                            {displayCellGroups.map((cellGroup, cellGroupIndex) => {
                                const { mainCells, items } = cellGroup;
                                const firstItem = items[0];

                                const record = firstItem.record;
                                const originalIndex = firstItem.originalIndex;
                                const groupNumber = firstItem.originalGroupNumber - 1;

                                const sameCellKey = `${groupIndex}-${criteria}-${cellGroup.firstPosition}`;

                                const isSameCellGroup =
                                  items.length > 1;

                                const isSameCellOpen =
                                  openSameCellGroups[sameCellKey] === true;

                              const isGroupOpen = openGroups[originalIndex] === true;

                              const groupMainCells = record.audit.days.map(
                                (day) => day.mainCell
                              );

                              const hasCommonCriteria =
                                record.audit.commonCriteria.length > 0;



                              return (
                                <View
                                  key={`group-${originalIndex}`}
                                  style={{
                                    marginLeft: 12,
                                    borderLeftWidth: 2,
                                    borderLeftColor: "#d9e2ec",
                                    paddingLeft: 10,
                                    paddingVertical: 6,
                                  }}
                                >
                                  <Pressable
                                    onPress={() => {
                                      if (isSameCellGroup) {
                                        setOpenSameCellGroups((current) => ({
                                          ...current,
                                          [sameCellKey]: !current[sameCellKey],
                                        }));
                                      } else {
                                        setOpenGroups((current) => ({
                                          ...current,
                                          [originalIndex]: !current[originalIndex],
                                        }));
                                      }
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontWeight: "700",
                                        color: isIncompleteBranch
                                          ? "#52616b"
                                          : hasCommonCriteria
                                            ? "#6a1b9a"
                                            : "#c62828",
                                        fontSize: 15,
                                      }}
                                    >
                                      {isSameCellGroup
                                        ? isSameCellOpen
                                          ? "▼ "
                                          : "▶ "
                                        : isGroupOpen
                                          ? "▼ "
                                          : "▶ "}

                                      {items.length > 1
                                        ? `Same Cells ×${items.length}`
                                        : isIncompleteBranch
                                          ? "Pending Group"
                                          : `Group ${groupNumber + 1}`}{" "}
                                      • {mainCells.join(" → ")}
                                    </Text>

                                    {isIncompleteBranch ? (
                                      <Text
                                        style={{
                                          color: "#52616b",
                                          fontWeight: "800",
                                          fontSize: 12,
                                          marginTop: 3,
                                        }}
                                      >
                                        ⏳ Calculation Incomplete
                                      </Text>
                                    ) : !hasCommonCriteria ? (
                                      <Text
                                        style={{
                                          color: "#c62828",
                                          fontWeight: "800",
                                          fontSize: 12,
                                          marginTop: 3,
                                        }}
                                      >
                                        ⚠ No Common Criteria
                                      </Text>
                                    ) : null}
                                    {isIncompleteBranch && record.prediction && (
                                      <View
                                        style={{
                                          marginTop: 10,
                                          padding: 10,
                                          borderWidth: 1,
                                          borderColor: "#d9e2ec",
                                          borderRadius: 8,
                                          backgroundColor: "#f8fafc",
                                        }}
                                      >
                                        <Text
                                          style={{
                                            fontWeight: "800",
                                            fontSize: 14,
                                            color: "#334155",
                                          }}
                                        >
                                          4th Main Cell Prediction • {record.prediction.mainCell}
                                        </Text>

                                        <Text
                                          style={{
                                            marginTop: 5,
                                            fontWeight: "700",
                                            fontSize: 13,
                                            color: "#52616b",
                                          }}
                                        >
                                          3-Day Common Criteria:{" "}
                                          {record.prediction.commonCriteria.length
                                            ? record.prediction.commonCriteria
                                                .map((criteria) => `C${criteria}`)
                                                .join(", ")
                                            : "None"}
                                        </Text>

                                        {record.prediction.lines.map((line, index) => (
                                          <View
                                            key={`prediction-${line.criteria}-${line.subCriteria}-${index}`}
                                            style={{
                                              marginTop: 10,
                                              paddingTop: 8,
                                              borderTopWidth: 1,
                                              borderTopColor: "#e2e8f0",
                                            }}
                                          >
                                            <Text
                                              style={{
                                                fontWeight: "800",
                                                fontSize: 13,
                                              }}
                                            >
                                              C{line.criteria}-SC{line.subCriteria}
                                            </Text>

                                            <Text style={styles.detail}>
                                              Cells: {line.references.join(" → ")}
                                            </Text>

                                            <Text style={styles.detail}>
                                              Values:{" "}
                                              {line.references
                                                .map((reference, valueIndex) => {
                                                  const value = line.values[valueIndex];

                                                  return `${reference}=${
                                                    value === "" || value === undefined
                                                      ? "?"
                                                      : value
                                                  }`;
                                                })
                                                .join(" • ")}
                                            </Text>

                                            {line.missingCells.length > 0 ? (
                                              <Text
                                                style={{
                                                  marginTop: 3,
                                                  fontWeight: "700",
                                                  color: "#52616b",
                                                }}
                                              >
                                                Waiting for: {line.missingCells.join(", ")}
                                              </Text>
                                            ) : (
                                              <>
                                                <Text style={styles.detail}>
                                                  Total: {line.total}
                                                </Text>

                                                <Text
                                                  style={{
                                                    marginTop: 3,
                                                    fontWeight: "800",
                                                    fontSize: 13,
                                                  }}
                                                >
                                                  Possible Digits: {line.directLastDigit} /{" "}
                                                  {line.plusFiveLastDigit}
                                                </Text>
                                              </>
                                            )}
                                          </View>
                                        ))}
                                      </View>
                                    )}
                                  </Pressable>

                                  {isSameCellGroup && isSameCellOpen && (
                                    <View
                                      style={{
                                        marginTop: 8,
                                        marginLeft: 12,
                                        gap: 8,
                                      }}
                                    >
                                      {items.map((item) => {
                                        const childRecord = item.record;
                                        const childIndex = item.originalIndex;
                                        const childGroupNumber = item.originalGroupNumber;
                                        const isChildOpen = openGroups[childIndex] === true;

                                        const childHasCommonCriteria =
                                          childRecord.audit.commonCriteria.length > 0;

                                        return (
                                          <View
                                            key={`same-cell-child-${childIndex}`}
                                            style={{
                                              paddingVertical: 6,
                                              paddingLeft: 10,
                                              borderLeftWidth: 2,
                                              borderLeftColor: "#b39ddb",
                                            }}
                                          >
                                            <Pressable
                                              onPress={() =>
                                                setOpenGroups((current) => ({
                                                  ...current,
                                                  [childIndex]: !current[childIndex],
                                                }))
                                              }
                                            >
                                              <Text
                                                style={{
                                                  fontWeight: "700",
                                                  fontSize: 14,
                                                  color: childHasCommonCriteria
                                                    ? "#6a1b9a"
                                                    : "#c62828",
                                                }}
                                              >
                                                {isChildOpen ? "▼ " : "▶ "}
                                                Group {childGroupNumber}
                                              </Text>

                                              {!childHasCommonCriteria && (
                                                <Text
                                                  style={{
                                                    color: "#c62828",
                                                    fontWeight: "800",
                                                    fontSize: 12,
                                                    marginTop: 3,
                                                  }}
                                                >
                                                  ⚠ No Common Criteria
                                                </Text>
                                              )}
                                            </Pressable>

                                            {isChildOpen && (
                                              <View style={{ marginTop: 8 }}>
                                                {childRecord.skippedMainCells.length > 0 && (
                                                  <Text style={styles.skip}>
                                                    Skipped main cells:{" "}
                                                    {childRecord.skippedMainCells.join(", ")}
                                                  </Text>
                                                )}

                                                {childRecord.audit.days.map((day) => (
                                                  <View key={day.mainCell} style={styles.day}>
                                                    <Text style={styles.dayHeading}>
                                                      {day.mainCell} = {day.mainValue}{" "}
                                                      {day.isFourthDay
                                                        ? "(fourth valid day)"
                                                        : ""}
                                                    </Text>

                                                    {day.lines
                                                      .filter((line) => line.status === "MATCH")
                                                      .map((line) => (
                                                        <View
                                                          key={`${line.criteria}-${line.subCriteria}`}
                                                          style={styles.line}
                                                        >
                                                          <Text style={styles.match}>
                                                            C{line.criteria}-SC{line.subCriteria}:{" "}
                                                            {line.references.join(" → ")}
                                                          </Text>

                                                          <Text style={styles.detail}>
                                                            Values: {line.values.join(" + ")}
                                                            {line.total !== undefined
                                                              ? ` = ${line.total}; last digit ${line.directLastDigit}`
                                                              : ""}
                                                            {line.plusFiveLastDigit !== undefined
                                                              ? `; +5 last digit ${line.plusFiveLastDigit}`
                                                              : ""}
                                                          </Text>

                                                          <Text
                                                            style={
                                                              !day.isFourthDay
                                                                ? line.directLastDigit === Number(day.mainValue[1]) &&
                                                                  line.directLastDigit !== Number(day.mainValue[0])
                                                                  ? styles.resultClose
                                                                  : styles.resultNormal
                                                                : line.directLastDigit === Number(day.mainValue[0]) ||
                                                                    line.directLastDigit === Number(day.mainValue[1])
                                                                  ? styles.resultDirect
                                                                  : styles.resultOpposite
                                                            }
                                                          >
                                                            {(() => {
                                                              if (!/^\d{2}$/.test(day.mainValue)) {
                                                                return "";
                                                              }

                                                              const openDigit = Number(day.mainValue[0]);
                                                              const closeDigit = Number(day.mainValue[1]);

                                                              const directDigit = line.directLastDigit;
                                                              const oppositeDigit = line.plusFiveLastDigit;

                                                              const directOpen = directDigit === openDigit;
                                                              const directClose = directDigit === closeDigit;

                                                              const oppositeOpen =
                                                                oppositeDigit !== undefined &&
                                                                oppositeDigit === openDigit;

                                                              const oppositeClose =
                                                                oppositeDigit !== undefined &&
                                                                oppositeDigit === closeDigit;

                                                              // First 3 valid days
                                                              if (!day.isFourthDay) {
                                                                if (directOpen && directClose) {
                                                                  return "Open + Close";
                                                                }

                                                                if (directOpen) {
                                                                  return "Open";
                                                                }

                                                                if (directClose) {
                                                                  return "Close";
                                                                }

                                                                return "";
                                                              }

                                                              // Fourth valid day
                                                              if (directOpen && directClose) {
                                                                return "Open + Close • Direct";
                                                              }

                                                              if (directOpen) {
                                                                return "Open • Direct";
                                                              }

                                                              if (directClose) {
                                                                return "Close • Direct";
                                                              }

                                                              if (oppositeOpen && oppositeClose) {
                                                                return "Open + Close • Opposite";
                                                              }

                                                              if (oppositeOpen) {
                                                                return "Open • Opposite";
                                                              }

                                                              if (oppositeClose) {
                                                                return "Close • Opposite";
                                                              }

                                                              return "";
                                                            })()}

                                                            {line.skipReason
                                                              ? ` (${line.skipReason})`
                                                              : ""}
                                                          </Text>
                                                        </View>
                                                      ))}

                                                    <Text style={styles.criteria}>
                                                      Matching Criteria:{" "}
                                                      {day.matchingCriteria.length
                                                        ? day.matchingCriteria
                                                            .map((value) => `C${value}`)
                                                            .join(", ")
                                                        : "None"}
                                                    </Text>
                                                  </View>
                                                ))}

                                                <Text style={styles.common}>
                                                  Common Criteria:{" "}
                                                  {childRecord.audit.commonCriteria.length
                                                    ? childRecord.audit.commonCriteria
                                                        .map((value) => `C${value}`)
                                                        .join(", ")
                                                    : "None"}
                                                </Text>
                                              </View>
                                            )}
                                          </View>
                                        );
                                      })}
                                    </View>
                                  )}

                                  {!isSameCellGroup && isGroupOpen && (
                                    <View style={{ marginTop: 8 }}>
                                      {record.skippedMainCells.length > 0 && (
                                        <Text style={styles.skip}>
                                          Skipped main cells: {record.skippedMainCells.join(", ")}
                                        </Text>
                                      )}

                                      {record.audit.days.map((day) => (
                                        <View key={day.mainCell} style={styles.day}>
                                          <Text style={styles.dayHeading}>
                                            {day.mainCell} = {day.mainValue}{" "}
                                            {day.isFourthDay ? "(fourth valid day)" : ""}
                                          </Text>

                                          {day.lines
                                            .filter((line) => line.status === "MATCH")
                                            .map((line) => (
                                              <View
                                                key={`${line.criteria}-${line.subCriteria}`}
                                                style={styles.line}
                                              >
                                                <Text style={styles.match}>
                                                  C{line.criteria}-SC{line.subCriteria}:{" "}
                                                  {line.references.join(" → ")}
                                                </Text>

                                                <Text style={styles.detail}>
                                                  Values: {line.values.join(" + ")}
                                                  {line.total !== undefined
                                                    ? ` = ${line.total}; last digit ${line.directLastDigit}`
                                                    : ""}
                                                  {line.plusFiveLastDigit !== undefined
                                                    ? `; +5 last digit ${line.plusFiveLastDigit}`
                                                    : ""}
                                                </Text>

                                                <Text
                                                  style={
                                                    !day.isFourthDay
                                                      ? line.directLastDigit === Number(day.mainValue[1]) &&
                                                        line.directLastDigit !== Number(day.mainValue[0])
                                                        ? styles.resultClose
                                                        : styles.resultNormal
                                                      : line.directLastDigit === Number(day.mainValue[0]) ||
                                                          line.directLastDigit === Number(day.mainValue[1])
                                                        ? styles.resultDirect
                                                        : styles.resultOpposite
                                                  }
                                                >
                                                  {(() => {
                                                    if (!/^\d{2}$/.test(day.mainValue)) {
                                                      return "";
                                                    }

                                                    const openDigit = Number(day.mainValue[0]);
                                                    const closeDigit = Number(day.mainValue[1]);

                                                    const directDigit = line.directLastDigit;
                                                    const oppositeDigit = line.plusFiveLastDigit;

                                                    const directOpen = directDigit === openDigit;
                                                    const directClose = directDigit === closeDigit;

                                                    const oppositeOpen =
                                                      oppositeDigit !== undefined &&
                                                      oppositeDigit === openDigit;

                                                    const oppositeClose =
                                                      oppositeDigit !== undefined &&
                                                      oppositeDigit === closeDigit;

                                                    // First 3 valid days:
                                                    // Show only Open / Close
                                                    if (!day.isFourthDay) {
                                                      if (directOpen && directClose) {
                                                        return "Open + Close";
                                                      }

                                                      if (directOpen) {
                                                        return "Open";
                                                      }

                                                      if (directClose) {
                                                        return "Close";
                                                      }

                                                      return "";
                                                    }

                                                    // Fourth valid day:
                                                    // Show Open/Close + Direct/Opposite
                                                    if (directOpen && directClose) {
                                                      return "Open + Close • Direct";
                                                    }

                                                    if (directOpen) {
                                                      return "Open • Direct";
                                                    }

                                                    if (directClose) {
                                                      return "Close • Direct";
                                                    }

                                                    if (oppositeOpen && oppositeClose) {
                                                      return "Open + Close • Opposite";
                                                    }

                                                    if (oppositeOpen) {
                                                      return "Open • Opposite";
                                                    }

                                                    if (oppositeClose) {
                                                      return "Close • Opposite";
                                                    }

                                                    return "";
                                                  })()}

                                                  {line.skipReason ? ` (${line.skipReason})` : ""}
                                                </Text>
                                              </View>
                                            ))}

                                          <Text style={styles.criteria}>
                                            Matching Criteria:{" "}
                                            {day.matchingCriteria.length
                                              ? day.matchingCriteria
                                                  .map((value) => `C${value}`)
                                                  .join(", ")
                                              : "None"}
                                          </Text>
                                        </View>
                                      ))}

                                      <Text style={styles.common}>
                                        Common Criteria:{" "}
                                        {record.audit.commonCriteria.length
                                          ? record.audit.commonCriteria
                                              .map((value) => `C${value}`)
                                              .join(", ")
                                          : "None"}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  }
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
  }

const styles = StyleSheet.create({
  wrap: { gap: 12 }, empty: { color: "#52616b" }, group: { gap: 10, borderWidth: 1, borderColor: "#d9e2ec", borderRadius: 10, padding: 12 },

rootSection: {
  gap: 8,
  marginBottom: 16,
},

branchList: {
  gap: 8,
},

  branchGroup: {
    marginLeft: 18,
    borderLeftWidth: 3,
    borderLeftColor: "#d9e2ec",
  },

  heading: {
    color: "#102a43",
    fontWeight: "800",
    fontSize: 17,
  },

  headingGreen: {
    color: "#137333",
  },

  headingRed: {
    color: "#c62828",
  },

  headingNeutral: {
    color: "#52616b",
  },

  day: {
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: "#edf2f7",
    paddingTop: 8,
  },

  dayHeading: {
    color: "#243b53",
    fontWeight: "800",
  },
  line: { backgroundColor: "#f8fafc", borderRadius: 7, padding: 8, gap: 2 }, detail: { color: "#52616b", fontSize: 12 }, match: { color: "#137333", fontWeight: "800" }, skip: { color: "#a15c00", fontWeight: "700" },
  criteria: {
    color: "#334e68",
    fontWeight: "700",
    fontSize: 12,
  },

  common: {
    color: "#0d47a1",
    fontWeight: "800",
  },

  filterRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },

  filterButton: {
    borderWidth: 1,
    borderColor: "#d9e2ec",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
  },

  filterButtonActive: {
    backgroundColor: "#243b53",
    borderColor: "#243b53",
  },

  filterText: {
    color: "#52616b",
    fontWeight: "700",
  },

  filterTextActive: {
    color: "#ffffff",
  },

resultNormal: {
  color: "#137333",
  fontSize: 15,
  fontWeight: "800",
},

resultClose: {
  color: "#d32f2f",
  fontSize: 15,
  fontWeight: "800",
},

resultDirect: {
  color: "#5b21b6",
  fontSize: 15,
  fontWeight: "800",
},

resultOpposite: {
  color: "#c76a00",
  fontSize: 15,
  fontWeight: "800",
},
});
