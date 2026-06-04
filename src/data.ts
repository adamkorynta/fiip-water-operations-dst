export type BasinId = "mission-south" | "mission-north" | "jocko" | "little-bitterroot";
export type Status = "ok" | "watch" | "warning" | "critical";
export type WaterYear = "dry" | "normal" | "wet";

export interface Reservoir {
  name: string;
  storageAf: number;
  capacityAf: number;
  minPoolAf: number;
}

export interface FlowPoint {
  name: string;
  currentCfs: number;
  mefCfs: number;
  tifCfs: number;
}

export interface OperationPin {
  name: string;
  kind: "reservoir" | "diversion" | "turnout" | "stream";
  lat: number;
  lng: number;
  status: Status;
  detail: string;
  source: "published coordinate" | "prototype approximate";
}

export interface Basin {
  id: BasinId;
  name: string;
  image: string;
  acres: number;
  canalsMiles: number;
  forecastAf: number;
  demandAf: number;
  rdaAf: number;
  swePercent: number;
  etInchesWeek: number;
  conveyanceLossPercent: number;
  mapCenter: [number, number];
  mapZoom: number;
  reservoirs: Reservoir[];
  flowPoints: FlowPoint[];
  mapPins: OperationPin[];
  actions: string[];
  notes: string[];
}

