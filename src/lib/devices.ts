import type { DeviceKind } from "./api";

export const DEVICE_KIND_LABEL: Record<DeviceKind, string> = {
  computer: "Computer",
  laptop: "Laptop",
  smartphone: "Smartphone",
  tablet: "Tablet",
  monitor: "Monitor",
  grafikkarte: "Grafikkarte",
  prozessor: "Prozessor",
  arbeitsspeicher: "Arbeitsspeicher",
  konsole: "Spielkonsole",
  kamera: "Kamera",
  audio: "Audio",
  sonstiges: "Sonstiges",
};
