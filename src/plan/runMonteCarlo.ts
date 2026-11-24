/**
 * Runs Monte Carlo off the JS thread on a dedicated worklet runtime (04-MOTION.md performance
 * budget: never jank a gesture waiting for the engine). The engine core is all 'worklet' functions,
 * so the same code runs here unchanged. On web (no worklet runtimes) it yields to the event loop
 * first and runs in place.
 */
import { Platform } from 'react-native';
import { createWorkletRuntime, runOnRuntimeAsync, type WorkletRuntime } from 'react-native-worklets';

import { simulateMonteCarlo, type McResult, type SimSpec } from '../engine/core';

let runtime: WorkletRuntime | null = null;
function engineRuntime(): WorkletRuntime {
  if (!runtime) runtime = createWorkletRuntime({ name: 'money-plan-engine' });
  return runtime;
}

export async function runMonteCarlo(specs: SimSpec[], paths: number, seed: number, chol: number[]): Promise<McResult[]> {
  if (Platform.OS === 'web') {
    await new Promise((r) => setTimeout(r, 0));
    return specs.map((s, i) => simulateMonteCarlo(s, paths, seed + i * 7919, chol));
  }
  return runOnRuntimeAsync(
    engineRuntime(),
    (ss: SimSpec[], n: number, sd: number, c: number[]) => {
      'worklet';
      const out: McResult[] = [];
      for (let i = 0; i < ss.length; i++) out.push(simulateMonteCarlo(ss[i], n, sd + i * 7919, c));
      return out;
    },
    specs,
    paths,
    seed,
    chol,
  );
}
