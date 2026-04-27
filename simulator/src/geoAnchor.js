const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_B = WGS84_A * (1 - WGS84_F);
const WGS84_E2 = 1 - (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A);
const WGS84_EP2 = (WGS84_A * WGS84_A - WGS84_B * WGS84_B) / (WGS84_B * WGS84_B);

function toRadians(deg) {
    return deg * Math.PI / 180;
}

function toDegrees(rad) {
    return rad * 180 / Math.PI;
}

export class GeoAnchor {
    constructor(lat, lng, alt = 0) {
        this.lat = lat;
        this.lng = lng;
        this.alt = alt;
        this._origin = this.geodeticToECEF(lat, lng, alt);

        const latRad = toRadians(lat);
        const lngRad = toRadians(lng);
        this._sinLat = Math.sin(latRad);
        this._cosLat = Math.cos(latRad);
        this._sinLng = Math.sin(lngRad);
        this._cosLng = Math.cos(lngRad);
    }

    geodeticToECEF(lat, lng, alt = 0) {
        const latRad = toRadians(lat);
        const lngRad = toRadians(lng);
        const sinLat = Math.sin(latRad);
        const cosLat = Math.cos(latRad);
        const cosLng = Math.cos(lngRad);
        const sinLng = Math.sin(lngRad);
        const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);

        return {
            x: (N + alt) * cosLat * cosLng,
            y: (N + alt) * cosLat * sinLng,
            z: (N * (1 - WGS84_E2) + alt) * sinLat,
        };
    }

    ecefToGeodetic(x, y, z) {
        const p = Math.sqrt(x * x + y * y);
        const theta = Math.atan2(z * WGS84_A, p * WGS84_B);
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        const latRad = Math.atan2(
            z + WGS84_EP2 * WGS84_B * sinTheta * sinTheta * sinTheta,
            p - WGS84_E2 * WGS84_A * cosTheta * cosTheta * cosTheta
        );
        const lngRad = Math.atan2(y, x);
        const sinLat = Math.sin(latRad);
        const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
        const alt = p / Math.cos(latRad) - N;

        return {
            lat: toDegrees(latRad),
            lng: toDegrees(lngRad),
            alt,
        };
    }

    geodeticToLocal(lat, lng, alt = 0) {
        const point = this.geodeticToECEF(lat, lng, alt);
        const dx = point.x - this._origin.x;
        const dy = point.y - this._origin.y;
        const dz = point.z - this._origin.z;

        return {
            east: -this._sinLng * dx + this._cosLng * dy,
            north: -this._sinLat * this._cosLng * dx - this._sinLat * this._sinLng * dy + this._cosLat * dz,
            up: this._cosLat * this._cosLng * dx + this._cosLat * this._sinLng * dy + this._sinLat * dz,
        };
    }

    localToGeodetic(east, north, up = 0) {
        const dx =
            -this._sinLng * east -
            this._sinLat * this._cosLng * north +
            this._cosLat * this._cosLng * up;
        const dy =
            this._cosLng * east -
            this._sinLat * this._sinLng * north +
            this._cosLat * this._sinLng * up;
        const dz =
            this._cosLat * north +
            this._sinLat * up;

        return this.ecefToGeodetic(
            this._origin.x + dx,
            this._origin.y + dy,
            this._origin.z + dz
        );
    }
}
