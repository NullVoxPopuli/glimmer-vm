import { State } from '@glimmer/reference';
import {
  dirty,
  value,
  validate,
  createUpdatableTag,
  CONSTANT_TAG,
  Tag,
  tagFor,
} from '@glimmer/validator';
import { unwrap } from '@glimmer/util';
import { tracked } from './support';

function unrelatedBump(tag: Tag, snapshot: number) {
  let t = createUpdatableTag();
  dirty(t);

  QUnit.assert.strictEqual(
    validate(tag, snapshot),
    true,
    'tag is still valid after an unrelated bump'
  );
}

QUnit.module('tracked properties');

QUnit.test(
  'requesting a tag for an untracked property should not throw an exception if mutated in production mode',
  assert => {
    assert.expect(1);

    class UntrackedPerson {
      firstName = 'Tom';
      get lastName() {
        return 'Dale';
      }
      set lastName(_value) {}

      toString() {
        return 'UntrackedPerson';
      }
    }

    let obj = new UntrackedPerson();
    tagFor(obj, 'firstName');
    tagFor(obj, 'lastName');

    obj.firstName = 'Ricardo';
    obj.lastName = 'Mendes';

    assert.ok(true, 'did not throw an exception after mutating tracked properties');
  }
);

QUnit.test('tracked properties can be read and written to', assert => {
  class TrackedPerson {
    firstName = 'Tom';
  }

  tracked(TrackedPerson, 'firstName');

  let obj = new TrackedPerson();
  assert.strictEqual(obj.firstName, 'Tom');
  obj.firstName = 'Edsger';
  assert.strictEqual(obj.firstName, 'Edsger');
});

QUnit.test('can request a tag for a property', assert => {
  class TrackedPerson {
    firstName = 'Tom';
  }

  tracked(TrackedPerson, 'firstName');

  let obj = new TrackedPerson();

  let root = State(obj);
  let firstName = root.get('firstName');

  assert.strictEqual(firstName.value(), 'Tom');

  let tag = firstName.tag;

  let snapshot = value(tag);
  assert.ok(validate(tag, snapshot), 'tag should be valid to start');

  obj.firstName = 'Edsger';
  assert.strictEqual(validate(tag, snapshot), false, 'tag is invalidated after property is set');
  snapshot = value(tag);
  assert.strictEqual(validate(tag, snapshot), true, 'tag is valid on the second check');

  unrelatedBump(tag, snapshot);
});

QUnit.skip('can request a tag for non-objects and get a CONSTANT_TAG', assert => {
  let snapshot = value(CONSTANT_TAG);

  function hasConstChildren(value: unknown) {
    assert.ok(validate(State(value).get('foo').tag, snapshot));
  }

  hasConstChildren(null);
  hasConstChildren(undefined);
  hasConstChildren(12345);
  hasConstChildren(0);
  hasConstChildren(true);
  hasConstChildren(false);
  hasConstChildren('hello world');

  if (typeof Symbol !== 'undefined') hasConstChildren(Symbol());
});

QUnit.test('can request a tag from a frozen POJO', assert => {
  let obj = Object.freeze({
    firstName: 'Toran',
  });

  assert.strictEqual(obj.firstName, 'Toran');

  let tag = unwrap(tagFor(obj, 'firstName'));
  let snapshot = value(tag);
  assert.ok(validate(tag, snapshot), 'tag should be valid to start');
  snapshot = value(tag);
  assert.strictEqual(validate(tag, snapshot), true, 'tag is still valid');

  unrelatedBump(tag, snapshot);
});

