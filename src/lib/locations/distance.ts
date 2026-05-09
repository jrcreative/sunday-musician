export type Coordinates = {
  lat: number | null;
  lng: number | null;
};

export function distanceMiles(from: Coordinates, to: Coordinates) {
  if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) return null;
  const earthRadiusMiles = 3958.8;
  const toRad = (degrees: number) => degrees * Math.PI / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
