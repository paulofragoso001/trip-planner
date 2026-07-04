"use client";

import { useCallback, useEffect, useRef } from "react";
import { countryCodeToFlag } from "@/lib/map/wayline-map-pins";

type AppleCanvasGlobeTrip = {
  city: string;
  countryCode: string | null;
  lat: number;
  lng: number;
};

type AppleCanvasGlobeProps = {
  onGlobeClick: () => void;
  savedTrips: AppleCanvasGlobeTrip[];
};

type GlobePoint = [number, number];

type ProjectedPoint = {
  x: number;
  y: number;
  z: number;
};

const LAND_COLOR = "#1A1A1E";
const OCEAN_COLOR = "#0E0F12";
const BORDER_COLOR = "#3F3F46";
const GRID_COLOR = "rgba(63, 63, 70, 0.34)";
const PIN_COLOR = "#E67E22";

const LANDMASSES: GlobePoint[][] = [
  [
    [72, -168],
    [67, -140],
    [59, -124],
    [49, -124],
    [32, -117],
    [16, -101],
    [8, -84],
    [18, -75],
    [26, -82],
    [31, -97],
    [42, -75],
    [53, -58],
    [62, -64],
    [70, -92],
    [74, -120]
  ],
  [
    [12, -82],
    [8, -74],
    [4, -78],
    [-8, -79],
    [-22, -70],
    [-40, -73],
    [-55, -68],
    [-53, -52],
    [-28, -43],
    [-8, -35],
    [5, -51],
    [12, -62]
  ],
  [
    [72, -52],
    [74, -32],
    [64, -18],
    [58, -42],
    [63, -55]
  ],
  [
    [68, -10],
    [64, 20],
    [56, 47],
    [48, 65],
    [55, 92],
    [65, 130],
    [55, 160],
    [36, 142],
    [22, 122],
    [8, 104],
    [20, 80],
    [8, 42],
    [30, 32],
    [36, 10],
    [44, -4],
    [52, -8]
  ],
  [
    [36, -17],
    [31, 32],
    [12, 45],
    [-11, 42],
    [-35, 20],
    [-33, 14],
    [-22, 15],
    [-5, 10],
    [10, -6],
    [28, -12]
  ],
  [
    [8, 96],
    [1, 102],
    [-7, 115],
    [-9, 124],
    [5, 119],
    [17, 105]
  ],
  [
    [-11, 112],
    [-22, 114],
    [-38, 136],
    [-33, 153],
    [-18, 146],
    [-10, 129]
  ],
  [
    [-35, 166],
    [-44, 172],
    [-47, 168],
    [-41, 160]
  ]
];

export default function AppleCanvasGlobe({
  onGlobeClick,
  savedTrips
}: AppleCanvasGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const rotationRef = useRef(-1.35);
  const velocityRef = useRef(0);
  const isDraggingRef = useRef(false);
  const previousXRef = useRef(0);
  const dragDistanceRef = useRef(0);
  const tripsRef = useRef(savedTrips);
  const onGlobeClickRef = useRef(onGlobeClick);

  useEffect(() => {
    tripsRef.current = savedTrips;
  }, [savedTrips]);

  useEffect(() => {
    onGlobeClickRef.current = onGlobeClick;
  }, [onGlobeClick]);

  const drawGlobe = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const pixelRatio = window.devicePixelRatio || 1;
    const width = canvas.width / pixelRatio;
    const height = canvas.height / pixelRatio;
    const radius = Math.min(width, height) * 0.37;
    const centerX = width / 2;
    const centerY = height * 0.45;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    const atmosphere = context.createRadialGradient(
      centerX - radius * 0.28,
      centerY - radius * 0.32,
      radius * 0.08,
      centerX,
      centerY,
      radius * 1.18
    );
    atmosphere.addColorStop(0, "rgba(255,255,255,0.10)");
    atmosphere.addColorStop(0.48, OCEAN_COLOR);
    atmosphere.addColorStop(1, "rgba(5,8,13,0.96)");

    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = atmosphere;
    context.fill();
    context.clip();

    drawGrid(context, centerX, centerY, radius, rotationRef.current);
    drawLandmasses(context, centerX, centerY, radius, rotationRef.current);
    drawTripPins(context, centerX, centerY, radius, rotationRef.current, tripsRef.current);

    context.restore();

    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.strokeStyle = BORDER_COLOR;
    context.lineWidth = 1.4;
    context.stroke();

    context.beginPath();
    context.arc(centerX - radius * 0.12, centerY - radius * 0.1, radius * 0.98, 0, Math.PI * 2);
    context.strokeStyle = "rgba(255,255,255,0.05)";
    context.lineWidth = 10;
    context.stroke();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * pixelRatio));
      canvas.height = Math.max(1, Math.round(rect.height * pixelRatio));
      drawGlobe();
    };

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    resizeCanvas();

    const animate = () => {
      if (!isDraggingRef.current) {
        rotationRef.current = normalizeRotation(rotationRef.current + 0.0012 + velocityRef.current);
        velocityRef.current *= 0.94;
      }

      drawGlobe();
      frameRef.current = window.requestAnimationFrame(animate);
    };

    frameRef.current = window.requestAnimationFrame(animate);

    return () => {
      observer.disconnect();
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [drawGlobe]);

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    isDraggingRef.current = true;
    previousXRef.current = event.clientX;
    dragDistanceRef.current = 0;
    velocityRef.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDraggingRef.current) return;

    const deltaX = event.clientX - previousXRef.current;
    dragDistanceRef.current += Math.abs(deltaX);
    rotationRef.current = normalizeRotation(rotationRef.current + deltaX * 0.006);
    velocityRef.current = deltaX * 0.00042;
    previousXRef.current = event.clientX;
    drawGlobe();
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    isDraggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleClick() {
    if (dragDistanceRef.current > 10) return;
    onGlobeClickRef.current();
  }

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#090E14]"
      data-testid="apple-canvas-globe"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(255,255,255,0.07),rgba(9,14,20,0)_38%),linear-gradient(180deg,rgba(9,14,20,0.12),rgba(9,14,20,0.84))]"
      />
      <canvas
        aria-label="Interactive rotating travel globe"
        className="relative h-full min-h-[32rem] w-full cursor-grab touch-none active:cursor-grabbing"
        onClick={handleClick}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerLeave={() => {
          isDraggingRef.current = false;
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={canvasRef}
        role="img"
      />
      <span className="pointer-events-none absolute bottom-[calc(17rem+env(safe-area-inset-bottom))] select-none text-center text-[10px] font-black uppercase tracking-[0.24em] text-white/42">
        Swipe cards or tap globe to inspect routes
      </span>
    </div>
  );
}

