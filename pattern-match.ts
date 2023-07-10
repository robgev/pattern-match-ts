type Pattern<T = any> = { _patternType: string, _data?: T };
interface MatchableRecord extends Record<string, Matchable> {};
type Matchable = number | string | boolean | Matchable[] | TupleVal | MatchableRecord;
type TupleVal = {_valueType: 'tuple', _data: Matchable[]};
type PatternAndCb = [Pattern, (...args: any) => any];

const Const: <T>(a: T) => Pattern<T> = (a) => ({
  _patternType: 'ConstP',
  _data: a
})

const Variable: (a: string) => Pattern = () => ({
  _patternType: 'VariableP',
})

const Cons: (...args: string[]) => Pattern<string[]> = (...args) => ({
  _patternType: 'ConsP',
  _data: args
})

const Tuple: (...args: Pattern[]) => Pattern<Pattern[]> = (...args) => ({
  _patternType: 'TupleP',
  _data: args,
})

const Record: (a: Record<string, Pattern>) => Pattern<Record<string, Pattern>> = 
  (a) => ({
    _patternType: 'RecordP',
    _data: a,
  })

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
  if (typeof value === 'object' && !Array.isArray(value) && value._valueType === 'tuple') {
    // Is for sure tuple 
    return value as TupleVal
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
        if (patternType === 'ConsP') {
          const patternData = (pattern as Pattern<string[]>)._data;
          const length = patternData ? patternData.length : -1;
          if (data.length <= 1 && length <= 1 && data.length === length) {
            return data
          }

          if (data.length > 1 && length > 1 && data.length >= length - 1) {
            return [...data.slice(0, length - 1), data.slice(length - 1)]
          }
        } 
      } else {
        if (patternType === 'RecordP') {
          const patternData = (pattern as Pattern<Record<string, Pattern>>)._data || {};
          return Object.keys(patternData).reduce(
            (acc: Matchable[] | null, patternKey) => {
              const patternComponent = patternData[patternKey];
              const valueComponent = (data as MatchableRecord)[patternKey];
              if (acc !== null && data.hasOwnProperty(patternKey)) {
                const newBindings = matches(valueComponent, patternComponent);
                if (newBindings !== null) {
                  return acc.concat(newBindings);
                }
              }

              return null;
            }, []
          );
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

// All keys exist exactly as in the value
// Match values of each key for a match
// OR
// Value has all the keys mentioned by the pattern 
// (and maybe some other keys) 
// MAYBE: Change the logic a bit to make it more TypeScript-y
match({a: 1, b: 2})._with(
  [Record({a: Variable('x'), b: _}), (x) => console.log(x)]
)

match({a: 1, b: 2})._with(
  [Record({a: Const(2), b: _}), (x) => console.log(x)],
  [Record({a: Const(1), b: Variable('x')}), (x) => console.log(x)]
)

const non_decreasing: (x: number[]) => boolean = (x) => 
  match(x)._with(
    [Cons(), () => true],
    [Cons('_'), () => true],
    [Cons('h', 'n', 't'), (h, n, t) => ((h <= n) && non_decreasing([n, ...t]))]
  )

console.log(non_decreasing([1,1,2,3]));
console.log(non_decreasing([1,2,1]));
