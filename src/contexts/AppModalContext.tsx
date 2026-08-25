import { createContext, useContext } from 'react';

const AppModalContext = createContext<{ openTeamModal: () => void }>({
  openTeamModal: () => {},
});

export const AppModalProvider = AppModalContext.Provider;
export const useAppModal = () => useContext(AppModalContext);
