/** A project in a workspace: its name, and the short key its items are numbered with. */
export interface Project {
  name: string;
  key: string;
}

/** Enough projects that a menu listing them wants a filter. */
export const PROJECTS: readonly Project[] = [
  { name: "Atlas", key: "ATL" },
  { name: "Beacon", key: "BCN" },
  { name: "Cinder", key: "CIN" },
  { name: "Delta", key: "DLT" },
  { name: "Ember", key: "EMB" },
  { name: "Fjord", key: "FJD" },
  { name: "Garnet", key: "GRN" },
  { name: "Harbor", key: "HBR" },
  { name: "Indigo", key: "IND" },
  { name: "Juniper", key: "JNP" },
  { name: "Kestrel", key: "KST" },
  { name: "Lumen", key: "LUM" },
  { name: "Meridian", key: "MRD" },
  { name: "Nimbus", key: "NMB" },
  { name: "Orchard", key: "ORC" },
  { name: "Polaris", key: "PLR" },
  { name: "Quarry", key: "QRY" },
  { name: "Saffron", key: "SAF" },
  { name: "Tundra", key: "TND" },
  { name: "Willow", key: "WLW" },
];
