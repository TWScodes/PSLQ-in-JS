
const DEFAULT_PRECISION = 30; 

// --- Re-usable, Unbound Function Implementations ---
const functionImplMap = new Map();
const functionIndexMap = new Map();

/** Internal BigInt Sqrt (Newton's method) */
function isqrt(n) {
    if (n < 0n) throw new Error("Cannot sqrt negative number");
    if (n === 0n) return 0n;
    let x = n >> 1n;
    if (x === 0n) return 1n;
    let lastX = 0n;
    while (x !== lastX) {
        lastX = x;
        x = (x + n / x) >> 1n;
        if (x > lastX) {
            x = lastX;
            break;
        }
    }
    return x;
}

/** Creates the raw POJO */
function createRawNumber(value, precision, scale, funcs) {
    return {
        v: value,     
        p: precision,  
        s: scale,       
        funcs: funcs    
    };
}

/** Parses a string to our scaled BigInt */
function parseFixed(numStr, precision, scale) {
    let [integer, fractional = ''] = numStr.split('.');
    if (fractional.length > precision) {
        fractional = fractional.substring(0, precision);
    } else {
        fractional = fractional.padEnd(precision, '0');
    }
    let sign = '';
    if (integer.startsWith('-')) {
        sign = '-';
        integer = integer.substring(1);
    }
    return BigInt(sign + integer + fractional);
}

// --- Function Implementations ---

// [1] "+"
function add(other) { return give(this.v + other.v, this.funcs, this.p); }
function add_out(other, out) { out.v = this.v + other.v; return out; }

// [2] "-"
function sub(other) { return give(this.v - other.v, this.funcs, this.p); }
function sub_out(other, out) { out.v = this.v - other.v; return out; }

// [3] "/"
function div(other) { return give((this.v * this.s) / other.v, this.funcs, this.p); }
function div_out(other, out) { out.v = (this.v * this.s) / other.v; return out; }

// [4] "*"
function mul(other) { return give((this.v * other.v) / this.s, this.funcs, this.p); }
function mul_out(other, out) { out.v = (this.v * other.v) / this.s; return out; }

// [5] "^" (OPTIMIZED: Binary Exponentiation)
function pow(exponent) {
    if (typeof exponent !== 'number' || !Number.isInteger(exponent)) {
        throw new Error("pow() only supports integer exponents.");
    }
    if (exponent === 0) return give(this.s, this.funcs, this.p);
    if (exponent < 0) {
        const one = give(this.s, this.funcs, this.p);
        return one[3](this[5](-exponent));
    }
    
    let base = this.v;
    let result = this.s; // 1.0 in fixed point
    let exp = exponent;
    
    while (exp > 0) {
        if (exp % 2 === 1) {
            result = (result * base) / this.s;
        }
        base = (base * base) / this.s;
        exp = Math.floor(exp / 2);
    }
    return give(result, this.funcs, this.p);
}

// [6] "<"
function lt(other) { return this.v < other.v; }

// [7] ">"
function gt(other) { return this.v > other.v; }

// [8] "==="
function eq(other) { return this.v === other.v; }

// [9] "f/" 
function fixedDiv(other) { return give(this.v / other.v, this.funcs, this.p); }

// [10] "f*" 
function fixedMul(other) { return give(this.v * other.v, this.funcs, this.p); }

// [11] "toInt"
function toInt() { return this.v / this.s; }

// [12] "toString"
function toString() {
    let str = this.v.toString().padStart(this.p + 1, '0');
    let sign = '';
    if (str.startsWith('-')) {
        sign = '-';
        str = str.substring(1).padStart(this.p + 1, '0');
    }
    const splitPoint = str.length - this.p;
    return `${sign}${str.substring(0, splitPoint)}.${str.substring(splitPoint)}`;
}

// [13] "sqrt"
function sqrt() {
    const newVal = isqrt(this.v * this.s);
    return give(newVal, this.funcs, this.p);
}
function sqrt_out(out) {
    out.v = isqrt(this.v * this.s); return out;
}

// [14] "abs"
function abs() { return give(this.v < 0n ? -this.v : this.v, this.funcs, this.p); }
function abs_out(out) { out.v = this.v < 0n ? -this.v : this.v; return out; }

// [15] "nint"
function nint() {
    const half = this.s / 2n;
    if (this.v >= 0n) {
        return (this.v + half) / this.s;
    } else {
        return (this.v - half) / this.s;
    }
}

