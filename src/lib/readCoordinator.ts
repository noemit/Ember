type Mode = 'tail' | 'full';
type Flight = { mode: Mode; promise: Promise<void>; repair?: Promise<void> };

export class ReadCoordinator {
  private flights = new Map<string, Flight>();

  run(key: string, mode: Mode, task: () => Promise<void>, afterCurrent = false): Promise<void> {
    const existing = this.flights.get(key);
    if (existing) {
      if (!afterCurrent && (mode === 'tail' || existing.mode === 'full')) return existing.repair ?? existing.promise;
      existing.repair ??= existing.promise.catch(() => {}).then(() => this.run(key, 'full', task));
      return existing.repair;
    }
    const flight: Flight = { mode, promise: Promise.resolve() };
    this.flights.set(key, flight);
    flight.promise = Promise.resolve().then(task).finally(() => {
      if (this.flights.get(key) === flight) this.flights.delete(key);
    });
    return flight.promise;
  }
}
