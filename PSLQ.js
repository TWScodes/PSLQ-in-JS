
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
s[k] = sqrt(x[k]^2 + s[k+1]^2)
        x[k][104](x[k], t1);       // t1 = x[k]^2
        s[k+1][104](s[k+1], t2);   // t2 = s[k+1]^2
        t1[101](t2, t_obj);        // t_obj = sum
        s[k] = t_obj[13]();        // s[k] = sqrt(sum)
    }

    // Normalize y and s by t = s[1]
    const t = s[1];
    for (let k = 1; k <= n; k++) {
        y[k] = give("0", ["all"], work_prec);
        x[k][103](t, y[k]); // y[k] = x[k] / t
        s[k][103](t, s[k]); // s[k] = s[k] / t
    }

    // Compute H (Lower Trapezoidal Matrix)
    // H[i][j] calculation is critical
    for (let i = 1; i <= n; i++) {
        H[i] = [null];
        for (let j = 1; j < i; j++) {
             // H[i][j] = -y[i]*y[j] / (s[j]*s[j+1])
             y[i][104](y[j], t1);        // t1 = y[i]*y[j]
             t1[118](t1);                // t1 = -t1
             s[j][104](s[j+1], t2);      // t2 = s[j]*s[j+1]
             H[i][j] = give("0", ["all"], work_prec);
             t1[103](t2, H[i][j]);       // H[i][j] = t1 / t2
        }
        // Diagonal
        if (i < n) {
            // H[i][i] = s[i+1] / s[i]
            H[i][i] = give("0", ["all"], work_prec);
            s[i+1][103](s[i], H[i][i]);
        } else {
            H[i][i] = give("0", ["all"], work_prec);
        }
    }

    // Initial Reduction (Hermite)
    for (let i = 2; i <= n; i++) {
        for (let j = i - 1; j >= 1; j--) {
            // t = round(H[i][j] / H[j][j])
            H[i][j][103](H[j][j], t_obj);
            const t_big = t_obj[15](); // nint()
            
            if (t_big !== 0n) {
                t_obj[116](t_big, t1); // t1 (scaled) = t_big

                // y[j] += t * y[i]
                t1[104](y[i], temp_v);
                y[j][101](temp_v, y[j]);

                // H[i][1..j] -= t * H[j][1..j]
                for (let k = 1; k <= j; k++) {
                    t1[104](H[j][k], temp_v);
                    H[i][k][102](temp_v, H[i][k]);
                }

                // B[1..n][j] += t * B[1..n][i] (Column operations on B)
                for (let k = 1; k <= n; k++) {
                    t1[104](B[k][i], temp_v);
                    B[k][j][101](temp_v, B[k][j]);
                }
            }
        }
    }

    // --- MAIN ITERATION LOOP ---
    for (let step = 1; step <= maxsteps; step++) {
        
        // 1. Selection
        // Find m maximizing gamma^i * |H[i][i]|
        let m = -1;
        let maxVal = give("-1", ["all"], work_prec);
        
        let gamma_pow = give("1", ["all"], work_prec); // gamma^0
        
        for (let i = 1; i < n; i++) {
            gamma_pow[104](GAMMA, gamma_pow); // gamma^i
            
            H[i][i][114](t_obj); // abs(H[i][i])
            gamma_pow[104](t_obj, t1); // t1 = val
            
            if (t1[7](maxVal)) { // if t1 > maxVal
                t1[119](maxVal); // maxVal = t1
                m = i;
            }
        }

        // 2. Exchange
        // Swap y[m], y[m+1]
        let tmpY = y[m]; y[m] = y[m+1]; y[m+1] = tmpY;
        
        // Swap H rows m and m+1
        let tmpH = H[m]; H[m] = H[m+1]; H[m+1] = tmpH;

        // Swap B columns m and m+1
        for (let k = 1; k <= n; k++) {
            let tmpB = B[k][m]; B[k][m] = B[k][m+1]; B[k][m+1] = tmpB;
        }

        // 3. Corner Rotation (Restore Lower Trapezoidal form)
        if (m <= n - 2) {
            // t0 = sqrt(H[m][m]^2 + H[m][m+1]^2)
            H[m][m][104](H[m][m], t1);      // H[m][m]^2
            H[m][m+1][104](H[m][m+1], t2);  // H[m][m+1]^2
            t1[101](t2, t_obj);             // sum
            const t0 = t_obj[13]();         // sqrt
            
            // t1 = H[m][m] / t0  (cosine)
            // t2 = H[m][m+1] / t0 (sine)
            const param1 = give("0", ["all"], work_prec);
            const param2 = give("0", ["all"], work_prec);
            H[m][m][103](t0, param1);
            H[m][m+1][103](t0, param2);

            for (let i = m; i <= n; i++) {
                const h_im = give("0", ["all"], work_prec);
                H[i][m][119](h_im); // copy
                const h_im1 = give("0", ["all"], work_prec);
                H[i][m+1][119](h_im1); // copy

                // H[i][m] = param1 * h_im + param2 * h_im1
                param1[104](h_im, t1);
                param2[104](h_im1, t2);
                t1[101](t2, H[i][m]);

                // H[i][m+1] = param1 * h_im1 - param2 * h_im
                param1[104](h_im1, t1);
                param2[104](h_im, t2);
                t1[102](t2, H[i][m+1]);
            }
        }

        // 4. Reduction (Hermite)
        for (let i = m + 1; i <= n; i++) {
            for (let j = Math.min(i - 1, m + 1); j >= 1; j--) {
                // t = round(H[i][j] / H[j][j])
                H[i][j][103](H[j][j], t_obj);
                const t_big = t_obj[15](); // nint()

                if (t_big !== 0n) {
                    t_obj[116](t_big, t1); // t1 (scaled) = t_big

                    // y[j] += t * y[i]
                    t1[104](y[i], temp_v);
                    y[j][101](temp_v, y[j]);

                    // H[i][1..j] -= t * H[j][1..j]
                    for (let k = 1; k <= j; k++) {
                        t1[104](H[j][k], temp_v);
                        H[i][k][102](temp_v, H[i][k]);
                    }

                    // B[1..n][j] += t * B[1..n][i]
                    for (let k = 1; k <= n; k++) {
                        t1[104](B[k][i], temp_v);
                        B[k][j][101](temp_v, B[k][j]);
                    }
                }
            }
        }

        // --- Termination Check ---
        // Calculate min(|y[i]|)
        let minNorm = give("1", ["all"], work_prec)[104](give("10", ["all"], work_prec), t1); // Start Huge
        let minIndex = -1;

        for (let i = 1; i <= n; i++) {
            y[i][114](t_obj); // abs(y[i])
            if (t_obj[6](minNorm)) { // < minNorm
                t_obj[119](minNorm);
                minIndex = i;
            }
        }

        // If minNorm is small enough, the column B[...][minIndex] is our relation
        if (minNorm[6](LIMIT)) {
             if (verbose) console.log(`FOUND relation at iter ${step}`);
             const res = [];
             for(let k = 1; k <= n; k++) {
                 // Convert BigInt to JS Number for output
                 res.push(parseInt(B[k][minIndex][12]())); 
             }
             return res;
        }
    }

    return null;
}
