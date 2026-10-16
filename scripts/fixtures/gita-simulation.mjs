// Synthetic, disconnected fixture. The runner injects a bug only in its workspace.
export function simulationStatus(value) {
  return String(value ?? '').trim().toUpperCase();
}
