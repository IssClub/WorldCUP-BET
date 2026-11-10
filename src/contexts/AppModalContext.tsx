import { createContext, useContext } from 'react';

const AppModalContext = createContext<{ openTeamModal: () => void; openTaglineModal: () => void }>({
  openTeamModal: () => {},
  openTaglineModal: () => {},
});

export const AppModalProvider = AppModalContext.Provider;
export const useAppModal = () => useContext(AppModalContext);