function drawGrid(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  rotation: number
) {
  context.strokeStyle = GRID_COLOR;
  context.lineWidth = 0.7;

  for (let latitude = -60; latitude <= 60; latitude += 30) {
    const y = centerY - radius * Math.sin(toRadians(latitude));
    const parallelRadius = radius * Math.cos(toRadians(latitude));

    context.beginPath();
    context.ellipse(centerX, y, parallelRadius, parallelRadius * 0.18, 0, 0, Math.PI * 2);
    context.stroke();
  }

  for (let longitude = -120; longitude <= 120; longitude += 30) {
    context.beginPath();
    for (let latitude = -84; latitude <= 84; latitude += 4) {
      const point = projectPoint(latitude, longitude, rotation, radius, centerX, centerY);
      if (latitude === -84) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    }
    context.stroke();
  }
}

function drawLandmasses(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  rotation: number
) {
  LANDMASSES.forEach((landmass) => {
    const projected = landmass.map(([lat, lng]) =>
      projectPoint(lat, lng, rotation, radius, centerX, centerY)
    );
    const visible = projected.filter((point) => point.z > -0.05);

    if (visible.length < 3) return;

    context.beginPath();
    visible.forEach((point, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    });
    context.closePath();
    context.fillStyle = LAND_COLOR;
    context.fill();
    context.strokeStyle = BORDER_COLOR;
    context.lineWidth = 1.1;
    context.stroke();
  });
}

function drawTripPins(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  rotation: number,
  trips: AppleCanvasGlobeTrip[]
) {
  trips.forEach((trip) => {
    const point = projectPoint(trip.lat, trip.lng, rotation, radius, centerX, centerY);
    if (point.z <= 0) return;

    const flag = trip.countryCode ? countryCodeToFlag(trip.countryCode) ?? "" : "";
    const scale = 0.72 + point.z * 0.32;
    const pinRadius = 13 * scale;

    context.save();
    context.globalAlpha = 0.72 + point.z * 0.28;

    context.beginPath();
    context.arc(point.x, point.y, pinRadius + 4, 0, Math.PI * 2);
    context.fillStyle = "rgba(230,126,34,0.32)";
    context.fill();

    context.beginPath();
    context.arc(point.x, point.y, pinRadius, 0, Math.PI * 2);
    context.fillStyle = "#f7f4ec";
    context.fill();
    context.strokeStyle = PIN_COLOR;
    context.lineWidth = 2.5;
    context.stroke();

    context.font = `${Math.round(16 * scale)}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#111216";
    context.fillText(flag || "•", point.x, point.y);

    context.font = "800 11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.lineWidth = 4;
    context.strokeStyle = "rgba(0,0,0,0.72)";
    context.strokeText(trip.city, point.x + pinRadius + 6, point.y + 1);
    context.fillStyle = "#FFFFFF";
    context.fillText(trip.city, point.x + pinRadius + 6, point.y + 1);
    context.restore();
  });
}

function projectPoint(
  latitude: number,
  longitude: number,
  rotation: number,
  radius: number,
  centerX: number,
  centerY: number
): ProjectedPoint {
  const lat = toRadians(latitude);
  const lng = toRadians(longitude) + rotation;

  return {
    x: centerX + radius * Math.cos(lat) * Math.sin(lng),
    y: centerY - radius * Math.sin(lat),
    z: Math.cos(lat) * Math.cos(lng)
  };
}

function normalizeRotation(rotation: number) {
  const tau = Math.PI * 2;
  return ((rotation % tau) + tau) % tau;
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}
