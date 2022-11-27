import { writeAllSync } from "https://deno.land/std/streams/conversion.ts"

/// console.write
declare global { interface Console { write(...str: string[]): void } }
(console as any).write = (...str: string[]) =>
    writeAllSync(Deno.stdout, new TextEncoder().encode(str.join(' ')))


/// local environment to store functions and variables
class Env {
    scope: { [key: string]: any } = {}
    subs: { [key: string]: any } = {}
}

/// assert that a condition is true, otherwise throw an error
const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`\n\n== ERROR =========\n` + msg + "\n")
}

/// return the value of a variable, string, or number
const value = (key: string, env: Env): any => {
    if (typeof (key) != 'string')
        return key

    if (key[0] == '"')
        return key.substring(1, key.length - 1)

    if (/\d/.test(key[0]))
        return parseFloat(key)

    if (env.scope[key] !== undefined)
        return env.scope[key]

    if (key == 'CRLF')
        return "\r\n"


    assert(false, `value: variable ${key} is not defined`)
}

const testCond = (cond: string[], env: Env): boolean => {
    cond = [...cond] // clone list
    assert(cond.length >= 4, `IF $a IS $comparison $b THEN, got: ` + cond)

    const a = value(cond.shift() || "", env)
    const b = value(cond.pop() || "", env)

    assert((cond.shift() || "") == 'IS', `IF $a IS $b THEN`)

    const negate = cond[0] == 'NOT'
    if (negate) cond.shift()

    const test = cond.join(' ')
    let outcome = false
    switch (test) {
        case "EQUAL TO": outcome = a === b; break
        case "GREATER THAN": outcome = a > b; break
        case "LESS THAN": outcome = a < b; break
        case "GREATER THAN OR EQUAL TO": outcome = a >= b; break
        case "LESS THAN OR EQUAL TO": outcome = a <= b; break
        default:
            assert(false, `IF: unknown comparison: ${cond}`)
    }
    if (negate) outcome = !outcome

    return outcome
}

