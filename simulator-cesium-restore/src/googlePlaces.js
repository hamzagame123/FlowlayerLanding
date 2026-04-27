let mapsLoaderPromise = null;

function buildMapsScriptUrl(apiKey) {
    const callbackName = "__flowlayerMapsReady";
    const params = new URLSearchParams({
        key: apiKey,
        libraries: "places",
        loading: "async",
        callback: callbackName,
    });
    return {
        callbackName,
        url: `https://maps.googleapis.com/maps/api/js?${params.toString()}`,
    };
}

export function loadGooglePlacesLibrary() {
    if (window.google?.maps?.places) {
        window.flowlayerApiTracker?.mark('places', 'success', 'Library ready');
        return Promise.resolve(window.google.maps);
    }

    if (mapsLoaderPromise) return mapsLoaderPromise;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        return Promise.reject(new Error("Google Maps API key not configured"));
    }

    mapsLoaderPromise = new Promise((resolve, reject) => {
        window.flowlayerApiTracker?.mark('places', 'active', 'Loading browser library');
        const existingScript = document.querySelector('script[data-flowlayer-google-places="true"]');
        if (existingScript) {
            existingScript.addEventListener("load", () => {
                window.flowlayerApiTracker?.mark('places', 'success', 'Library ready');
                resolve(window.google.maps);
            }, { once: true });
            existingScript.addEventListener("error", () => {
                window.flowlayerApiTracker?.mark('places', 'error', 'Script failed');
                reject(new Error("Google Places script failed to load"));
            }, { once: true });
            return;
        }

        const { callbackName, url } = buildMapsScriptUrl(apiKey);
        window[callbackName] = () => {
            window.flowlayerApiTracker?.mark('places', 'success', 'Library ready');
            resolve(window.google.maps);
            delete window[callbackName];
        };

        const script = document.createElement("script");
        script.src = url;
        script.async = true;
        script.defer = true;
        script.dataset.flowlayerGooglePlaces = "true";
        script.onerror = () => {
            delete window[callbackName];
            window.flowlayerApiTracker?.mark('places', 'error', 'Script failed');
            reject(new Error("Google Places script failed to load"));
        };
        document.head.appendChild(script);
    });

    return mapsLoaderPromise;
}