// [16] "set_from_int"
function set_from_int(bigint) {
    return give(bigint * this.s, this.funcs, this.p);
}
function set_from_int_out(bigint, out) {
    out.v = bigint * out.s; return out;
}

// [17] "is_zero"
function is_zero() { return this.v === 0n; }

// [18] "neg"
function neg() { return give(-this.v, this.funcs, this.p); }
function neg_out(out) { out.v = -this.v; return out; }

// [19] "copy_out"
function copy_out(out) {
    out.v = this.v; return out;
}

// [20] "set_from"
function set_from(other) {
    this.v = other.v; return this;
}

// --- Register All Functions ---
const ALL_FUNCS = {
    1: add, 2: sub, 3: div, 4: mul, 5: pow, 6: lt, 7: gt, 8: eq,
    9: fixedDiv, 10: fixedMul, 11: toInt, 12: toString, 13: sqrt,
    14: abs, 15: nint, 16: set_from_int, 17: is_zero, 18: neg,
    
    101: add_out, 102: sub_out, 103: div_out, 104: mul_out,
    113: sqrt_out, 114: abs_out, 116: set_from_int_out,
    118: neg_out, 119: copy_out, 120: set_from,
};

const ALL_NAMES = {
    "+": 1, "-": 2, "/": 3, "*": 4, "^": 5, "<": 6, ">": 7, "===": 8,
    "f/": 9, "f*": 10, "toInt": 11, "toString": 12, "sqrt": 13,
    "abs": 14, "nint": 15, "setInt": 16, "isZero": 17, "neg": 18,
    "+_out": 101, "-_out": 102, "/_out": 103, "*_out": 104,
    "sqrt_out": 113, "abs_out": 114, "setInt_out": 116,
    "neg_out": 118, "copy_out": 119, "set_from": 120,
};

for (const [name, index] of Object.entries(ALL_NAMES)) {
    functionIndexMap.set(name, index);
    functionImplMap.set(index, ALL_FUNCS[index]);
}

function give(tylerNum, funcs, precision = DEFAULT_PRECISION) {
    const scale = 10n ** BigInt(precision);
    let value;
    if (typeof tylerNum === 'bigint') {
        value = tylerNum;
    } else if (typeof tylerNum === 'string') {
        value = parseFixed(tylerNum, precision, scale);
    } else {
        throw new TypeError("tylerNum must be a string or BigInt.");
    }

    const newNum = createRawNumber(value, precision, scale, funcs);

    if (funcs.includes("all")) {
        for (const [index, fn] of functionImplMap.entries()) {
            newNum[index] = fn;
        }
    } else {
        for (const name of funcs) {
            if (functionIndexMap.has(name)) {
                const index = functionIndexMap.get(name);
                newNum[index] = functionImplMap.get(index);
            }
        }
    }
    return newNum;
}


/**
 * @author Tyler Schultz <Transcriptor; The OG: https://github.com/mpmath/mpmath/blob/master/mpmath/identification.py>
 * @description Full JavaScript port of the PSLQ algorithm.
 * @param {string[]} x_in - Input vector of numbers as strings (e.g., ["-1", "3.141..."]).
 * @param {object} options
 * @param {number} [options.precision=100] - Decimal precision to use.
 * @param {string} [options.tol=null] - Tolerance as a string.
 * @param {number} [options.maxcoeff=1000] - Max coefficient size.
 * @param {number} [options.maxsteps=100] - Max iterations.
 * @param {boolean} [options.verbose=false] - Log progress.
 */
/**
 * PSLQ Algorithm (Final Fix: Corrected function attachment)
 */
