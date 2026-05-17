/**
 * useSchemaComponent Hook
 * Retrieve and render schema field components dynamically
 */

import React, { useMemo } from "react";
import { useSchemaComponentRegistry } from "./SchemaComponentRegistry";
import { SchemaFieldProps, SchemaFieldDefinition } from "../types";

/**
 * Hook to get and render schema components
 */
export function useSchemaComponent(type: string) {
  const registry = useSchemaComponentRegistry();

  return useMemo(() => {
    const entry = registry.get(type);
    return {
      component: entry?.component,
      readPretty: entry?.readPretty,
      props: entry?.props,
      exists: entry !== undefined,
    };
  }, [type, registry]);
}

/**
 * Render a schema field component based on definition
 */
export function SchemaComponentRenderer({
  definition,
  value,
  onChange,
  readPretty = false,
}: {
  definition: SchemaFieldDefinition;
  value?: any;
  onChange?: (value: any) => void;
  readPretty?: boolean;
}) {
  const {
    component: Component,
    readPretty: ReadPrettyComponent,
    props: registryProps,
  } = useSchemaComponent(definition.type);

  if (!Component) {
    return (
      <div style={{ color: "red" }}>Unknown field type: {definition.type}</div>
    );
  }

  const props: SchemaFieldProps = {
    value,
    onChange,
    disabled: definition.disabled,
    placeholder: definition.placeholder,
    required: definition.required,
    title: definition.title,
    description: definition.description,
    ...registryProps,
    ...definition.props,
  };

  if (readPretty && ReadPrettyComponent) {
    return <ReadPrettyComponent value={value} />;
  }

  return <Component {...props} />;
}

export default useSchemaComponent;
