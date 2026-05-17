/**
 * useAPIClient Hook
 * Access the API client instance from anywhere
 */

"use client";

import { useContext } from "react";
import { APIClientContext } from "../APIClientProvider";
import { APIClient } from "../APIClient";

export const useAPIClient = (): APIClient => {
  const context = useContext(APIClientContext);
  if (!context) {
    throw new Error("useAPIClient must be used within APIClientProvider");
  }
  return context.api;
};

export default useAPIClient;
