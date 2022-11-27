// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

function writeAllSync(w, arr) {
    let nwritten = 0;
    while(nwritten < arr.length){
        nwritten += w.writeSync(arr.subarray(nwritten));
    }
}
console.write = (...str)=>writeAllSync(Deno.stdout, new TextEncoder().encode(str.join(' ')));
class Env {
    scope = {};
    subs = {};
}
const assert = (cond, msg)=>{
    if (!cond) throw new Error(`\n\n== ERROR =========\n` + msg + "\n");
};
const value = (key, env)=>{
    if (typeof key != 'string') return key;
    if (key[0] == '"') return key.substring(1, key.length - 1);
    if (/\d/.test(key[0])) return parseFloat(key);
    if (env.scope[key] !== undefined) return env.scope[key];
    if (key == 'CRLF') return "\r\n";
    assert(false, `value: variable ${key} is not defined`);
};
const testCond = (cond, env)=>{
    cond = [
        ...cond
    ];
    assert(cond.length >= 4, `IF $a IS $comparison $b THEN, got: ` + cond);
    const a = value(cond.shift() || "", env);
    const b = value(cond.pop() || "", env);
    assert((cond.shift() || "") == 'IS', `IF $a IS $b THEN`);
    const negate = cond[0] == 'NOT';
    if (negate) cond.shift();
    const test = cond.join(' ');
    let outcome = false;
    switch(test){
        case "EQUAL TO":
            outcome = a === b;
            break;
        case "GREATER THAN":
            outcome = a > b;
            break;
        case "LESS THAN":
            outcome = a < b;
            break;
        case "GREATER THAN OR EQUAL TO":
            outcome = a >= b;
            break;
        case "LESS THAN OR EQUAL TO":
            outcome = a <= b;
            break;
        default:
            assert(false, `IF: unknown comparison: ${cond}`);
    }
    if (negate) outcome = !outcome;
    return outcome;
};
function run(tokens, env = new Env()) {
    const convert = (val, type)=>{
        switch(type.toUpperCase()){
            case 'NUMBER':
                return Number(val);
            case 'TEXT':
                return String(val);
            default:
                assert(false, `convert: Unknown type ${type}`);
        }
    };
    const toVal = (val)=>value(val, env);
    const type = (val)=>{
        switch(typeof val){
            case 'number':
                return 'NUMBER';
            case 'string':
                return 'TEXT';
            default:
                assert(false, `type: unknown type ${val}`);
                return '';
        }
    };
    for(let pos = 0; pos < tokens.length; pos++){
        let line = tokens[pos];
        switch(line[0]){
            case 'DATA:':
                {
                    line = tokens[++pos];
                    while(line[0] != 'PROCEDURE:'){
                        assert(line.length == 3, `DATA: want: $variable IS $type\ngot: ${line}`);
                        assert(line[1] == "IS", `DATA: want: $variable IS $type\ngot: ${line}`);
                        env.scope[line[0]] = line[2] == 'TEXT' ? "" : 0;
                        line = tokens[++pos];
                        assert(!!line, `DATA: missing PROCEDURE: after DATA:`);
                    }
                    break;
                }
            case 'PROCEDURE:':
                console.error("Sections not implemented yet.");
                break;
            case 'STORE':
                assert(line.length == 4, "STORE: want: STORE $value IN $variable\ngot: " + line);
                assert(line[2] == 'IN', "STORE: want: STORE $value IN $variable\ngot: " + line[2]);
                assert(env.scope[line[3]] !== undefined, `STORE: variable ${line[3]} is not defined`);
                env.scope[line[3]] = convert(toVal(line[1]), type(env.scope[line[3]]));
                break;
            case 'DISPLAY':
                console.write(line.slice(1).map(toVal).join(''));
                break;
            case 'DECR':
                {
                    assert(line.length == 2, "DECR $variable\ngot: " + line);
                    const varName = line[1];
                    assert(type(env.scope[varName]) == 'NUMBER', `DECR: variable ${varName} is not a number`);
                    env.scope[varName]--;
                    break;
                }
            case 'INCR':
                {
                    assert(line.length == 2, "INCR $variable\ngot: " + line);
                    const varName1 = line[1];
                    assert(type(env.scope[varName1]) == 'NUMBER', `INCR: variable ${varName1} is not a number`);
                    env.scope[varName1]++;
                    break;
                }
            case 'SUB-PROCEDURE':
                {
                    assert(line.length == 2, "SUB-PROCEDURE: want: SUB-PROCEDURE $name\ngot: " + line);
                    assert(env.subs[line[1]] === undefined, `SUB-PROCEDURE: sub-procedure ${line[1]} is already defined`);
                    const body = [];
                    const name = line[1];
                    line = tokens[++pos];
                    while(line.join(' ') != 'END SUB-PROCEDURE'){
                        body.push(line);
                        line = tokens[++pos];
                        assert(!!line, `SUB-PROCEDURE: missing END SUBPROCEDURE`);
                    }
                    env.subs[name] = body;
                    break;
                }
            case 'CALL':
                assert(line.length == 3, "CALL: want: CALL SUB-PROCEDURE $name\ngot: " + line);
                assert(line[1] == 'SUB-PROCEDURE', "CALL: want: CALL SUB-PROCEDURE $name\ngot: " + line);
                assert(env.subs[line[2]] !== undefined, `CALL: sub-procedure ${line[2]} is not defined`);
                run(env.subs[line[2]], env);
                break;
            case 'IF':
                {
                    assert(line[line.length - 1] == 'THEN', "IF: want: IF $condition THEN\ngot: " + line);
                    const cond = line.slice(1, line.length - 1);
                    const ifTrue = [];
                    const ifFalse = [];
                    let body1 = ifTrue;
                    line = tokens[++pos];
                    while(line.join(' ') != 'END IF'){
                        if (line[0] == 'ELSE') body1 = ifFalse;
                        else body1.push(line);
                        line = tokens[++pos];
                        assert(!!line, `IF: missing END IF`);
                    }
                    if (testCond(cond, env)) {
                        run(ifTrue, env);
                    } else if (ifFalse.length > 0) {
                        run(ifFalse, env);
                    }
                    break;
                }
            case 'WHILE':
                {
                    assert(line[line.length - 1] == 'DO', "WHILE: want: WHILE $condition DO\ngot: " + line);
                    assert(line.length >= 3, "WHILE: want: WHILE $condition DO\ngot: " + line);
                    const body2 = [];
                    const cond1 = line.slice(1, line.length - 1);
                    line = tokens[++pos];
                    while(line[0] != 'REPEAT'){
                        body2.push(line);
                        line = tokens[++pos];
                        assert(!!line, `WHILE: missing REPEAT`);
                    }
                    while(testCond(cond1, env)){
                        run(body2, env);
                    }
                    break;
                }
            case 'FOR':
            default:
                assert(false, "Unknown statement: " + line[0]);
        }
    }
    return tokens;
}
function scan(source) {
    return source.split('\n').map((line)=>tokens(line)).filter((x)=>x.length > 0);
}
function tokens(line) {
    if (line[0] == '#') return [];
    const tokens = [];
    let tok = '';
    let pos = 0;
    const push = ()=>{
        if (tok) {
            tokens.push(tok.toUpperCase());
            tok = '';
        }
    };
    while(pos < line.length){
        const __char = line[pos];
        if (__char == '#') {
            push();
            return tokens;
        } else if (/\s/.test(__char)) {
            push();
        } else if (__char == '"') {
            push();
            let end = pos + 1;
            while(end < line.length && line[end] != '"')end++;
            tokens.push(line.substring(pos, end + 1));
            pos = end;
        } else {
            tok += __char;
        }
        pos++;
    }
    push();
    return tokens;
}
if (Deno.args[0]) run(scan(Deno.readTextFileSync(Deno.args[0])));
else console.error("Please provide an LDPL file");

