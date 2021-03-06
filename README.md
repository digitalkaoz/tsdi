# tsdi

[![GitHub license](https://img.shields.io/github/license/KnisterPeter/tsdi.svg)]()
[![Travis](https://img.shields.io/travis/KnisterPeter/tsdi.svg)](https://travis-ci.org/KnisterPeter/tsdi)
[![Coveralls branch](https://img.shields.io/coveralls/KnisterPeter/tsdi/master.svg)](https://coveralls.io/github/KnisterPeter/tsdi)
[![David](https://img.shields.io/david/KnisterPeter/tsdi.svg)](https://david-dm.org/KnisterPeter/tsdi)
[![David](https://img.shields.io/david/dev/KnisterPeter/tsdi.svg)](https://david-dm.org/KnisterPeter/tsdi#info=devDependencies&view=table)
[![npm](https://img.shields.io/npm/v/tsdi.svg)](https://www.npmjs.com/package/tsdi)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

Dependency Injection container (IoC) for TypeScript.

# Features

* Type based dependency injetion
* Type auto registration
* Lifecycle methods
* Interface based injection
* Name based injection (hints)
* Property value injection
* Constructor injection (parameters)
* Singletons vs Instances
* Factories

# Usage

## Installation
Install as npm package:

```sh
npm install tsdi --save
```

Install latest development version:

```sh
npm install tsdi@next --save
```

## API


```js
import { Component } from 'tsdi';

@Component()
export class Dependency {

  public echo(input: string): string {
    return input;
  }

}
```

```js
import { Component, Inject, Initialize } from 'tsdi';
import { Dependency } from './dependency';

@Component()
export class User {

  @Inject()
  private dependency: Dependency;

  private message: string;

  @Initialize()
  public init(): void {
    this.message = 'hello';
  }

  public getDep(): Dependency {
    return this.dependency;
  }

  public method(): string {
    return this.dependency.echo(this.message);
  }

}
```

```js
import { TSDI } from 'tsdi';
import { User } from './user';
import { Dependency } from './dependency';

const tsdi: TSDI = new TSDI();
tsdi.register(User);
tsdi.register(Dependency);
const user: User = tsdi.get(User);
console.log(user.method()); // outputs 'hello'
```

### Name based injection (hints)

```js
import { TSDI, Component, Inject } from 'tsdi';

@Component()
class A {}

@Component()
class B extends A {}
@Component({name: 'Bar'})
class C extends A {}

@Component({name: 'Foo'})
class D extends A {
  @Inject({name: 'Bar'})
  private a: A;
}

const tsdi: TSDI = new TSDI();
tsdi.enableComponentScanner();
const a: A = tsdi.get(A, 'Foo');
```

### Constructor parameter injection

```js
import { TSDI, Component, Inject } from 'tsdi';

@Component()
class A {}

@Component()
class B {}

@Component()
class C {
  constructor(@Inject() a: A, @Inject() b: B) {}
}

const tsdi: TSDI = new TSDI();
tsdi.enableComponentScanner();
tsdi.get(C);
```

### Singletons vs. Instances

```js
import { TSDI, Component } from 'tsdi';

@Component({singleton: false})
class A {}

@Component()
class B {}

const tsdi: TSDI = new TSDI();
tsdi.enableComponentScanner();

const a0: A = tsdi.get(A);
const a1: A = tsdi.get(A);
// a0 !== a1

const b0: B = tsdi.get(B);
const b1: B = tsdi.get(B);
// b0 === b1
```

### Factories

```js
import { TSDI, Component, Factory } from 'tsdi';

class A {}

@Component()
class B {
  @Factory()
  public createA(): A {
    return new A();
  }
}

const tsdi: TSDI = new TSDI();
tsdi.enableComponentScanner();

tsdi.get(A);
```

### Property value injection (configuration)

```js
import { TSDI, Component, Inject } from 'tsdi';

@Component()
class A {
  @Inject({name: 'config-key'})
  public some: string;
}

const tsdi: TSDI = new TSDI();
tsdi.addProperty('config-key', 'config-value');
tsdi.register(A);
console.log(tsdi.get(A).some); // 'config-value'
```

## Future ideas / Roadmap

* Lazy dependency injection
* Static factories
* Factories for non classes/types
