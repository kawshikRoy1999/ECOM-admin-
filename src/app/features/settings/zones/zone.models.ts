/** Flat row as returned by GetZoneDetails (one row per zip pattern). */
export interface ZoneRow {
  zoneId: number;
  companyId: number;
  id: string;
  zoneName: string;
  zipPattern: string;
  zonePatternId: number;
  isDefault: boolean;
}

export interface ZipPattern {
  zonePatternId: number;
  zipPattern: string;
}

/** A zone grouped from the flat rows: name + its zip patterns. */
export interface Zone {
  zoneId: number;
  zoneName: string;
  isDefault: boolean;
  patterns: ZipPattern[];
}

/** Group the flat GetZoneDetails rows into zones. */
export function groupZones(rows: ZoneRow[]): Zone[] {
  const map = new Map<number, Zone>();
  for (const r of rows) {
    let z = map.get(r.zoneId);
    if (!z) {
      z = { zoneId: r.zoneId, zoneName: r.zoneName, isDefault: r.isDefault, patterns: [] };
      map.set(r.zoneId, z);
    }
    if (r.zipPattern) {
      z.patterns.push({ zonePatternId: r.zonePatternId, zipPattern: r.zipPattern });
    }
  }
  return [...map.values()];
}
