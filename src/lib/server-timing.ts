export class ServerTiming {
  private startTimes: Map<string, number> = new Map();
  private measurements: { name: string; duration: number; description?: string }[] = [];

  start(name: string) {
    this.startTimes.set(name, performance.now());
  }

  stop(name: string, description?: string) {
    const start = this.startTimes.get(name);
    if (start) {
      const duration = performance.now() - start;
      this.measurements.push({ name, duration, description });
      this.startTimes.delete(name);
    }
  }

  getHeaderValue(): string {
    return this.measurements
      .map(m => {
        let val = `${m.name};dur=${m.duration.toFixed(2)}`;
        if (m.description) val += `;desc="${m.description}"`;
        return val;
      })
      .join(', ');
  }
}
