/**
 * MiniMap — A Leaflet-based mini-map overlay that tracks the car's geo position.
 */

export class MiniMap {
    constructor(containerId = "miniMapContainer", anchorLat = 43.6433, anchorLng = -79.3713) {
        this.container = document.getElementById(containerId);
        this.map = null;
        this.marker = null;
        this.headingLine = null;
        this.routePolyline = null;
        this.isExpanded = false;
        this.currentLat = anchorLat;
        this.currentLng = anchorLng;

        if (!this.container) return;
        this._init();
    }

    _init() {
        if (typeof L === "undefined") {
            console.warn("[MiniMap] Leaflet not loaded — mini-map disabled.");
            return;
        }

        this.map = L.map(this.container, {
            center: [this.currentLat, this.currentLng],
            zoom: 17,
            zoomControl: true,
            attributionControl: false,
            minZoom: 2,
            maxZoom: 19,
            dragging: true,
            scrollWheelZoom: true,
            doubleClickZoom: false,
            touchZoom: true,
            keyboard: true,
        });

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
        }).addTo(this.map);

        this.map.whenReady(() => {
            this.map.invalidateSize();
        });

        // Car marker — pulsing dot
        const carIcon = L.divIcon({
            className: "minimap-car-icon",
            iconSize: [16, 16],
            iconAnchor: [8, 8],
        });

        this.marker = L.marker([this.currentLat, this.currentLng], { icon: carIcon }).addTo(this.map);

        // Heading indicator line
        this.headingLine = L.polyline(
            [
                [this.currentLat, this.currentLng],
                [this.currentLat + 0.001, this.currentLng],
            ],
            { color: "#facc15", weight: 3, opacity: 0.95 }
        ).addTo(this.map);

        this.container.addEventListener("dblclick", () => this.toggleExpanded());
    }

    /**
     * Update marker with the car's geo-position and heading.
     * @param {number} lat — car latitude
     * @param {number} lng — car longitude
     * @param {number} heading — car heading in radians
     */
    update(lat, lng, heading) {
        if (!this.map || !this.marker) return;

        this.currentLat = lat;
        this.currentLng = lng;

        this.marker.setLatLng([lat, lng]);
        if (!this.isExpanded) {
            this.map.panTo([lat, lng], { animate: false });
        }

        // Update heading line
        const headLen = 0.0008;
        // Cesium heading is standard (0 = North, pi/2 = East)
        const headLat = lat + headLen * Math.cos(heading);
        const headLng = lng + headLen * Math.sin(heading);
        this.headingLine.setLatLngs([
            [lat, lng],
            [headLat, headLng],
        ]);
    }

    /** Set the active route polyline on the minimap */
    setRoute(coords, hexColor = "#facc15") {
        if (!this.map) return;
        
        if (this.routePolyline) {
            this.map.removeLayer(this.routePolyline);
        }

        // coords are expected as [lng, lat] from CesiumRoutes logic
        // Leaflet wants [lat, lng]
        const latLngs = coords.map(c => [c[1], c[0]]);
        
        this.routePolyline = L.polyline(latLngs, {
            color: hexColor,
            weight: 6,
            opacity: 1
        }).addTo(this.map);

        if (latLngs.length > 1 && !this.isExpanded) {
            this.map.fitBounds(this.routePolyline.getBounds(), {
                padding: [20, 20],
                maxZoom: 16,
            });
        }
    }

    setExpanded(expanded) {
        if (!this.container) return;
        this.isExpanded = !!expanded;
        this.container.classList.toggle("expanded", this.isExpanded);
        if (this.map) {
            setTimeout(() => this.map.invalidateSize(), 180);
        }
    }

    toggleExpanded() {
        this.setExpanded(!this.isExpanded);
        return this.isExpanded;
    }

    /** Get current geo-position. */
    getPosition() {
        return { lat: this.currentLat, lng: this.currentLng };
    }
}
