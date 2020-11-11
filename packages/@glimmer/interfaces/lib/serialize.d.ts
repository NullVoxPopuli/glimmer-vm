/**
 * This file describes the interface between compilation time
 * and runtime.
 *
 * # Locators
 *
 * Compile time and runtime must share the same Locator. A Locator is an
 * object that describes the location of a template, and is roughly a
 * module name. The compiler and runtime may use the Locator to locally
 * resolve names relative to the template the name was found in, but must
 * share resolution rules between compilation time and runtime.
 *
 * For example, given this template with Locator
 * `{ module: 'components/Articles/Container' }:
 *
 * ```
 * <TabBar />
 * ```
 *
 * The compiler may resolve `<TabBar>` to `components/Articles/TabBar`. The
 * important thing is that the compiler and runtime share resolution rules.
 *
 * # CompileTimeLookup
 *
 * When compiling an application, the `CompileTimeLookup` is responsible
 * for resolving helpers, modifiers, components, and partials into "handles"
 * (numbers) that can be embedded into the program and used at runtime.
 *
 * # RuntimeResolver
 *
 * The `RuntimeResolver` has two responsibilities.
 *
 * 1. To turn handles created by the `CompileTimeLookup` into live helpers,
 *    modifiers, components, and partials.
 * 2. To resolve dynamic components and partials at runtime that come from
 *    calls to `{{component dynamic}}` or `{{partial dynamic}}`.
 *
 * The `CompileTimeLookup` and `RuntimeResolver` must maintain symmetry
 * between:
 *
 * * `resolver.resolve(lookup.lookupComponentDefinition(name, referrer))`; and
 * * `resolver.lookupComponentDefinition(name, referrer))`
 *
 * And between:
 *
 * * `resolver.resolve(lookup.lookupPartial(name, referrer))`; and
 * * `resolver.lookupPartial(name, referrer))`
 *
 * # Coupling
 *
 * In practice, the `CompileTimeLookup` and `RuntimeResolver` are two parts
 * of one system. The goal of this system is to allow the `CompileTimeLookup`
 * to do as much resolution as possible ahead of time, while still allowing
 * the `RuntimeResolver` to do dynamic resolution when necessary.
 */

import { Option } from './core';
import { ProgramSymbolTable } from './tier1/symbol-table';
import { ComponentDefinition } from './components';
import { CompilableProgram, Template, HandleResult } from './template';
import { SyntaxCompilationContext } from './program';
import { Helper } from './runtime/vm';
import { ModifierDefinition } from './runtime/modifier';
import { Owner } from './runtime';
import { InternalComponentCapabilities } from './managers';

export interface HandleResolver {
  resolve(handle: number): unknown;
}

export interface CompileTimeComponent {
  handle: number;
  capabilities?: InternalComponentCapabilities;
  compilable: Option<CompilableProgram>;
}

export interface CompileTimeResolver<O extends Owner = Owner> extends HandleResolver {
  lookupHelper(name: string, owner: O): Option<number>;
  lookupModifier(name: string, owner: O): Option<number>;
  lookupComponent(name: string, owner: O): Option<CompileTimeComponent>;
  lookupPartial(name: string, owner: O): Option<number>;

  // For debugging
  resolve<U extends ResolvedValue>(handle: number): U | null;
}

export interface PartialDefinition {
  name: string; // for debugging

  getPartial(
    context: SyntaxCompilationContext
  ): { symbolTable: ProgramSymbolTable; handle: HandleResult };
}

export type ResolvedValue = ComponentDefinition | ModifierDefinition | Helper | PartialDefinition;

export interface RuntimeResolver<O extends Owner = Owner> extends HandleResolver {
  lookupComponent(name: string, owner: O): Option<ComponentDefinition>;
  lookupPartial(name: string, owner: O): Option<number>;
  resolve<U extends ResolvedValue>(handle: number): U;
}
