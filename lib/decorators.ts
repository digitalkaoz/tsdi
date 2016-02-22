import 'reflect-metadata';

export type Constructable<T> = { new(...args: any[]): T; };

export interface IComponentOptions {
  name?: string;
}

export interface IInjectOptions {
  name?: string;
}

type InjectMetadata = {
  property: string;
  rtti: Constructable<any>;
  options: IInjectOptions;
};

type ComponentMetadata = {
  fn: Constructable<any>;
  options: IComponentOptions;
};

type ComponentListener = (componentMetadata: ComponentMetadata) => void;

function findIndexOf<T>(list: T[], test: (element: T) => boolean): number {
  let idx: number = -1;
  for (let i: number = 0, n: number = list.length; i < n; i++) {
    if (test(list[i])) {
      idx = i;
    }
  }
  return idx;
}

function removeElement<T>(list: T[], test: (element: T) => boolean): T[] {
  const idx: number = findIndexOf(list, test);
  if (idx > -1) {
    return Array.prototype.concat.call([], list.slice(0, idx), list.slice(idx + 1));
  }
  return list;
}

let listeners: ComponentListener[] = [];
let knownComponents: ComponentMetadata[] = [];

function addKnownComponent(componentMetadata: ComponentMetadata): void {
  if (componentMetadata.options.name && findIndexOf(knownComponents,
      (meta: ComponentMetadata) => meta.options.name == componentMetadata.options.name) > -1) {
    console.warn(`Component with name '${componentMetadata.options.name}' already defined.`);
  }
  knownComponents.push(componentMetadata);
  for (let listener of listeners) {
    listener(componentMetadata);
  }
}

function addListener(listener: ComponentListener): void {
  listeners.push(listener);
  for (let componentMetadata of knownComponents) {
    listener(componentMetadata);
  }
}

function removeListener(listener: ComponentListener): void {
  listeners = removeElement(listeners, (l: ComponentListener) => l == listener);
}

export class TSDI {

  private components: ComponentMetadata[] = [];

  private instances: {[idx: number]: Object} = {};

  private listener: ComponentListener;

  private properties: {[key: string]: any} = {};

  constructor() {
    this.registerComponent({
      fn: TSDI,
      options: {}
    });
    this.instances[0] = this;
  }

  public addProperty(key: string, value: any): void {
    this.properties[key] = value;
  }

  public close(): void {
    if (this.listener) {
      removeListener(this.listener);
      this.listener = null;
    }
  }

  public enableComponentScanner(): void {
    if (!this.listener) {
      this.listener = this.registerComponent.bind(this);
      addListener(this.listener);
    }
  }

  private registerComponent(componentMetadata: ComponentMetadata): void {
    if (this.components.indexOf(componentMetadata) == -1) {
      if (componentMetadata.options.name && findIndexOf(this.components,
          (meta: ComponentMetadata) => meta.options.name == componentMetadata.options.name) > -1) {
        throw new Error(`Component with name '${componentMetadata.options.name}' already registered.`);
      }

      this.components.push(componentMetadata);
    }
  }

  public register(component: Constructable<any>, name?: string): void {
    let componentName: string = name;
    if (!componentName) {
      const options: IComponentOptions =  Reflect.getMetadata('component:options', component);
      if (options) {
        componentName = options.name;
      }
    }
    this.registerComponent({
      fn: component,
      options: {
        name: componentName
      }
    });
  }

  private getComponentMetadataIndex(component: Constructable<any>, name?: string): number {
    let idx: number;
    for (let i: number = 0, n: number = this.components.length; i < n; i++) {
      const componentMetadata: ComponentMetadata = this.components[i];
      if (name && name == componentMetadata.options.name) {
        return i;
      } else if (componentMetadata.fn == component) {
        idx = i;
      }
    }
    return idx;
  }

  private throwComponentNotFoundError(component: Constructable<any>, name: string): void {
    if (!name) {
      name = (component as any).name;
    }
    if (!name) {
      name = 'unknown';
    }
    throw new Error(`Component '${name}' not found`);
  }

  private getConstructorParameters(componentMetadata: ComponentMetadata): any[] {
    let parameterMetadata: any[] = Reflect.getMetadata('component:parameters', componentMetadata.fn);
    if (parameterMetadata) {
      return parameterMetadata
        .sort((a: any, b: any) => a.index - b.index)
        .map((parameter: any) => this.getComponentMetadataIndex((parameter as any).rtti))
        .map((index: number) => this.get(this.components[index].fn));
    }
    return [];
  }

  public get<T>(component: Constructable<T>, hint?: string): T {
    let idx: number = this.getComponentMetadataIndex(component, hint);
    let instance: any = this.instances[idx];
    if (!instance) {
      const componentMetadata: ComponentMetadata = this.components[idx];
      if (!componentMetadata) {
        this.throwComponentNotFoundError(component, hint);
      }
      const constructor: any =  Reflect.getMetadata('component:constructor', componentMetadata.fn);
      let parameters: any[] = this.getConstructorParameters(componentMetadata);
      instance = new constructor(...parameters);
      let injects: InjectMetadata[] = Reflect.getMetadata('component:injects', componentMetadata.fn.prototype);
      if (injects) {
        for (let inject of injects) {
          if (inject.options.name && typeof this.properties[inject.options.name] != 'undefined') {
            instance[inject.property] = this.properties[inject.options.name];
          } else {
            const injectIdx: number = this.getComponentMetadataIndex(inject.rtti, inject.options.name);
            if (!this.components[injectIdx]) {
              throw new Error(`Failed to get inject '${inject.options.name}'`);
            }
            instance[inject.property] = this.get(this.components[injectIdx].fn);
          }
        }
      }
      const init: string = Reflect.getMetadata('component:init', componentMetadata.fn.prototype);
      if (init) {
        (instance[init] as Function).call(instance);
      }
    }
    this.instances[idx] = instance;
    return instance;
  }

}

export function Component(options: IComponentOptions = {}): ClassDecorator {
  return function<TFunction extends Function>(target: TFunction): TFunction {
    addKnownComponent({
      fn: target as any,
      options
    });
    Reflect.defineMetadata('component:constructor', target, target);
    Reflect.defineMetadata('component:options', options, target);
    return target;
  };
}

export function Inject(options: IInjectOptions = {}): any {
  return function(target: Object, propertyKey: string, index?: number): void {
    if (typeof index == 'undefined') {
      // Annotated property
      const rtti: Constructable<any> = Reflect.getMetadata('design:type', target, propertyKey);

      let injects: InjectMetadata[] = Reflect.getMetadata('component:injects', target);
      if (!injects) {
        injects = [];
        Reflect.defineMetadata('component:injects', injects, target);
      }
      injects.push({
        property: propertyKey,
        rtti,
        options
      });
    } else {
      // Annotated parameter
      const rtti: any = Reflect.getMetadata('design:paramtypes', target, propertyKey);

      let parameters: any[] = Reflect.getMetadata('component:parameters', target);
      if (!parameters) {
        parameters = [];
        Reflect.defineMetadata('component:parameters', parameters, target);
      }
      parameters.push({
        index,
        rtti: rtti[index]
      });
    }
  };
}

export function Initialize(): MethodDecorator {
  return function(target: Object, propertyKey: string): void {
    Reflect.defineMetadata('component:init', propertyKey, target);
  };
}
