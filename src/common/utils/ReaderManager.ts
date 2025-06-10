import { type Service } from './Service';

let instance: ReadyManager | null = null;

interface IReadyStatus {
  isReady: boolean;
  details: { name: string; isReady: boolean }[];
}

export class ReadyManager {
  services: Service[];

  constructor() {
    if (instance !== null) {
      throw new Error('ReadyManager is already created');
    }

    this.services = [];
  }

  static getInstance(): ReadyManager {
    instance ??= new ReadyManager();
    return instance;
  }

  /**
   * Registers service's ready getters information
   * @param service Service
   */
  registerService(service: Service): void {
    if (service) this.services.push(service);
  }

  /**
   * Return all services ready
   * @returns Service status
   */
  get status(): IReadyStatus {
    // Retrieved all services status not ready
    const servicesStatus = this.services
      .map((service) => ({
        name: service.constructor.name,
        // Hack to access static property via constructor https://github.com/microsoft/TypeScript/issues/32452
        isReady: (service.constructor as unknown as typeof Service).isReady,
      }))
      .filter((s) => !s.isReady);
    return {
      isReady: servicesStatus.length === 0,
      details: servicesStatus,
    };
  }
}
