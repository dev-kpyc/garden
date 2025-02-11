/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import * as yaml from "js-yaml"
import {
  Command,
  CommandParams,
  ChoicesParameter,
} from "../base"
import { findProjectConfig } from "../../config/base"
import { ensureDir, copy, remove, pathExists, writeFile } from "fs-extra"
import { getPackageVersion } from "../../util/util"
import { platform, release } from "os"
import { join, relative, basename } from "path"
import execa = require("execa")
import { LogEntry } from "../../logger/log-entry"
import { deline } from "../../util/string"
import { getModulesPathsFromPath, getConfigFilePath } from "../../util/fs"
import { ERROR_LOG_FILENAME } from "../../constants"
import dedent = require("dedent")
import { Garden } from "../../garden"
import { zipFolder } from "../../util/archive"
import chalk from "chalk"

export const TEMP_DEBUG_ROOT = "tmp"
export const SYSTEM_INFO_FILENAME = "system-info.json"
export const DEBUG_ZIP_FILENAME = "debug-info-TIMESTAMP.zip"
export const PROVIDER_INFO_FILENAME_NO_EXT = "info"

/**
 * Collects project and modules configuration files and error logs (in case they exist).
 * The files are copied over a temporary folder and mantain the folder structure from where
 * they are copied from.
 *
 * @export
 * @param {string} root Project root path
 * @param {string} gardenDirPath Path to the Garden cache directory
 * @param {LogEntry} log Logger
 */
export async function collectBasicDebugInfo(root: string, gardenDirPath: string, log: LogEntry) {
  // Find project definition
  const config = await findProjectConfig(root, true)
  if (!config) {
    log.error(deline`
      Couldn't find a garden.yml with a valid project definition.
      Please run this command from the root of your Garden project.`)
    process.exit(1)
  }

  // Create temporary folder inside .garden/ at root of project
  const tempPath = join(gardenDirPath, TEMP_DEBUG_ROOT)
  await remove(tempPath)
  await ensureDir(tempPath)

  // Copy project definition in tmp folder
  const projectConfigFilePath = await getConfigFilePath(root)
  const projectConfigFilename = basename(projectConfigFilePath)
  await copy(projectConfigFilePath, join(tempPath, projectConfigFilename))
  // Check if error logs exist and copy it over if it does
  if (await pathExists(join(root, ERROR_LOG_FILENAME))) {
    await copy(join(root, ERROR_LOG_FILENAME), join(tempPath, ERROR_LOG_FILENAME))
  }

  // Find all services paths
  const paths = await getModulesPathsFromPath(root, gardenDirPath)

  // Copy all the service configuration files
  for (const servicePath of paths) {
    const tempServicePath = join(tempPath, relative(root, servicePath))
    await ensureDir(tempServicePath)
    const moduleConfigFilePath = await getConfigFilePath(servicePath)
    const moduleConfigFilename = basename(moduleConfigFilePath)
    await copy(moduleConfigFilePath, join(tempServicePath, moduleConfigFilename))

    // Check if error logs exist and copy them over if they do
    if (await pathExists(join(servicePath, ERROR_LOG_FILENAME))) {
      await copy(join(servicePath, ERROR_LOG_FILENAME), join(tempServicePath, ERROR_LOG_FILENAME))
    }
  }
}

/**
 * Collects informations about garden, the OS and docker.
 * Saves all the informations as json in a temporary folder.
 *
 * @export
 * @param {string} gardenDirPath Path to the Garden cache directory
 * @param {LogEntry} log Logger
 */
export async function collectSystemDiagnostic(gardenDirPath: string, log: LogEntry) {
  const tempPath = join(gardenDirPath, TEMP_DEBUG_ROOT)
  await ensureDir(tempPath)

  let dockerVersion = ""
  try {
    dockerVersion = await execa.stdout("docker", ["--version"])
  } catch (error) {
    log.error("Error encountered while executing docker")
    log.error(error)
  }

  const systemInfo = {
    gardenVersion: getPackageVersion(),
    platform: platform(),
    platformVersion: release(),
    dockerVersion,
  }

  await writeFile(join(tempPath, SYSTEM_INFO_FILENAME), JSON.stringify(systemInfo, null, 4), "utf8")

}

/**
 * Generates a report with debug information for each provider which implements the action
 * The reports are saved in a temporary and follows the structure "tmp/provider-name/info.json".
 *
 * @export
 * @param {Garden} garden The Garden instance
 * @param {LogEntry} log  Logger
 * @param {string} format The extension format dictating the extension of the report
 */
export async function collectProviderDebugInfo(garden: Garden, log: LogEntry, format: string) {
  const tempPath = join(garden.gardenDirPath, TEMP_DEBUG_ROOT)
  await ensureDir(tempPath)
  // Collect debug info from providers
  const actions = await garden.getActionHelper()
  const providersDebugInfo = await actions.getDebugInfo({ log })

  // Create a provider folder and report for each provider.
  for (const [providerName, info] of Object.entries(providersDebugInfo)) {
    const prividerPath = join(tempPath, providerName)
    await ensureDir(prividerPath)
    const outputFileName = `${PROVIDER_INFO_FILENAME_NO_EXT}.${format}`
    await writeFile(join(prividerPath, outputFileName), renderInfo(info, format), "utf8")
  }
}

