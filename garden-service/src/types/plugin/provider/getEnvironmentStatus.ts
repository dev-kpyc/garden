/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { DashboardPage, dashboardPagesSchema } from "../../../config/dashboard"
import { PluginActionParamsBase, actionParamsSchema } from "../base"
import { dedent } from "../../../util/string"
import { joi } from "../../../config/common"

export interface GetEnvironmentStatusParams extends PluginActionParamsBase { }

export interface EnvironmentStatus {
  ready: boolean
  dashboardPages?: DashboardPage[]
  detail?: any
}

export interface EnvironmentStatusMap {
  [providerName: string]: EnvironmentStatus
}

export const environmentStatusSchema = joi.object()
  .keys({
    ready: joi.boolean()
      .required()
      .description("Set to true if the environment is fully configured for a provider."),
    dashboardPages: dashboardPagesSchema,
    detail: joi.object()
      .meta({ extendable: true })
      .description("Use this to include additional information that is specific to the provider."),
  })
  .description("Description of an environment's status for a provider.")

export const getEnvironmentStatus = {
  description: dedent`
    Check if the current environment is ready for use by this plugin. Use this action in combination
    with \`prepareEnvironment\`.

    Called before \`prepareEnvironment\`. If this returns \`ready: true\`, the
    \`prepareEnvironment\` action is not called.
  `,
  paramsSchema: actionParamsSchema,
  resultSchema: environmentStatusSchema,
}
