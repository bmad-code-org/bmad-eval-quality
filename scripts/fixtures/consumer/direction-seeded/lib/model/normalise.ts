/// <reference path="../service/build.ts" />
// The seed. This file depends on service/, which model/ may not reach, and it
// contains no import of it: a triple-slash reference directive is a dependency
// written as a comment, and the tokenizer every import rule reads skips trivia
// by construction. Every word the gate's rules are written in is about
// importing, so the gate had no word for a dependency declared this way and its
// own seeds could not have reached one.
import type { Shape } from './schema/shape.ts'

export function normalise(shape: Shape): Shape {
	return { id: shape.id.trim(), weight: Math.abs(shape.weight) }
}
