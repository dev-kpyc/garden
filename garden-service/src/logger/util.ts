/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { LogNode } from "./log-node"
import { LogEntry, CreateOpts, EmojiName } from "./log-entry"
import { combine, printEmoji } from "./renderers"
import chalk from "chalk"

export interface Node {
  children: any[]
}

export type LogOptsResolvers = { [K in keyof CreateOpts]?: Function }

export type ProcessNode<T extends Node = Node> = (node: T) => boolean

function traverseChildren<T extends Node, U extends Node>(node: T | U, cb: ProcessNode<U>) {
  const children = node.children
  for (let idx = 0; idx < children.length; idx++) {
    const proceed = cb(children[idx])
    if (!proceed) {
      return
    }
    traverseChildren(children[idx], cb)
  }
}

// Parent (T|U) can have different type then child (U)
export function getChildNodes<T extends Node, U extends Node>(node: T | U): U[] {
  let childNodes: U[] = []
  traverseChildren<T, U>(node, child => {
    childNodes.push(child)
    return true
  })
  return childNodes
}

export function getChildEntries(node: LogNode): LogEntry[] {
  return getChildNodes<LogNode, LogEntry>(node)
}

export function findParentEntry(entry: LogEntry, predicate: ProcessNode<LogEntry>): LogEntry | null {
  return predicate(entry)
    ? entry
    : entry.parent ? findParentEntry(entry.parent, predicate) : null
}

export function findLogNode(node: LogNode, predicate: ProcessNode<LogNode>): LogEntry | void {
  let found: LogEntry | undefined
  traverseChildren<LogNode, LogEntry>(node, entry => {
    if (predicate(entry)) {
      found = entry
      return false
    }
    return true
  })
  return found
}

interface StreamWriteExtraParam {
  noIntercept?: boolean
}

/**
 * Intercepts the write method of a WriteableStream and calls the provided callback on the
 * string to write (or optionally applies the string to the write method)
 * Returns a function which sets the write back to default.
 *
 * Used e.g. by FancyLogger so that writes from other sources can be intercepted
 * and pushed to the log stack.
 */
export function interceptStream(stream: NodeJS.WriteStream, callback: Function) {
  const prevWrite = stream.write

  stream.write = (write =>
    (
      string: string,
      encoding?: string,
      cb?: Function,
      extraParam?: StreamWriteExtraParam,
    ): boolean => {
      if (extraParam && extraParam.noIntercept) {
        const args = [string, encoding, cb]
        return write.apply(stream, args)
      }
      callback(string)
      return true
    })(stream.write) as any

  const restore = () => {
    stream.write = prevWrite
  }

  return restore
}

export function getTerminalWidth(stream: NodeJS.WriteStream = process.stdout) {
  const columns = (stream || {}).columns

  if (!columns) {
    return 80
  }

  // Windows appears to wrap a character early
  if (process.platform === "win32") {
    return columns - 1
  }

  return columns
}

function printWithEmoji(log: LogEntry, text: string, emoji?: EmojiName) {
  const msg = combine([
    [chalk.bold.magenta(text)],
    [emoji && log.root.useEmoji ? " " + printEmoji(emoji) : ""],
  ])
  return log.info(msg)
}

export function printHeader(log: LogEntry, command: string, emoji?: EmojiName): LogEntry {
  return printWithEmoji(log, command, emoji)
}

export function printFooter(log: LogEntry) {
  return printWithEmoji(log, "Done!", "heavy_check_mark")
}

export function printWarningMessage(log: LogEntry, text: string) {
  const msg = combine([
    [log.root.useEmoji ? printEmoji("warning") : ""],
    [chalk.bold.yellow(text)],
  ])
  return log.info(msg)
}
