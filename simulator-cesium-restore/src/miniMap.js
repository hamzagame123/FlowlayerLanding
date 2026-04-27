import mapboxgl from "mapbox-gl/dist/mapbox-gl-csp";
import MapboxWorker from "mapbox-gl/dist/mapbox-gl-csp-worker?worker";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.workerClass = MapboxWorker;

function toLngLat(point) {
    if (Array.isArray(point)) return [Number(point[0]), Number(point[1])];
    if (point && Number.isFinite(point.lng) && Number.isFinite(point.lat)) return [point.lng, point.lat];
    return [-79.3713, 43.6433];
}

function metersToLng(meters, latitude) {
    return meters / (111320 * Math.cos(latitude * Math.PI / 180));
}

function metersToLat(meters) {
    return meters / 110540;
}

function offsetLngLat(point, headingDegrees, forwardMeters = 0) {
    const [lng, lat] = point;
    const heading = headingDegrees * Math.PI / 180;
    return [
        lng + metersToLng(Math.sin(heading) * forwardMeters, lat),
        lat + metersToLat(Math.cos(heading) * forwardMeters),
    ];
}

export class MiniMap {
    constructor(containerId = "miniMapContainer", anchorLat = 43.6433, anchorLng = -79.3713) {
        this.container = document.getElementById(containerId);
        this.map = null;
        this.marker = null;
        this.routeReady = false;
        this.routeData = null;
        this.isExpanded = false;
        this.currentLat = anchorLat;
        this.currentLng = anchorLng;
        this.currentHeading = 0;
        this._styleInitialized = false;

        if (!this.container) return;
        this._init();
    }

    _init() {
        const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
        if (!accessToken) {
            console.warn("[MiniMap] Missing VITE_MAPBOX_ACCESS_TOKEN.");
            return;
        }

        mapboxgl.accessToken = accessToken;

        this.map = new mapboxgl.Map({
            container: this.container,
            style: "mapbox://styles/mapbox/dark-v11",
            center: [this.currentLng, this.currentLat],
            zoom: 16.4,
            pitch: 70,
            bearing: 0,
            interactive: false,
            attributionControl: false,
        });

        this.map.once("load", () => this._onStyleReady());
        this.map.once("style.load", () => this._onStyleReady());
    }

    _onStyleReady() {
        if (!this.map || this._styleInitialized) return;
        this._styleInitialized = true;

        this.map.addSource("minimap-route", {
            type: "geojson",
            data: {
                type: "Feature",
                geometry: { type: "LineString", coordinates: [] },
                properties: {},
            },
        });

        this.map.addLayer({
            id: "minimap-route-glow",
            type: "line",
            source: "minimap-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": "#67e8f9",
                "line-width": 9,
                "line-opacity": 0.2,
                "line-blur": 3,
            },
        });

        this.map.addLayer({
            id: "minimap-route-core",
            type: "line",
            source: "minimap-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": "#facc15",
                "line-width": 4,
                "line-opacity": 0.95,
            },
        });

        const firstSymbolLayer = this.map.getStyle().layers.find(layer => layer.type === "symbol")?.id;
        this.map.addLayer({
            id: "minimap-3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", ["get", "extrude"], "true"],
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
                "fill-extrusion-color": [
                    "interpolate",
                    ["linear"],
                    ["get", "height"],
                    0, "#142235",
                    80, "#27435f",
                    180, "#3b6988",
                ],
                "fill-extrusion-height": ["coalesce", ["get", "height"], 12],
                "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
                "fill-extrusion-opacity": 0.9,
                "fill-extrusion-vertical-gradient": true,
            },
        }, firstSymbolLayer);

        const markerEl = document.createElement("div");
        markerEl.className = "minimap-car-icon";
        this.marker = new mapboxgl.Marker({
            element: markerEl,
            rotationAlignment: "map",
            pitchAlignment: "viewport",
        }).setLngLat([this.currentLng, this.currentLat]).addTo(this.map);

        if (this.routeData) this.setRoute(this.routeData.coords, this.routeData.hexColor);
        this.update(this.currentLat, this.currentLng, this.currentHeading);
        this.map.resize();
    }

    update(lat, lng, heading) {
        if (!this.map || !this.marker) return;

        this.currentLat = lat;
        this.currentLng = lng;
        this.currentHeading = heading;

        const lngLat = [lng, lat];
        const bearing = (heading * 180) / Math.PI;
        const focus = offsetLngLat(lngLat, bearing, this.isExpanded ? 120 : 84);
        this.marker.setLngLat(lngLat);
        this.marker.setRotation(bearing);

        this.map.jumpTo({
            center: focus,
            zoom: this.isExpanded ? 16.8 : 16.4,
            pitch: this.isExpanded ? 72 : 70,
            bearing,
        });
    }

    setRoute(coords, hexColor = "#facc15") {
        this.routeData = { coords, hexColor };
        if (!this.map || !this._styleInitialized) return;

        const routeCoords = coords.map(toLngLat);
        const source = this.map.getSource("minimap-route");
        if (source) {
            source.setData({
                type: "Feature",
                geometry: { type: "LineString", coordinates: routeCoords },
                properties: {},
            });
            this.map.setPaintProperty("minimap-route-core", "line-color", hexColor);
            this.map.setPaintProperty("minimap-route-glow", "line-color", hexColor);
        }
    }

    setExpanded(expanded) {
        if (!this.container) return;
        this.isExpanded = !!expanded;
        this.container.classList.toggle("expanded", this.isExpanded);
        if (this.map) {
            setTimeout(() => {
                this.map.resize();
                this.update(this.currentLat, this.currentLng, this.currentHeading);
            }, 180);
        }
    }

    toggleExpanded() {
        this.setExpanded(!this.isExpanded);
        return this.isExpanded;
    }

    getPosition() {
        return { lat: this.currentLat, lng: this.currentLng };
    }
}