QUnit.test('can request a tag from a frozen class instance', assert => {
  class TrackedPerson {
    firstName = 'Toran';
    lastName = 'Billups';
  }

  tracked(TrackedPerson, 'firstName');

  let obj = Object.freeze(new TrackedPerson());
  assert.strictEqual(obj.firstName, 'Toran');
  assert.strictEqual(obj.lastName, 'Billups');

  // Explicitly annotated tracked properties
  let tag = tagFor(obj, 'firstName');
  let snapshot = value(tag);
  assert.ok(validate(tag, snapshot), 'tag should be valid to start');
  snapshot = value(tag);
  assert.strictEqual(validate(tag, snapshot), true, 'tag is still valid');

  // Non-tracked data properties
  tag = tagFor(obj, 'lastName');
  snapshot = value(tag);
  assert.ok(validate(tag, snapshot), 'tag should be valid to start');
  snapshot = value(tag);
  assert.strictEqual(validate(tag, snapshot), true, 'tag is still valid');

  unrelatedBump(tag, snapshot);
});

QUnit.test('can request a tag from an instance of a frozen class', assert => {
  class TrackedPerson {
    firstName = 'Toran';
  }

  tracked(TrackedPerson, 'firstName');

  let FrozenTrackedPerson = Object.freeze(TrackedPerson);

  let obj = Object.freeze(new FrozenTrackedPerson());

  assert.strictEqual(obj.firstName, 'Toran');

  let tag = tagFor(obj, 'firstName');
  let snapshot = value(tag);
  assert.ok(validate(tag, snapshot), 'tag should be valid to start');
  snapshot = value(tag);
  assert.strictEqual(validate(tag, snapshot), true, 'tag is still valid');

  unrelatedBump(tag, snapshot);
});

QUnit.test('can track a computed property', assert => {
  class TrackedCell<T> {
    constructor(public value: T) {}
  }

  tracked(TrackedCell, 'value');

  let firstName = new TrackedCell('Tom');
  let count = new TrackedCell(0);

  class TrackedPerson {
    get firstName() {
      return firstName.value + count.value;
    }

    set firstName(value) {
      firstName.value = value;
    }
  }

  let obj = new TrackedPerson();
  let root = State(obj);
  let first = root.get('firstName');
  assert.strictEqual(first.value(), 'Tom0');
  assert.strictEqual(first.value(), 'Tom0');

  let tag = first.tag;
  let snapshot = value(tag);
  assert.ok(validate(tag, snapshot), 'tag should be valid to start');

  count.value++;
  assert.strictEqual(first.value(), 'Tom1');
  assert.equal(
    validate(tag, snapshot),
    false,
    'updating the cell invalidates the tag'
  );

  obj.firstName = 'Edsger';
  assert.strictEqual(validate(tag, snapshot), false, 'tag is invalidated after property is set');
  snapshot = value(tag);

  unrelatedBump(tag, snapshot);

  assert.strictEqual(obj.firstName, 'Edsger1');
  assert.strictEqual(
    validate(tag, snapshot),
    true,
    'tag is valid'
  );
  snapshot = value(tag);

  unrelatedBump(tag, snapshot);
});

QUnit.test(
  'tracked computed properties are invalidated when their dependencies are invalidated',
  assert => {
    class TrackedPerson {
      get salutation() {
        return `Hello, ${this.fullName}!`;
      }

      get fullName() {
        return `${this.firstName} ${this.lastName}`;
      }

      set fullName(fullName) {
        let [firstName, lastName] = fullName.split(' ');
        this.firstName = firstName;
        this.lastName = lastName;
      }

      firstName = 'Tom';
      lastName = 'Dale';
    }

    tracked(TrackedPerson, 'firstName');
    tracked(TrackedPerson, 'lastName');

    let obj = new TrackedPerson();
    let root = State(obj);
    let salutation = root.get('salutation');
    let fullName = root.get('fullName');

    assert.strictEqual(salutation.value(), 'Hello, Tom Dale!', `the saluation field is valid`);
    assert.strictEqual(fullName.value(), 'Tom Dale', `the fullName field is valid`);

    let tag = salutation.tag;
    let snapshot = value(tag);
    assert.ok(validate(tag, snapshot), 'tag should be valid to start');

    obj.firstName = 'Edsger';
    obj.lastName = 'Dijkstra';
    assert.strictEqual(
      validate(tag, snapshot),
      false,
      'tag is invalidated after chained dependency is set'
    );
    assert.strictEqual(obj.fullName, 'Edsger Dijkstra');
    assert.strictEqual(obj.salutation, 'Hello, Edsger Dijkstra!');

    snapshot = value(tag);
    assert.strictEqual(validate(tag, snapshot), true);

    obj.fullName = 'Alan Kay';
    assert.strictEqual(
      validate(tag, snapshot),
      false,
      'tag is invalidated after chained dependency is set'
    );
    assert.strictEqual(obj.fullName, 'Alan Kay');
    assert.strictEqual(obj.firstName, 'Alan');
    assert.strictEqual(obj.lastName, 'Kay');
    assert.strictEqual(obj.salutation, 'Hello, Alan Kay!');

    snapshot = value(tag);
    assert.strictEqual(validate(tag, snapshot), true);

    unrelatedBump(tag, snapshot);
  }
);