/**
 * Collects information about the project and the system running garden.
 * Creates a zip file with the debug information at the root of the project.
 * Accepts an invalid project and it will always generate a report.
 * THIS SHOULD ONLY BE CALLED FROM `cli.ts`.
 *
 * @export
 * @param {string} root
 * @param {LogEntry} log
 */
export async function generateBasicDebugInfoReport(root: string, gardenDirPath: string, log: LogEntry) {
  const tempPath = join(gardenDirPath, TEMP_DEBUG_ROOT)
  const entry = log.info({ msg: "Collecting basic debug info", status: "active" })
  // Collect project info
  const projectEntry = entry.info({ section: "Project", msg: "collecting info", status: "active" })
  await collectBasicDebugInfo(root, gardenDirPath, log)
  projectEntry.setSuccess({ msg: chalk.green(`Done (took ${projectEntry.getDuration(1)} sec)`), append: true })

  // Run system diagnostic
  const systemEntry = entry.info({ section: "System", msg: "collecting info", status: "active" })
  await collectSystemDiagnostic(gardenDirPath, log)
  systemEntry.setSuccess({ msg: chalk.green(`Done (took ${systemEntry.getDuration(1)} sec)`), append: true })

  // Zip report folder
  entry.setState("Preparing archive")
  const outputFilename = DEBUG_ZIP_FILENAME.replace("TIMESTAMP", new Date().toISOString())
  const outputFilePath = join(root, outputFilename)
  await zipFolder(tempPath, outputFilePath, log)

  // Cleanup temporary folders
  await remove(tempPath)

  entry.setSuccess({ msg: "Done", append: true })
  log.info(`\nDone! Please find your report at  ${outputFilePath}.`)
}

/**
 * Returns the input object as json or yaml string
 * Defaults to yaml.
 *
 * @param {*} info The input data
 * @param {string} format The format of the output. Default is yaml.
 * @returns The info rendered in either json or yaml
 */
function renderInfo(info: any, format: string) {
  if (format === "json") {
    return JSON.stringify(info, null, 4)
  } else {
    return yaml.safeDump(info, { noRefs: true, skipInvalid: true })
  }
}

const debugInfoArguments = {}

const debugInfoOptions = {
  format: new ChoicesParameter({
    help: "The output format for plugin-generated debug info.",
    choices: ["json", "yaml"],
    defaultValue: "json",
  }),
}

type Args = typeof debugInfoArguments
type Opts = typeof debugInfoOptions

/**
 * Collects information about the project, the system running garden and the providers.
 * Creates a zip file with the debug information at the root of the project.
 *
 * @export
 * @class GetDebugInfoCommand
 * @extends {Command<Args, Opts>}
 */
export class GetDebugInfoCommand extends Command<Args, Opts> {
  name = "debug-info"
  help = "Outputs the status of your environment for debug purposes."

  description = dedent`
    Examples:

    garden get debug-info                # create a zip file at the root of the project with debug information
    garden get debug-info --format yaml  # output the provider info as yaml files (default as json)
  `

  arguments = debugInfoArguments
  options = debugInfoOptions

  async action({ garden, log, opts }: CommandParams<Args, Opts>) {
    const tempPath = join(garden.gardenDirPath, TEMP_DEBUG_ROOT)

    const entry = log.info({ msg: "Collecting debug info", status: "active" })

    // Collect project info
    const projectEntry = entry.info({ section: "Project", msg: "collecting info", status: "active" })
    await collectBasicDebugInfo(garden.projectRoot, garden.gardenDirPath, log)
    projectEntry.setSuccess({ msg: chalk.green(`Done (took ${projectEntry.getDuration(1)} sec)`), append: true })

    // Run system diagnostic
    const systemEntry = entry.info({ section: "System", msg: "collecting info", status: "active" })
    await collectSystemDiagnostic(garden.projectRoot, log)
    systemEntry.setSuccess({ msg: chalk.green(`Done (took ${systemEntry.getDuration(1)} sec)`), append: true })

    // Collect providers info
    const providerEntry = entry.info({ section: "Providers", msg: "collecting info", status: "active" })
    try {
      await collectProviderDebugInfo(garden, log, opts.format)
      providerEntry.setSuccess({ msg: chalk.green(`Done (took ${systemEntry.getDuration(1)} sec)`), append: true })
    } catch (err) {
      // One or multiple providers threw an error while processing.
      // Skip the step but still create a report.
      providerEntry.setWarn({
        msg: chalk.yellow(`Failed to collect providers info. Skipping this step.`), append: true,
      })
    }

    // Zip report folder
    entry.setState("Preparing archive")
    const outputFilename = DEBUG_ZIP_FILENAME.replace("TIMESTAMP", new Date().toISOString())
    const outputFilePath = join(garden.projectRoot, outputFilename)
    await zipFolder(tempPath, outputFilePath, log)

    // Cleanup temporary folders
    await remove(tempPath)

    entry.setSuccess({ msg: "Done", append: true })
    log.info(`\nDone! Please find your report at  ${outputFilePath}.`)

    return { result: 0 }
  }
}
