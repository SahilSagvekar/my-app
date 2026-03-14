export class ServerTiming {
  private timings: Map<string, { start: number; end?: number; desc?: string }> = new Map();

  start(name: string, desc?: string) {
    this.timings.set(name, { start: performance.now(), desc });
  }

  stop(name: string) {
    const timing = this.timings.get(name);
    if (timing) {
      timing.end = performance.now();
    }
  }

  getHeaderValue(): string {
    const parts: string[] = [];
    this.timings.forEach((value, key) => {
      if (value.end) {
        const duration = (value.end - value.start).toFixed(2);
        let part = `${key};dur=${duration}`;
        if (value.desc) {
          part += `;desc="${value.desc}"`;
        }
        parts.push(part);
      }
    });
    return parts.join(', ');
  }
}
