import { createContext, useContext, type ReactNode } from "react";

const LoaderGateContext = createContext<boolean>(false);

export const LoaderGateProvider = ({
  started,
  children,
}: {
  started: boolean;
  children: ReactNode;
}) => (
  <LoaderGateContext.Provider value={started}>
    {children}
  </LoaderGateContext.Provider>
);

export const useLoaderStarted = () => useContext(LoaderGateContext);
