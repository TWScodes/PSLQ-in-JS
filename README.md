# PSLQ-in-JS

The first zero-dependency implementation of the PSLQ Integer Relation Algorithm in pure JavaScript.

This engine solves for integer relations between real numbers with arbitrary precision. It runs in any browser console or JS environment.

## Usage

Copy PSLQ.js into your environment if on a browser. If in node.js, 

Example: Find the minimal polynomial for sqrt(2) + sqrt(3)
Expected relation: 1 - 10x^2 + x^4 = 0
Result: [1, 0, -10, 0, 1]
(See source code for full implementation details)