export const basins: Basin[] = [
  {
    id: "mission-south",
    name: "Mission South",
    image: "images/kicking-horse-reservoir.jpeg",
    acres: 39200,
    canalsMiles: 340,
    forecastAf: 135000,
    demandAf: 121700,
    rdaAf: 142000,
    swePercent: 86,
    etInchesWeek: 1.42,
    conveyanceLossPercent: 13,
    mapCenter: [47.49, -114.12],
    mapZoom: 10,
    reservoirs: [
      { name: "Kicking Horse", storageAf: 11820, capacityAf: 14300, minPoolAf: 1230 },
      { name: "Pablo", storageAf: 9100, capacityAf: 13100, minPoolAf: 1425 },
      { name: "Ninepipe", storageAf: 7120, capacityAf: 9800, minPoolAf: 1905 },
    ],
    flowPoints: [
      { name: "Mission Creek below Pablo Feeder", currentCfs: 132, mefCfs: 115, tifCfs: 160 },
      { name: "Post Creek below McDonald Reservoir", currentCfs: 148, mefCfs: 140, tifCfs: 160 },
      { name: "Crow Creek below Moiese A Canal", currentCfs: 36, mefCfs: 30, tifCfs: 75 },
    ],
    mapPins: [
      { name: "Kicking Horse Reservoir", kind: "reservoir", lat: 47.4538217, lng: -114.0776101, status: "ok", detail: "Mission Valley storage reservoir", source: "published coordinate" },
      { name: "Pablo Reservoir", kind: "reservoir", lat: 47.6351977, lng: -114.1579605, status: "watch", detail: "Mission South/Pablo storage context", source: "published coordinate" },
      { name: "Ninepipe Reservoir", kind: "reservoir", lat: 47.453266, lng: -114.1342802, status: "watch", detail: "Mission Valley reservoir and refuge area", source: "published coordinate" },
      { name: "Mission Creek below Pablo Feeder", kind: "stream", lat: 47.415, lng: -114.079, status: "warning", detail: "MEF/TIF compliance check", source: "prototype approximate" },
      { name: "Crow Creek below Moiese A Canal", kind: "diversion", lat: 47.505, lng: -114.214, status: "watch", detail: "RDA and diversion allowance review point", source: "prototype approximate" },
    ],
    actions: [
      "Hold Pablo Feeder near current setting until Mission Creek reaches TIF buffer.",
      "Compare Kicking Horse releases against projected ET demand for the next 7 days.",
      "Flag Crow Creek diversion allowance for operator review before afternoon adjustment.",
    ],
    notes: [
      "Compact criteria are tightest on Mission Creek and Post Creek during June operations.",
      "Conveyance loss assumptions should be calibrated during 2026 operator shadowing.",
    ],
  },
  {
    id: "mission-north",
    name: "Mission North",
    image: "images/mcdonald-lake.jpeg",
    acres: 31800,
    canalsMiles: 290,
    forecastAf: 111500,
    demandAf: 99000,
    rdaAf: 103500,
    swePercent: 94,
    etInchesWeek: 1.26,
    conveyanceLossPercent: 11,
    mapCenter: [47.43, -114.04],
    mapZoom: 10,
    reservoirs: [
      { name: "McDonald", storageAf: 18400, capacityAf: 22100, minPoolAf: 385 },
      { name: "Mission", storageAf: 7600, capacityAf: 10300, minPoolAf: 1006 },
      { name: "Turtle Lake", storageAf: 4300, capacityAf: 5900, minPoolAf: 96 },
    ],
    flowPoints: [
      { name: "Post Creek below F Canal", currentCfs: 69, mefCfs: 60, tifCfs: 130 },
      { name: "North Crow Creek below Pablo Feeder", currentCfs: 31, mefCfs: 27, tifCfs: 37 },
      { name: "Mud Creek below Ronan B Canal", currentCfs: 10, mefCfs: 9, tifCfs: 9 },
    ],
    mapPins: [
      { name: "McDonald Lake / Reservoir", kind: "reservoir", lat: 47.4212489, lng: -113.9774675, status: "ok", detail: "Mission Mountains storage reservoir", source: "published coordinate" },
      { name: "Mission Reservoir", kind: "reservoir", lat: 47.3192492, lng: -114.0083493, status: "ok", detail: "Mission-area reservoir minimum-pool context", source: "published coordinate" },
      { name: "Post Creek below F Canal", kind: "stream", lat: 47.465, lng: -114.075, status: "watch", detail: "Compact flow criterion", source: "prototype approximate" },
      { name: "North Crow Creek below Pablo Feeder", kind: "stream", lat: 47.5, lng: -114.09, status: "ok", detail: "MEF/TIF review point", source: "prototype approximate" },
    ],
    actions: [
      "Maintain McDonald Reservoir releases and monitor Post Creek response.",
      "Review North Crow Creek trend after morning measurement import.",
      "Queue Mission Reservoir minimum-pool check for weekly operations meeting.",
    ],
    notes: [
      "Mission North can reuse the Mission South interface with local canal constraints.",
      "Reservoir minimum-pool documentation needs to be visible in review mode.",
    ],
  },
  {
    id: "jocko",
    name: "Jocko",
    image: "images/flathead-river.jpeg",
    acres: 28600,
    canalsMiles: 250,
    forecastAf: 94400,
    demandAf: 103200,
    rdaAf: 97000,
    swePercent: 72,
    etInchesWeek: 1.51,
    conveyanceLossPercent: 15,
    mapCenter: [47.22, -114.12],
    mapZoom: 10,
    reservoirs: [
      { name: "Tabor", storageAf: 15400, capacityAf: 18162, minPoolAf: 12119 },
      { name: "Lower Dry Fork", storageAf: 2120, capacityAf: 4100, minPoolAf: 636 },
      { name: "Upper Dry Fork", storageAf: 2400, capacityAf: 4900, minPoolAf: 413 },
    ],
    flowPoints: [
      { name: "Jocko River below Lower J Canal", currentCfs: 232, mefCfs: 250, tifCfs: 530 },
      { name: "North Fork Jocko below Tabor Feeder", currentCfs: 34, mefCfs: 30, tifCfs: 44 },
      { name: "Big Knife Creek below Upper Jocko S", currentCfs: 8, mefCfs: 8, tifCfs: 8 },
    ],
    mapPins: [
      { name: "Tabor Reservoir", kind: "reservoir", lat: 47.225, lng: -113.93, status: "watch", detail: "Seasonal minimum-pool rule placeholder", source: "prototype approximate" },
      { name: "Jocko River below Lower J Canal", kind: "stream", lat: 47.196, lng: -114.172, status: "critical", detail: "Critical MEF shortfall in current scenario", source: "prototype approximate" },
      { name: "Jocko K Canal", kind: "diversion", lat: 47.205, lng: -114.105, status: "critical", detail: "Secondary diversion decision point", source: "prototype approximate" },
      { name: "North Fork Jocko below Tabor Feeder", kind: "stream", lat: 47.255, lng: -113.995, status: "watch", detail: "Compact flow criterion", source: "prototype approximate" },
    ],
    actions: [
      "Reduce Jocko K Canal diversion until Lower Jocko MEF compliance recovers.",
      "Preserve Tabor storage buffer through current dry-year forecast window.",
      "Send North Fork Jocko flow point to field verification list.",
    ],
    notes: [
      "Dry-year supply suggests operator review before expanding Jocko K diversion.",
      "Tabor seasonal minimum-pool rule should be modeled by date window.",
    ],
  },
  {
    id: "little-bitterroot",
    name: "Little Bitterroot",
    image: "images/flathead-river.jpeg",
    acres: 17400,
    canalsMiles: 220,
    forecastAf: 52200,
    demandAf: 47800,
    rdaAf: 47200,
    swePercent: 81,
    etInchesWeek: 1.35,
    conveyanceLossPercent: 12,
    mapCenter: [47.61, -114.55],
    mapZoom: 10,
    reservoirs: [
      { name: "Hubbart", storageAf: 2200, capacityAf: 3600, minPoolAf: 27 },
      { name: "Lower Crow", storageAf: 3900, capacityAf: 6200, minPoolAf: 2039 },
    ],
    flowPoints: [
      { name: "Little Bitterroot above Mill Creek", currentCfs: 7, mefCfs: 6, tifCfs: 6 },
      { name: "Mill Creek below Camas A", currentCfs: 2, mefCfs: 1, tifCfs: 1 },
      { name: "Hot Springs Creek below Camas C", currentCfs: 1.2, mefCfs: 1, tifCfs: 1 },
    ],
    mapPins: [
      { name: "Little Bitterroot River below Camas A", kind: "diversion", lat: 47.601, lng: -114.665, status: "ok", detail: "Camas A Canal headworks decision point", source: "prototype approximate" },
      { name: "Mill Creek near mouth", kind: "stream", lat: 47.587, lng: -114.599, status: "ok", detail: "MEF compliance point", source: "prototype approximate" },
      { name: "Hot Springs Creek confluence", kind: "stream", lat: 47.610833, lng: -114.551389, status: "watch", detail: "Little Bitterroot tributary confluence", source: "published coordinate" },
      { name: "Hubbart Reservoir", kind: "reservoir", lat: 47.682, lng: -114.428, status: "watch", detail: "Minimum-pool storage context", source: "prototype approximate" },
    ],
    actions: [
      "Keep Camas A diversion within current low-flow allowance.",
      "Monitor Hot Springs Creek confluence after next gage update.",
      "Check Hubbart Reservoir storage against minimum-pool buffer.",
    ],
    notes: [
      "Low-flow criteria are simple but sensitive to small measurement changes.",
      "Final buildout should track post-rehabilitation monitoring changes.",
    ],
  },
];

export const criteria = [
  "Minimum Enforceable Flows",
  "Target Instream Flows",
  "River Diversion Allowances",
  "Minimum reservoir pools",
  "Conveyance losses and limits",
  "Acreage served at turnout groups",
];
