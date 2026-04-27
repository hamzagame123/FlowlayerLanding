import { FlowLayerApp } from "./app.js";
import { installApiTracker } from "./apiTracker.js";

document.addEventListener("DOMContentLoaded", () => {
    installApiTracker();
    window.flowlayerApp = new FlowLayerApp();
});