/// run a file's code
function run(tokens: string[][], env: Env = new Env()) {
    /// convert a value into another type
    const convert = (val: any, type: string): any => {
        switch (type.toUpperCase()) {
            case 'NUMBER': return Number(val)
            case 'TEXT': return String(val)
            default:
                assert(false, `convert: Unknown type ${type}`)
        }
    }

    /// shortcut
    const toVal = (val: any) => value(val, env)

    /// type of value
    const type = (val: any): string => {
        switch (typeof (val)) {
            case 'number': return 'NUMBER'
            case 'string': return 'TEXT'
            default:
                assert(false, `type: unknown type ${val}`)
                return ''
        }
    }

    for (let pos = 0; pos < tokens.length; pos++) {
        let line = tokens[pos];

        switch (line[0]) {
            case 'DATA:': {
                line = tokens[++pos]
                while (line[0] != 'PROCEDURE:') {
                    assert(line.length == 3, `DATA: want: $variable IS $type\ngot: ${line}`)
                    assert(line[1] == "IS", `DATA: want: $variable IS $type\ngot: ${line}`)
                    env.scope[line[0]] = line[2] == 'TEXT' ? "" : 0
                    line = tokens[++pos]
                    assert(!!line, `DATA: missing PROCEDURE: after DATA:`)
                }
                break
            }

            case 'PROCEDURE:':
                console.error("Sections not implemented yet.")
                break

            case 'STORE':
                assert(line.length == 4, "STORE: want: STORE $value IN $variable\ngot: " + line)
                assert(line[2] == 'IN', "STORE: want: STORE $value IN $variable\ngot: " + line[2])
                assert(env.scope[line[3]] !== undefined, `STORE: variable ${line[3]} is not defined`)

                env.scope[line[3]] = convert(toVal(line[1]), type(env.scope[line[3]]))
                break

            case 'DISPLAY':
                console.write(line.slice(1).map(toVal).join(''))
                break

            case 'DECR': {
                assert(line.length == 2, "DECR $variable\ngot: " + line)
                const varName = line[1]
                assert(type(env.scope[varName]) == 'NUMBER', `DECR: variable ${varName} is not a number`)
                env.scope[varName]--
                break
            }

            case 'INCR': {
                assert(line.length == 2, "INCR $variable\ngot: " + line)
                const varName = line[1]
                assert(type(env.scope[varName]) == 'NUMBER', `INCR: variable ${varName} is not a number`)
                env.scope[varName]++
                break
            }

            case 'SUB-PROCEDURE': {
                assert(line.length == 2, "SUB-PROCEDURE: want: SUB-PROCEDURE $name\ngot: " + line)
                assert(env.subs[line[1]] === undefined, `SUB-PROCEDURE: sub-procedure ${line[1]} is already defined`)

                const body = []
                const name = line[1]
                line = tokens[++pos]

                while (line.join(' ') != 'END SUB-PROCEDURE') {
                    body.push(line)
                    line = tokens[++pos]
                    assert(!!line, `SUB-PROCEDURE: missing END SUBPROCEDURE`)
                }

                env.subs[name] = body
                break
            }

            case 'CALL':
                assert(line.length == 3, "CALL: want: CALL SUB-PROCEDURE $name\ngot: " + line)
                assert(line[1] == 'SUB-PROCEDURE', "CALL: want: CALL SUB-PROCEDURE $name\ngot: " + line)

                assert(env.subs[line[2]] !== undefined, `CALL: sub-procedure ${line[2]} is not defined`)

                run(env.subs[line[2]], env)

                break

            case 'IF': {
                assert(line[line.length - 1] == 'THEN', "IF: want: IF $condition THEN\ngot: " + line)

                const cond: string[] = line.slice(1, line.length - 1)
                const ifTrue: string[][] = []
                const ifFalse: string[][] = []
                let body = ifTrue
                line = tokens[++pos]

                while (line.join(' ') != 'END IF') {
                    if (line[0] == 'ELSE')
                        body = ifFalse
                    else
                        body.push(line)
                    line = tokens[++pos]
                    assert(!!line, `IF: missing END IF`)
                }

                if (testCond(cond, env)) {
                    run(ifTrue, env)
                } else if (ifFalse.length > 0) {
                    run(ifFalse, env)
                }

                break
            }

            case 'WHILE': {
                assert(line[line.length - 1] == 'DO', "WHILE: want: WHILE $condition DO\ngot: " + line)
                assert(line.length >= 3, "WHILE: want: WHILE $condition DO\ngot: " + line)

                const body = []
                const cond = line.slice(1, line.length - 1)
                line = tokens[++pos]

                while (line[0] != 'REPEAT') {
                    body.push(line)
                    line = tokens[++pos]
                    assert(!!line, `WHILE: missing REPEAT`)
                }

                while (testCond(cond, env)) {
                    run(body, env)
                }

                break
            }

            case 'FOR':
            default:
                assert(false, "Unknown statement: " + line[0])
        }
    }
    return tokens
}

/// turn a file into an array of tokens
function scan(source: string): string[][] {
    return source.split('\n').map(line => tokens(line)).filter(x => x.length > 0)
}

/// turn a single line into an array of tokens
function tokens(line: string): string[] {
    // skip comments
    if (line[0] == '#') return []

    const tokens: string[] = []
    let tok = ''
    let pos = 0

    // add a token to our little array
    const push = () => {
        if (tok) {
            tokens.push(tok.toUpperCase())
            tok = ''
        }
    }

    // basically just look for # comments and "strings" while ignoring whitespace
    while (pos < line.length) {
        const char = line[pos]

        if (char == '#') {
            push()
            return tokens
        } else if (/\s/.test(char)) {
            push()
        } else if (char == '"') {
            push()
            let end = pos + 1
            while (end < line.length && line[end] != '"') end++
            tokens.push(line.substring(pos, end + 1))
            pos = end
        } else {
            tok += char
        }

        pos++
    }

    // in case we were mid-token at the end of the line
    push()

    return tokens
}

if (Deno.args[0])
    run(scan(Deno.readTextFileSync(Deno.args[0])))
else
    console.error("Please provide an LDPL file")