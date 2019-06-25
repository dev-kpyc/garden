/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import React, { useState, useContext } from "react"
import styled from "@emotion/styled"
import { css } from "emotion"
import moment from "moment"
import { Module as ModuleModel } from "../containers/overview-normalized"
import EntityCard from "./entity-card"
import { UiStateContext } from "../context/ui"
import { TertiaryButton } from "./button"
import { ServiceCard } from "./service-card"

const Module = styled.div`
  padding: 1.2rem;
  background: white;
  box-shadow: 0rem 0.375rem 1.125rem rgba(0, 0, 0, 0.06);
  border-radius: 0.25rem;
  margin: 0 1.3rem 1.3rem 0;
  min-width: 17.5rem;
  flex: 1 1;
  max-width: 20rem;
`

type EntityCardsProps = {
  visible: boolean,
}
const EntityCards = styled.div<EntityCardsProps>`
  padding-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  align-items: middle;
  display: ${props => (props.visible ? `block` : "none")};
  animation: fadein .5s ;

  @keyframes fadein {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`

type FieldsProps = {
  visible: boolean,
}
export const Fields = styled.div<FieldsProps>`
  display: ${props => (props.visible ? `block` : "none")};
  animation: fadein .5s;
  @keyframes fadein {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`

const Header = styled.div`
  line-height: 1rem;
  display: flex;
  align-items: baseline;
  align-self: flex-start;
  justify-content: space-between;
`

const Name = styled.div`
  font-weight: 500;
  font-size: 0.9375rem;
  letter-spacing: 0.01em;
  color: #323C47;
`

const Tag = styled.div`
  padding-left: .5rem;
  font-weight: 500;
  font-size: 0.625rem;
  letter-spacing: 0.01em;
  color: #90A0B7;
`

type FieldProps = {
  inline?: boolean,
  visible: boolean,
}
export const Field = styled.div<FieldProps>`
  display: ${props => (props.visible ? (props.inline ? "flex" : "block") : "none")};
  flex-direction: row;
`

type FieldGroupProps = {
  visible: boolean,
}
export const FieldGroup = styled.div<FieldGroupProps>`
  display: ${props => (props.visible ? "flex" : "none")};
  flex-direction: row;
  padding-top: .25rem;
`

export const Key = styled.div`
  padding-right: .25rem;
  font-size: 0.8125rem;
  line-height: 1.1875rem;
  letter-spacing: 0.01em;
  color: #4C5862;
  opacity: 0.5;
`

export const Value = styled.div`
  padding-right: .5rem;
  font-size: 0.8125rem;
  line-height: 1.1875rem;
  letter-spacing: 0.01em;
`

const Description = styled(Field)`
  color: #4C5862;
  opacity: 0.5;
  padding-top: .25rem;
`

const Full = styled(Value)`
  cursor: pointer;
`

const Short = styled(Value)`
  cursor: pointer;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

interface ModuleProp {
  module: ModuleModel
  isLoadingEntities: boolean
}
export default ({
  module: { services = [], tests = [], tasks = [], name, type, description },
  isLoadingEntities,
}: ModuleProp) => {
  const {
    state: { overview: { filters } },
    actions: { selectEntity },
  } = useContext(UiStateContext)

  const [isValueExpended, setValueExpendedState] = useState(false)
  const toggleValueExpendedState = () => (setValueExpendedState(!isValueExpended))
  const handleSelectEntity = (
    {
      moduleName,
      entityName,
      entityType,
    }:
      {
        moduleName: string,
        entityName: string,
        entityType: "test" | "task",
      }) => {
    if (moduleName && entityName && entityType) {
      selectEntity({
        type: entityType,
        name: entityName,
        module: moduleName,
      })
    }
  }

  return (
    <Module>
      <Header>
        <Name>{name}</Name>
        <Tag>{type && type.toUpperCase()} MODULE</Tag>
      </Header>
      <Fields visible={filters.modulesInfo}>
        <Description visible={!!description}>
          {!isValueExpended && (
            <Short onClick={toggleValueExpendedState}>{description}</Short>
          )}
          {isValueExpended && (
            <Full onClick={toggleValueExpendedState}>{description}</Full>
          )}
        </Description>
      </Fields>
      <EntityCards visible={filters.services && services.length > 0}>
        {services.map(service => (
          <ServiceCard
            key={service.name}
            service={service}
            showInfo={filters.servicesInfo}
            isLoading={isLoadingEntities}
          />
          // <EntityCard
          //   key={service.name}
          //   entity={service}
          //   type={"service"}
          // >

          // </EntityCard>
        ))}
      </EntityCards>
      <EntityCards visible={filters.tests && tests.length > 0}>
        {/* {tests.map(test => (
          <EntityCard
            key={test.name}
            entity={test}
            type={"test"}
          >
            <Fields visible={filters.testsInfo}>
              <Field inline visible={test.dependencies.length > 0}>
                <Key>Depends on:</Key>
                <Value>{test.dependencies.join(", ")}</Value>
              </Field>
              <FieldGroup
                className="row between-xs middle-xs"
                visible={!!test.startedAt}
              >
                <Field inline className="col-xs" visible={!!test.startedAt}>
                  <Key>Ran:</Key>
                  <Value>{moment(test.startedAt).fromNow()}</Value>
                </Field>
                <Field inline visible={test.state === "succeeded"}>
                  <Key>Took:</Key>
                  <Value>{test.duration}</Value>
                </Field>
              </FieldGroup>
              <div className="row">
                <div className="col-xs">
                  <ShowResultButton
                    entityType="test"
                    moduleName={name}
                    entityName={test.name}
                    onClick={handleSelectEntity}
                  />
                </div>
              </div>
            </Fields>
          </EntityCard>
        ))} */}
      </EntityCards>
      <EntityCards visible={filters.tasks && tasks.length > 0}>
        {/* {tasks.map(task => (

          <EntityCard
            key={task.name}
            entity={task}
            type={"task"}
          />
        ))} */}
      </EntityCards>
    </Module>
  )
}

const ShowResultButton = ({
  entityName,
  entityType,
  moduleName,
  onClick,
}: {
  entityName: string,
  entityType: "test" | "task",
  moduleName: string,
  onClick,
}) => {
  const handleClick = () => onClick({ entityName, moduleName, entityType })
  return (
    <TertiaryButton
      onClick={handleClick}
      className={css`
        margin-top: .5rem;
      `}
    >
      Show result
    </TertiaryButton>
  )
}