function pslq(x_in, options = {}) {
    const n = x_in.length;
    if (n < 2) throw new RangeError("n cannot be less than 2");

    const {
        precision = 100,
        maxcoeff = 1000,
        maxsteps = 100,
        verbose = false
    } = options;

    if (precision < 53) throw new RangeError("precision cannot be less than 53");
    
    const extra = 60;
    const work_prec = precision + extra;
    
    const ONE = give("1", ["all"], work_prec);
    const TWO = give("2", ["all"], work_prec);
    const FOUR_THIRDS = give((4.0/3.0).toString(), ["all"], work_prec);
    
    let tol;
    if (options.tol) {
        tol = give(options.tol, ["all"], work_prec);
    } else {
        const target = Math.floor(precision * 0.75);
        tol = ONE[3](TWO[5](target)); 
    }

    if (verbose) {
        console.log(`PSLQ using precision ${precision} (work_prec ${work_prec})`);
        console.log(`Tolerance: ${tol[12]()}`);
    }

    // --- Scratchpad Setup ---
    const scratch = Array(15).fill(null).map(() => give("0", ["all"], work_prec));
    let [t_obj, t2_obj, t3_obj, t4_obj, t_round_fixed] = scratch.slice(0, 5);
    let [temp_a, temp_b, temp_h, temp_y, temp_m] = scratch.slice(5, 10);

    const g = FOUR_THIRDS[13](); 

    const x = [null];
    const y = [null];
    const s = [null];
    
    const A = [null];
    const B = [null];
    const H = [null];

    for (let i = 1; i <= n; i++) {
        A[i] = [null];
        B[i] = [null];
        H[i] = [null];
        for (let j = 1; j <= n; j++) {
            A[i][j] = give(i === j ? "1" : "0", ["all"], work_prec);
            B[i][j] = give(i === j ? "1" : "0", ["all"], work_prec);
            H[i][j] = give("0", ["all"], work_prec);
        }
    }

    let minx = null; 
    
    for (let i = 0; i < n; i++) {
        const xk = give(x_in[i], ["all"], work_prec);
        x.push(xk);
        y.push(give(x_in[i], ["all"], work_prec));
        s.push(give("0", ["all"], work_prec));
        
        xk[114](temp_a); 
        if (temp_a[17]()) throw new Error("PSLQ requires a vector of nonzero numbers");
        
        if (minx === null || temp_a[6](minx)) { 
             if (minx === null) minx = give("0", ["all"], work_prec);
             temp_a[119](minx); 
        }
    }
    
    if (minx[6](tol[9](give("100", [], work_prec)))) {
         if (verbose) console.log("STOPPING: (one number is too small)");
         return null;
    }

    // Step 2
    for (let k = 1; k <= n; k++) {
        t_obj[116](0n, t_obj); 
        for (let j = k; j <= n; j++) {
            x[j][104](x[j], temp_a); 
            t_obj[101](temp_a, t_obj); 
        }
        t_obj[113](s[k]); 
    }

    s[1][119](t_obj); 
    
    for (let k = 1; k <= n; k++) {
        y[k][103](t_obj, y[k]); 
        s[k][103](t_obj, s[k]); 
    }

    // Step 3
    for (let i = 1; i <= n; i++) {
        for (let j = i + 1; j < n; j++) {
            H[i][j][116](0n, H[i][j]); 
        }
        if (i <= n - 1) {
            if (!s[i][17]()) { 
                s[i+1][103](s[i], H[i][i]); 
            } else {
                H[i][i][116](0n, H[i][i]); 
            }
        }
        for (let j = 1; j < i; j++) {
            s[j][104](s[j+1], t_obj); 
            if (!t_obj[17]()) {
                y[i][104](y[j], temp_a); 
                temp_a[118](temp_a); 
                temp_a[103](t_obj, H[i][j]); 
            } else {
                H[i][j][116](0n, H[i][j]); 
            }
        }
    }
    
    // Step 4
    for (let i = 2; i <= n; i++) {
        for (let j = i - 1; j >= 1; j--) {
            if (H[j][j][17]()) continue; 
            
            H[i][j][103](H[j][j], t_obj); 
            const t_bigint = t_obj[15](); 
            if (t_bigint === 0n) continue;
            
            t_obj[116](t_bigint, t_round_fixed); 
            
            t_round_fixed[104](y[i], temp_y); 
            y[j][101](temp_y, y[j]); 
            
            for (let k = 1; k <= j; k++) {
                t_round_fixed[104](H[j][k], temp_h); 
                H[i][k][102](temp_h, H[i][k]); 
            }
            for (let k = 1; k <= n; k++) {
                t_round_fixed[104](A[j][k], temp_a); 
                A[i][k][102](temp_a, A[i][k]); 
                
                t_round_fixed[104](B[k][i], temp_b); 
                B[k][j][101](temp_b, B[k][j]); 
            }
        }
    }

    // Main Loop
    let REP;
    for (REP = 0; REP < maxsteps; REP++) {
        
        let m = -1;
        let szmax = -1n; 
        
        for (let i = 1; i < n; i++) {
            H[i][i][119](t_obj); 
            
            const h_abs_v = t_obj.v < 0n ? -t_obj.v : t_obj.v;
            const g_v = g.v; 
            const s_v = g.s; 
            const i_big = BigInt(i);
            
            const g_pow_i = g_v ** i_big; 
            const num = g_pow_i * h_abs_v; 
            
            let sz;
            if (i === 1) {
                sz = num;
            } else {
                const den = s_v ** (i_big - 1n); 
                sz = num / den; 
            }
            
            if (sz > szmax) {
                m = i;
                szmax = sz;
            }
        }
        
        [y[m], y[m+1]] = [y[m+1], y[m]];
        [H[m], H[m+1]] = [H[m+1], H[m]]; 
        [A[m], A[m+1]] = [A[m+1], A[m]]; 
        for (let i = 1; i <= n; i++) {
            [B[i][m], B[i][m+1]] = [B[i][m+1], B[i][m]]; 
        }
        
        if (m <= n - 2) {
            H[m][m][104](H[m][m], t2_obj);   
            H[m][m+1][104](H[m][m+1], t3_obj); 
            t2_obj[101](t3_obj, t_obj);      
            t_obj[113](t_obj);              
            
            if (t_obj[17]()) break; 
            
            H[m][m][103](t_obj, t_obj); 
            H[m][m+1][103](t_obj, t2_obj); 
            
            for (let i = m; i <= n; i++) {
                H[i][m][119](t3_obj);
                H[i][m+1][119](t4_obj);
                
                t_obj[104](t3_obj, temp_a); 
                t2_obj[104](t4_obj, temp_b); 
                temp_a[101](temp_b, H[i][m]);
                
                t2_obj[104](t3_obj, temp_a); 
                temp_a[118](temp_a);       
                t_obj[104](t4_obj, temp_b); 
                temp_a[101](temp_b, H[i][m+1]);
            }
        }
        
        for (let i = m + 1; i <= n; i++) {
            for (let j = Math.min(i - 1, m + 1); j >= 1; j--) {
                if (H[j][j][17]()) break; 
                
                H[i][j][103](H[j][j], t_obj);
                const t_bigint = t_obj[15]();
                if (t_bigint === 0n) continue;
                
                t_obj[116](t_bigint, t_round_fixed);
                
                t_round_fixed[104](y[i], temp_y);
                y[j][101](temp_y, y[j]);
                
                for (let k = 1; k <= j; k++) {
                    t_round_fixed[104](H[j][k], temp_h);
                    H[i][k][102](temp_h, H[i][k]);
                }
                for (let k = 1; k <= n; k++) {
                    t_round_fixed[104](A[j][k], temp_a);
                    A[i][k][102](temp_a, A[i][k]);
                    
                    t_round_fixed[104](B[k][i], temp_b);
                    B[k][j][101](temp_b, B[k][j]);
                }
            }
        }
        
        let best_err = null;
        for (let i = 1; i <= n; i++) {
            y[i][114](t_obj); 
            
            if (t_obj[6](tol)) { 
                let max_c = 0n;
                const vec = [];
                for (let j = 1; j <= n; j++) {
                    const c_bigint = B[j][i][15](); 
                    vec.push(c_bigint);
                    const c_abs = c_bigint < 0n ? -c_bigint : c_bigint;
                    if (c_abs > max_c) max_c = c_abs;
                }
                
                if (max_c <= BigInt(maxcoeff)) {
                    if (verbose) {
                        console.log(`FOUND relation at iter ${REP}/${maxsteps}`);
                    }
                    return vec.map(v => Number(v)); 
                }
            }
            if (best_err === null || t_obj[6](best_err)) { 
                 if (best_err === null) best_err = give("0", ["all"], work_prec);
                 t_obj[119](best_err);
            }
        }
        
        let recnorm = 0n;
        for (let i = 1; i <= n; i++) {
            for (let j = 1; j <= n; j++) {
                const h_abs_v = H[i][j].v < 0n ? -H[i][j].v : H[i][j].v;
                if (h_abs_v > recnorm) recnorm = h_abs_v;
            }
        }

        let norm_js = Infinity;
        if (recnorm !== 0n) {
            // *** FIXED LINE BELOW: Added ["toString"] so [12]() exists ***
            const recnorm_f = parseFloat(give(recnorm, ["toString"], work_prec)[12]());
            norm_js = 1.0 / recnorm_f;
        }

        if (verbose && best_err) {
            console.log(`${REP}/${maxsteps}: Error: ${best_err[12]()} Norm: ${norm_js}`);
        }
        if (norm_js >= maxcoeff) {
            break; 
        }
    } 
    
    if (verbose) {
        console.log(`CANCELLING after step ${REP}/${maxsteps}.`);
    }
    return null; 
}
