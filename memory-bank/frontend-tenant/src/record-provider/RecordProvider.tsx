/**
 * Record Provider
 * Provides context for the current record being viewed or edited
 */

import React, { createContext, useContext, useState } from "react";

export interface RecordContextData {
  record?: any;
  setRecord?: (record: any) => void;
  isLoading?: boolean;
  setIsLoading?: (loading: boolean) => void;
}

export const RecordContext = createContext<RecordContextData | null>(null);

interface RecordProviderProps {
  children: React.ReactNode;
  initialRecord?: any;
}

export const RecordProvider: React.FC<RecordProviderProps> = ({
  children,
  initialRecord,
}) => {
  const [record, setRecord] = useState(initialRecord || null);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <RecordContext.Provider
      value={{ record, setRecord, isLoading, setIsLoading }}
    >
      {children}
    </RecordContext.Provider>
  );
};

export const useRecord = (): RecordContextData => {
  const context = useContext(RecordContext);
  if (!context) {
    throw new Error("useRecord must be used within RecordProvider");
  }
  return context;
};

export default RecordProvider;
