import { DrivingSimulator } from "./drivingSimulator.js";
import { FlowLayerApp } from "./app.js";

window.DrivingSimulator = DrivingSimulator;

document.addEventListener("DOMContentLoaded", () => {
    window.flowlayerApp = new FlowLayerApp();
});
