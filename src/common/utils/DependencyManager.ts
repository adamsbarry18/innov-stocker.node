import { type Service, ResourcesKeys, DependentWrapper } from './Service';

let instance: DependencyManager | null = null;

interface IRegisteredService {
  service: Service;
  dependencies: ResourcesKeys[];
}

export class DependencyManager {
  services: {
    [key in ResourcesKeys]?: IRegisteredService;
  };

  constructor() {
    if (instance !== null) {
      throw new Error('DependencyManager is already created');
    }
    this.services = {};
  }

  static getInstance(): DependencyManager {
    instance ??= new DependencyManager();
    return instance;
  }

  /**
   * Registers service's dependency getters information
   * @param service Service to register
   * @param entityKey Entity key to register
   * @param dependencies Dependencies of to the entity
   */
  registerDependencies(
    service: Service,
    entityKey: ResourcesKeys,
    dependencies: ResourcesKeys[],
  ): void {
    this.services[entityKey] = {
      service,
      dependencies,
    };
  }

  /**
   * Return dependents entities for given entity
   * @param entityKey Entity to check
   * @param id Entity id
   */
  async getDependents(entityKey: ResourcesKeys, id: number): Promise<DependentWrapper[]> {
    const res: DependentWrapper[] = [];
    for (const key of Object.keys(this.services) as ResourcesKeys[]) {
      const serviceRef = this.services[key];
      if (serviceRef && serviceRef.dependencies.includes(entityKey)) {
        const entities = await serviceRef.service.getDependentEntities(entityKey, id);
        for (const entity of entities) {
          res.push(new DependentWrapper(key, entity.resourceId, entity.preventDeletion));
        }
      }
    }
    return res;
  }
}
