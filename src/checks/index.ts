/** 检查器注册表。 */
import type { CheckContext, CheckReport } from './types.ts'
import { checkAnachronism } from './anachronism.ts'
import { checkGolden3 } from './golden3.ts'
import { checkHooksCoverage } from './hooks-coverage.ts'
import { checkPacing } from './pacing.ts'
import { checkToolman } from './toolman.ts'

export type CheckerFn = (ctx: CheckContext) => CheckReport

export const CHECKERS: Record<string, CheckerFn> = {
  'hooks-coverage': checkHooksCoverage,
  anachronism: checkAnachronism,
  pacing: checkPacing,
  golden3: checkGolden3,
  toolman: checkToolman,
}

export const CHECKER_NAMES = Object.keys(CHECKERS)

export { checkAnachronism, checkGolden3, checkHooksCoverage, checkPacing, checkToolman }
export type { CheckContext, CheckFinding, CheckLevel, CheckReport } from './types.ts'
