/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { HelmModule, HelmResourceSpec } from "./config"
import { getAppNamespace } from "../namespace"
import { runPod } from "../run"
import { findServiceResource, getChartResources, getResourceContainer, getServiceResourceSpec } from "./common"
import { PluginContext } from "../../../plugin-context"
import { LogEntry } from "../../../logger/log-entry"
import { ConfigurationError } from "../../../exceptions"
import { KubernetesPluginContext } from "../config"
import { storeTaskResult } from "../task-results"
import { RunModuleParams } from "../../../types/plugin/module/runModule"
import { RunResult } from "../../../types/plugin/base"
import { RunTaskParams, RunTaskResult } from "../../../types/plugin/task/runTask"
import { MAX_RUN_RESULT_OUTPUT_LENGTH } from "../constants"
import { tailString } from "../../../util/string"

export async function runHelmModule(
  {
    ctx, module, args, command, ignoreError = true, interactive, runtimeContext, timeout, log,
  }: RunModuleParams<HelmModule>,
): Promise<RunResult> {
  const k8sCtx = <KubernetesPluginContext>ctx
  const context = k8sCtx.provider.config.context
  const namespace = await getAppNamespace(k8sCtx, log, k8sCtx.provider)
  const serviceResourceSpec = getServiceResourceSpec(module)

  if (!serviceResourceSpec) {
    throw new ConfigurationError(
      `Helm module ${module.name} does not specify a \`serviceResource\`. ` +
      `Please configure that in order to run the module ad-hoc.`,
      { moduleName: module.name },
    )
  }

  const image = await getImage(k8sCtx, module, log, serviceResourceSpec)

  return runPod({
    context,
    namespace,
    module,
    envVars: runtimeContext.envVars,
    command,
    args,
    image,
    interactive,
    ignoreError,
    timeout,
    log,
  })
}

export async function runHelmTask(
  { ctx, log, module, task, taskVersion, interactive, runtimeContext, timeout }: RunTaskParams<HelmModule>,
): Promise<RunTaskResult> {
  const k8sCtx = <KubernetesPluginContext>ctx
  const context = k8sCtx.provider.config.context
  const namespace = await getAppNamespace(k8sCtx, log, k8sCtx.provider)

  const { command, args } = task.spec
  const image = await getImage(k8sCtx, module, log, task.spec.resource || getServiceResourceSpec(module))

  const res = await runPod({
    context,
    namespace,
    module,
    envVars: { ...runtimeContext.envVars, ...task.spec.env },
    command,
    args,
    image,
    interactive,
    ignoreError: false,
    timeout,
    log,
  })

  const result = {
    ...res,
    // Make sure we don't exceed max length of ConfigMap
    output: tailString(res.output, MAX_RUN_RESULT_OUTPUT_LENGTH, true),
    taskName: task.name,
  }

  await storeTaskResult({
    ctx,
    log,
    module,
    result,
    taskVersion,
    taskName: task.name,
  })

  return result
}

async function getImage(ctx: PluginContext, module: HelmModule, log: LogEntry, resourceSpec: HelmResourceSpec) {
  // find the relevant resource, and from that the container image to run
  const chartResources = await getChartResources(ctx, module, log)
  const resource = await findServiceResource({ ctx, log, module, chartResources, resourceSpec })
  const container = getResourceContainer(resource)

  return container.image
}
