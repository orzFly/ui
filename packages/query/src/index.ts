export {
  BRACE_LIMIT,
  type BraceExpansion,
  expandBraces,
} from "./braces.ts";
export {
  type ArgSpec,
  type ArgValue,
  type CommandDef,
  type CommandRegistry,
  commandLinesOf,
  createCommandRegistry,
  type ParsedDraft,
  parseCommandLines,
  type RecognizedLine,
  recognizeCommandLine,
  slugifyCommandName,
  summarizeCommands,
} from "./commands.ts";
export {
  type CompletionRow,
  type CompletionSlot,
  commandCompletionSlot,
  filterOptions,
  keyRows,
  orderRows,
  queryCompletionSlot,
  quoteArgument,
  type SourceResult,
  slotValues,
  splice,
  spliceThenSpace,
  type ValueSlot,
  valueRows,
} from "./completion.ts";
export { diagnoseQuery, type QueryDiagnostic } from "./diagnostics.ts";
export {
  type CompiledQuerySchema,
  defineQuerySchema,
  parseQuery,
  type QualifierSpec,
  type QueryFilter,
  type QueryPart,
  type QuerySchema,
  type QueryValue,
  queryFilters,
  queryTerms,
  quoteQueryValue,
} from "./query.ts";
export {
  quoteShellWord,
  type ShellSegment,
  type ShellWord,
  segmentValue,
  shellWords,
} from "./shell-words.ts";
export { didYouMean } from "./suggest.ts";
export {
  canonicalValue,
  providerOf,
  specialValue,
  type ValueOption,
  type ValueProvider,
  type ValueProviders,
  type ValueSpec,
  type ValueVerdict,
  valueVerdict,
  worstVerdict,
} from "./values.ts";
