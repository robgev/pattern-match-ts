import { win32 } from "path";

type Pattern<T = any> = { _patternType: string, _data?: T };
type Matchable = number | string | boolean | Matchable[] | TupleVal;
type TupleVal = {_valueType: string, _data: Matchable[]}
type PatternAndCb = [Pattern, (...args: any) => any]

const Const: <T>(a: T) => Pattern<T> = (a) => {
  return {
    _patternType: 'ConstP',
    _data: a
  }
}

const Variable: (a: string) => Pattern = () => {
  return {
    _patternType: 'VariableP',
  }
}

const Cons: (...args: string[]) => Pattern<string[]> = (...args) => {
  return {
    _patternType: 'ConsP',
    _data: args
  }
}

const Tuple: (...args: Pattern[]) => Pattern<Pattern[]> = (...args) => {
  return {
    _patternType: 'TupleP',
    _data: args,
  }
}

const MakeTuple: (...args: Matchable[]) => Matchable = (...args) => {
  if (args.length <= 1) {
    throw new Error('Tuple should have more than 1 arg');
  }

  return {
    _valueType: 'tuple',
    _data: args
  }
}

const _: Pattern = {
  _patternType: '_'
}

// TODO: const Constructor
// TODO: const Record

const determineValueAndType = (value: Matchable) => {
  if (typeof value === 'object' && !Array.isArray(value) && value._valueType) {
    return value
  }

  return {
    _valueType: typeof value,
    _data: value
  }
}

// TODO: Probably return named results to 
// respect the given name by the user 
// So instead of result(...args) as you have 
// arg values do args[name] = ... and then result(args)
const matches: (value: Matchable, pattern: Pattern) => Matchable[] | null = (value, pattern) => {
  const {_patternType: patternType, _data: patternData } = pattern;
  const { _data: data, _valueType: valueType } = determineValueAndType(value);

  if (patternType === '_') {
    return [];
  }
   
  if (patternType === 'VariableP') {
    return [value];
  }

  switch (valueType) {
    case 'number':
    case 'string':
      if (patternType === 'ConstP' && patternData === data) {
        return []
      }
      return null;
    case 'object':
      if (Array.isArray(data)) {
        // pattern.length includes arbitrary number of elements cut 
        // from the beginning plus one more argument that's gonna be the
        // tail aka the rest of the elements. So check if there are enough 
        // elements in the value to match the pattern
        if (patternType === 'ConsP'){
          const patternData = (pattern as Pattern<string[]>)._data;
          const length = patternData ? patternData.length : -1;
          if (data.length <= 1 && length <= 1 && data.length === length) {
            return data
          }

          if (data.length > 1 && length > 1 && data.length >= length - 1) {
            return [...data.slice(0, length - 1), data.slice(length - 1)]
          }
        } 
      }
      return null
    case 'tuple':
      if (patternType === 'TupleP' && patternData.length === data.length) {
        // do fold?
        return data.reduce((acc: Matchable[] | null, valueComponent, i) => {
          const patternComponent = patternData[i];
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

const match = (value: Matchable) => {
  const _with = (...patterns: PatternAndCb[]) => {
    let bindings = null;
    const found = patterns.findIndex((checkedPattern: PatternAndCb) => {
      const pattern = checkedPattern[0];
      bindings = matches(value, pattern);
      if (bindings !== null) {
        // We found a match so we can stop
        return true;
      }
      return false;
    });

    if (found === -1) {
      throw new Error("Pattern match failed. Maybe you forgot _?")
    }

    const callback = patterns[found][1];
    return callback.apply(null, bindings || []);
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

match(a)._with(
  [Cons(), () => console.log([])],
  [Cons('h', 't'), (h, t) => console.log(h, t)]
)

match([])._with(
  [Cons(), () => console.log([])],
  [Cons('h', 't'), (h, t) => console.log(h, t)]
)

match(MakeTuple(a, [4,5,6]))._with(
  [Tuple(Cons(), _), () => console.log('a')],
  [Tuple(_, Cons()), () => console.log('b')],
  [Tuple(Cons('ha', 'ta'), Cons('hb', 'tb')), (ha, ta, hb, tb) => console.log(ha, ta, hb, tb)] 
)

const square_funny = (x: number) =>
    match(x)._with(
        [Variable('y'), (y) => y * y]
    )

const non_decreasing: (x: number[]) => boolean = (x) => 
  match(x)._with(
    [Cons(), () => true],
    [Cons('_'), () => true],
    [Cons('h', 'n', 't'), (h, n, t) => ((h <= n) && non_decreasing([n, ...t]))]
  )

console.log(non_decreasing([1,1,2,3]));
console.log(non_decreasing([1,2,1]));