QUnit.test('nested @tracked in multiple objects', assert => {
  class TrackedPerson {
    get salutation() {
      return `Hello, ${this.fullName}!`;
    }

    get fullName(): string {
      return `${this.firstName} ${this.lastName}`;
    }

    set fullName(fullName: string) {
      let [firstName, lastName] = fullName.split(' ');
      this.firstName = firstName;
      this.lastName = lastName;
    }

    toString() {
      return this.fullName;
    }

    firstName = 'Tom';
    lastName = 'Dale';
  }

  tracked(TrackedPerson, 'firstName');
  tracked(TrackedPerson, 'lastName');

  class TrackedContact {
    email: string;
    person: TrackedPerson;

    constructor(person: TrackedPerson, email: string) {
      this.person = person;
      this.email = email;
    }

    get contact(): string {
      return `${this.person} @ ${this.email}`;
    }
  }

  tracked(TrackedContact, 'email');
  tracked(TrackedContact, 'person');

  let obj = new TrackedContact(new TrackedPerson(), 'tom@example.com');
  let root = State(obj);
  let contact = root.get('contact');
  let fullName = root.get('person').get('fullName');

  assert.strictEqual(contact.value(), 'Tom Dale @ tom@example.com', `the contact field is valid`);
  assert.strictEqual(fullName.value(), 'Tom Dale', `the fullName field is valid`);

  let person = obj.person;

  let tag = contact.tag;
  let snapshot = value(tag);
  assert.ok(validate(tag, snapshot), 'tag should be valid to start');

  person.firstName = 'Edsger';
  person.lastName = 'Dijkstra';
  assert.strictEqual(
    validate(tag, snapshot),
    false,
    'tag is invalidated after nested dependency is set'
  );
  assert.strictEqual(person.fullName, 'Edsger Dijkstra');
  assert.strictEqual(obj.contact, 'Edsger Dijkstra @ tom@example.com');

  snapshot = value(tag);
  assert.strictEqual(validate(tag, snapshot), true);

  person.fullName = 'Alan Kay';
  assert.strictEqual(
    validate(tag, snapshot),
    false,
    'tag is invalidated after chained dependency is set'
  );
  assert.strictEqual(person.fullName, 'Alan Kay');
  assert.strictEqual(person.firstName, 'Alan');
  assert.strictEqual(person.lastName, 'Kay');
  assert.strictEqual(obj.contact, 'Alan Kay @ tom@example.com');

  snapshot = value(tag);
  assert.strictEqual(validate(tag, snapshot), true);

  obj.email = 'alan@example.com';
  assert.strictEqual(
    validate(tag, snapshot),
    false,
    'tag is invalidated after chained dependency is set'
  );
  assert.strictEqual(person.fullName, 'Alan Kay');
  assert.strictEqual(person.firstName, 'Alan');
  assert.strictEqual(person.lastName, 'Kay');
  assert.strictEqual(obj.contact, 'Alan Kay @ alan@example.com');

  snapshot = value(tag);
  assert.strictEqual(validate(tag, snapshot), true);

  unrelatedBump(tag, snapshot);
});
