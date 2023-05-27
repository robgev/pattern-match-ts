
// Thunk the pattern functions and use delayed 
// evaluation to store the args
const Const = (a) => {
  return function ConstP () {
    return a;
  }
}

const Variable = () => {
  return function VariableP () {}
}

const Unit = () => {
  return function UnitP () {}
}

const Cons = (...args) => {
  return function ConsP () {
    return args.length
  }
}

const Tuple = (...args) => {
  if (args.length <= 1) {
    throw new Error('Tuple should have more than 1 arg');
  }

  return function TupleP () {
    return args
  }
}

const _ = () => {
  return function _ () {}
}

// const Constructor
// const Record

// match(value).with(
//   [Cons(h, t), (h, t) => {}]
//   [Variable(x), x => {}]
//   [Unit, () => {}]
//   [Const(5) => () => {}]
//   [Tuple(a, b, c) => (a, b, c) => {}]
//   [Constructor(Some(a)) => (a) => {}]
//   [_ => () => {}]
// )

const determineValueType = (value) => {
  if (typeof value === 'function' && value.name === 'TupleP') {
    return 'tuple'; 
  }

  return typeof value;
};

const determinePatternType = (pattern) => {
  if (pattern.length <= 1) {
    return pattern.name;
  }

  return 'tuple';
}

// TODO: Probably return named results to 
// respect the given name by the user 
// So instead of result(...args) as you have 
// arg values do args[name] = ... and then result(args)
const matches = (value, pattern) => {
  const patternType = determinePatternType(pattern);
  const valueType = determineValueType(value);

  if (patternType === '_') {
    return [];
  }
   
  if (patternType === 'VariableP') {
    return [value];
  }

  switch (valueType) {
    case 'number':
    case 'string':
      if (patternType === 'ConstP' && pattern() === value) {
        return [value]
      }
      return null
    case 'object':
      if (Array.isArray(value)) {
        // pattern.length includes arbitrary number of elements cut 
        // from the beginning plus one more argument that's gonna be the
        // tail aka the rest of the elements. So check if there are enough 
        // elements in the value to match the pattern
        if (patternType === 'ConsP'){
          if (value.length === 0 && pattern() === 0) {
            return []
          }

          if (value.length > 0 && pattern() > 0 && value.length >= pattern() - 1) {
            return [...value.slice(0, pattern() - 1), value.slice(pattern() - 1)]
          }
        } 
      }
      return null
    case 'tuple':
      const tupleVals = value();
      if (patternType === 'tuple' && pattern.length === tupleVals.length) {
        // do fold?
        return tupleVals.reduce((acc, valueComponent, i) => {
          const patternComponent = pattern[i];
          if (acc !== null)  {
            const newBindings = matches(valueComponent, patternComponent);
            if (newBindings !== null) {
              return acc.concat(newBindings)
            }
          } 
          return null;
        }, [])
      }
      return null;
    default:
      return null;
  }
}

const match = (value) => {
  const _with = (...patterns) => {
    const found = patterns.findIndex(checkedPattern => {
      const resultCb = checkedPattern[checkedPattern.length - 1];
      const pattern = checkedPattern.length > 2 ? checkedPattern.slice(0, -1) : checkedPattern[0];
      const bindings = matches(value, pattern);
      if (bindings !== null) {
        resultCb(...bindings);
        // We found a match so we can stop
        return true;
      }
      return false;
    });

    if (found === -1) {
      throw new Error("Pattern match failed. Maybe you forgot _?")
    }
  } 

  return {
    _with
  }
}

// ------------------------------------TESTS-------------------------------------------
const a = [1,2,3];
const b = "Hello world";

match(b)._with(
  [Const("Hello"), () => console.log("Matched Hello")],
  [Const("Hello world"), () => console.log("Matched the whole string")],
  [_, () => console.log("Matched the wildcard")]
)

match(b)._with(
  [Const("hello"), () => console.log("Matched Hello")],
  [Const("hello world"), () => console.log("Matched something that shouldn't match")],
  [_, () => console.log("Matched the wildcard")]
)


match(b)._with(
  [Const("hello"), () => console.log("Matched Hello")],
  [_, () => console.log("Matched the wildcard")],
  [Const("Hello world"), () => console.log("Matched the whole string")],
)


match(b)._with(
  [Variable('x'), (x) => console.log(x)],
  [_, () => console.log("Matched the wildcard")],
)

match([1, 2, 3])._with(
  [Cons(), () => console.log([])],
  [Cons('h', 't'), (h, t) => console.log(h, t)]
)

match([])._with(
  [Cons(), () => console.log([])],
  [Cons('h', 't'), (h, t) => console.log(h, t)]
)

match(Tuple([1,2,3], [4,5,6]))._with(
  [Cons(), _, () => console.log('a')],
  [_, Cons(), () => console.log('b')],
  [Cons('ha', 'ta'), Cons('hb', 'tb'), (ha, ta, hb, tb) => console.log(ha, ta, hb, tb)] 
)


