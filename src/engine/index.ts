// Public surface of the plan engine. Pure TS: no React, no I/O.
export * from './types';
export * from './dates';
export * from './plan';
export * from './withdrawal';
export * from './replay';
export { simulateDeterministic, simulateMonteCarlo, requiredMonthlyExact, type SimSpec, type McResult } from './core';
