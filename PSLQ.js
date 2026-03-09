
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

function pslq(xInput, precision, iterations = 10000) {
  const funcs = ["all"];
  const n = xInput.length;
  const gamma = give("1.154700538379251529", funcs, precision); // sqrt(4/3)
  const TOL = give("0.000000000000000000000000000001", funcs, precision);

  // Initialize 1-based indexing for math parity
  let x = [null, ...xInput.map(val => give(val, funcs, precision))];
  
  // Initialize Identity Matrix B
  let B = [];
  for (let i = 0; i <= n; i++) {
      let row = [];
      for (let j = 0; j <= n; j++) {
          let val = give(i === j && i > 0 ? "1" : "0", funcs, precision);
          row.push(val);
      }
      B.push(row);
  }

  // Compute partial sums s[k]
  let s = new Array(n + 1);
  for (let k = 1; k <= n; k++) {
      let sumSq = give("0", funcs, precision);
      for (let j = k; j <= n; j++) {
          let termSq = x[j][4](x[j]); // x[j] * x[j]
          sumSq = sumSq[1](termSq);    // sumSq + termSq
      }
      s[k] = sumSq[13](); // sqrt
  }

  // Normalize y and s
  let y = new Array(n + 1);
  let t = s[1];
  for (let k = 1; k <= n; k++) {
      y[k] = x[k][3](t); // x[k] / t
      s[k] = s[k][3](t); // s[k] / t
  }

  // Initialize H matrix
  let H = Array.from({ length: n + 1 }, () => Array(n + 1).fill(null));
  for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= n; j++) H[i][j] = give("0", funcs, precision);
      if (i < n) H[i][i] = s[i+1][3](s[i]); // s[i+1]/s[i]
      for (let j = 1; j < i; j++) {
          let num = y[i][4](y[j])[18](); // -y[i]*y[j]
          let den = s[j][4](s[j+1]);     // s[j]*s[j+1]
          H[i][j] = num[3](den);
      }
  }

  // --- Main Loop ---
  for (let iter = 0; iter < iterations; iter++) {
      // Step 1: Selection (m)
      let m = -1;
      let maxVal = give("-1", funcs, precision);
      for (let i = 1; i < n; i++) {
          let gPow = gamma[5](i); // gamma^i
          let val = gPow[4](H[i][i][14]()); // g^i * abs(H[i][i])
          if (val[7](maxVal)) { // val > maxVal
              maxVal = val;
              m = i;
          }
      }

      // Step 2: Swap (m and m+1)
      [y[m], y[m+1]] = [y[m+1], y[m]];
      [H[m], H[m+1]] = [H[m+1], H[m]];
      for (let k = 1; k <= n; k++) {
          [B[k][m], B[k][m+1]] = [B[k][m+1], B[k][m]];
      }

      // Step 3: Corner Reduction
      if (m <= n - 2) {
          let h_mm = H[m][m];
          let h_mm1 = H[m][m+1];
          let t0 = (h_mm[4](h_mm)[1](h_mm1[4](h_mm1)))[13](); // sqrt(h_mm^2 + h_mm1^2)
          let t1 = h_mm[3](t0);
          let t2 = h_mm1[3](t0);
          for (let i = m; i <= n; i++) {
              let hi_m = H[i][m];
              let hi_m1 = H[i][m+1];
              H[i][m] = (t1[4](hi_m))[1](t2[4](hi_m1));
              H[i][m+1] = (t1[4](hi_m1))[2](t2[4](hi_m));
          }
      }

      // Step 4: Hermite Reduction
      for (let i = m + 1; i <= n; i++) {
          for (let j = Math.min(i - 1, m + 1); j >= 1; j--) {
              let t_coeff_big = H[i][j][3](H[j][j])[15](); // nint(H[i][j]/H[j][j])
              if (t_coeff_big !== 0n) {
                  let t_coeff = give(t_coeff_big.toString(), funcs, precision);
                  y[j] = y[j][1](t_coeff[4](y[i]));
                  for (let k = 1; k <= j; k++) {
                      H[i][k] = H[i][k][2](t_coeff[4](H[j][k]));
                  }
                  for (let k = 1; k <= n; k++) {
                      B[k][j] = B[k][j][1](t_coeff[4](B[k][i]));
                  }
              }
          }
      }

      // Step 5: Termination Check
      for (let i = 1; i <= n; i++) {
          if (y[i][14]()[6](TOL)) { // abs(y[i]) < TOL
              let relation = [];
              for (let k = 1; k <= n; k++) {
                  relation.push(B[k][i][11]().toString()); // toInt().toString()
              }
              return relation;
          }
      }
  }
  return null;
}
