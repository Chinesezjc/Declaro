// Package entry point: what consumers of Declaro import.
//
// The DSL and the static HTML compiler are the public surface. The Express
// server, the React renderer and the CLI stay internal — import them by path if
// you need them.

export * from "./dsl"
export { compilePage, compilePageToFile, type CompileOptions } from "./compiler/compile"
