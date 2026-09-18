export type Pattern = "FINAL_DAYS_6" | "FINAL_DAYS_5";

export type Market = {
  id: string;
  name: string;
  pattern: Pattern;
};

export const MARKETS: Market[] = [
  { id: "kalyan", name: "Kalyan", pattern: "FINAL_DAYS_6" },
  { id: "time", name: "Time Bajar", pattern: "FINAL_DAYS_6" },
  { id: "rajdhani", name: "Rajdhani Day", pattern: "FINAL_DAYS_6" },
  { id: "milan", name: "Milan Day", pattern: "FINAL_DAYS_6" },
  { id: "milan-night", name: "Milan Night", pattern: "FINAL_DAYS_6" },
  { id: "rajdhani-night", name: "Rajdhani Night", pattern: "FINAL_DAYS_5" },
  { id: "kalyan-night", name: "Kalyan Night", pattern: "FINAL_DAYS_5" },
  { id: "main-bajar", name: "Main Bajar", pattern: "FINAL_DAYS_5" }
];

export const patternLabel = (pattern: Pattern) =>
  pattern === "FINAL_DAYS_6" ? "Final Pattern – Days 6" : "Final Pattern – Days 5";
