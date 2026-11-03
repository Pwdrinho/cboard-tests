import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import {
  updateIsOnTrialPeriod,
  updateSubscription
} from '../SubscriptionProvider.actions';
import { updateNavigationSettings } from '../../../components/App/App.actions';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('SubscriptionProvider actions', () => {
  describe('updateIsOnTrialPeriod', () => {
    const BASE_DATE = new Date('2026-11-01T12:00:00.000Z');

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(BASE_DATE);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // -------------------------------------------------------------------------
    // Etapa 1: Casos de Teste Caixa-Branca (MC/DC)
    // -------------------------------------------------------------------------
    describe('White-Box (MC/DC Coverage)', () => {
      it('should disable premium features when trial expired and user is neither subscribed nor in a free country', () => {
        // Arrange (D59-VFF: !isOnTrialPeriod=true, isSubscribed=false, isInFreeCountry=false)
        const initialState = {
          app: {
            userData: {
              createdAt: null
            }
          },
          subscription: {
            isSubscribed: false,
            isInFreeCountry: false
          }
        };
        const store = mockStore(initialState);

        // Act
        const result = store.dispatch(updateIsOnTrialPeriod());

        // Assert
        expect(result).toBe(false);
        expect(store.getActions()).toEqual([
          updateSubscription({ isOnTrialPeriod: false }),
          updateNavigationSettings({ improvePhraseActive: false })
        ]);
      });

      it('should not disable premium features when trial expired but user is subscribed', () => {
        // Arrange (D59-VVF: !isOnTrialPeriod=true, isSubscribed=true, isInFreeCountry=false)
        const twentyDaysAgo = new Date(
          BASE_DATE.getTime() - 20 * 24 * 60 * 60 * 1000
        ).toISOString();
        const initialState = {
          app: {
            userData: {
              createdAt: twentyDaysAgo
            }
          },
          subscription: {
            isSubscribed: true,
            isInFreeCountry: false
          }
        };
        const store = mockStore(initialState);

        // Act
        const result = store.dispatch(updateIsOnTrialPeriod());

        // Assert
        expect(result).toBe(false);
        expect(store.getActions()).toEqual([
          updateSubscription({ isOnTrialPeriod: false })
        ]);
      });

      it('should not disable premium features when trial expired but user is in a free country', () => {
        // Arrange (D59-VFV: !isOnTrialPeriod=true, isSubscribed=false, isInFreeCountry=true)
        const twentyDaysAgo = new Date(
          BASE_DATE.getTime() - 20 * 24 * 60 * 60 * 1000
        ).toISOString();
        const initialState = {
          app: {
            userData: {
              createdAt: twentyDaysAgo
            }
          },
          subscription: {
            isSubscribed: false,
            isInFreeCountry: true
          }
        };
        const store = mockStore(initialState);

        // Act
        const result = store.dispatch(updateIsOnTrialPeriod());

        // Assert
        expect(result).toBe(false);
        expect(store.getActions()).toEqual([
          updateSubscription({ isOnTrialPeriod: false })
        ]);
      });

      it('should return true and keep premium features when user is on trial period', () => {
        // Arrange (D59-FFF: !isOnTrialPeriod=false, isSubscribed=false, isInFreeCountry=false)
        const fiveDaysAgo = new Date(
          BASE_DATE.getTime() - 5 * 24 * 60 * 60 * 1000
        ).toISOString();
        const initialState = {
          app: {
            userData: {
              createdAt: fiveDaysAgo
            }
          },
          subscription: {
            isSubscribed: false,
            isInFreeCountry: false
          }
        };
        const store = mockStore(initialState);

        // Act
        const result = store.dispatch(updateIsOnTrialPeriod());

        // Assert
        expect(result).toBe(true);
        expect(store.getActions()).toEqual([
          updateSubscription({ isOnTrialPeriod: true })
        ]);
      });
    });

    // -------------------------------------------------------------------------
    // Etapa 2: Suplementação com Casos de Teste Caixa-Preta (Classes de Equivalência e Valor Limite)
    // -------------------------------------------------------------------------
    describe('Black-Box (Equivalence Partitioning & Boundary Value Analysis)', () => {
      it('should return true when account was just created (0 days boundary)', () => {
        // Arrange (CE1: 0 days elapsed, exact lower boundary)
        const justCreated = BASE_DATE.toISOString();
        const initialState = {
          app: {
            userData: {
              createdAt: justCreated
            }
          },
          subscription: {
            isSubscribed: false,
            isInFreeCountry: false
          }
        };
        const store = mockStore(initialState);

        // Act
        const result = store.dispatch(updateIsOnTrialPeriod());

        // Assert
        expect(result).toBe(true);
        expect(store.getActions()).toEqual([
          updateSubscription({ isOnTrialPeriod: true })
        ]);
      });

      it('should return true when account is on the last day of trial (14 days boundary)', () => {
        // Arrange (CE1: 14 days elapsed, DAYS_TO_TRY - 1)
        const fourteenDaysAgo = new Date(
          BASE_DATE.getTime() - 14 * 24 * 60 * 60 * 1000
        ).toISOString();
        const initialState = {
          app: {
            userData: {
              createdAt: fourteenDaysAgo
            }
          },
          subscription: {
            isSubscribed: false,
            isInFreeCountry: false
          }
        };
        const store = mockStore(initialState);

        // Act
        const result = store.dispatch(updateIsOnTrialPeriod());

        // Assert
        expect(result).toBe(true);
        expect(store.getActions()).toEqual([
          updateSubscription({ isOnTrialPeriod: true })
        ]);
      });

      it('should return false and disable premium features when trial reaches exact limit (15 days boundary)', () => {
        // Arrange (CE2: 15 days elapsed, exact DAYS_TO_TRY limit)
        const fifteenDaysAgo = new Date(
          BASE_DATE.getTime() - 15 * 24 * 60 * 60 * 1000
        ).toISOString();
        const initialState = {
          app: {
            userData: {
              createdAt: fifteenDaysAgo
            }
          },
          subscription: {
            isSubscribed: false,
            isInFreeCountry: false
          }
        };
        const store = mockStore(initialState);

        // Act
        const result = store.dispatch(updateIsOnTrialPeriod());

        // Assert
        expect(result).toBe(false);
        expect(store.getActions()).toEqual([
          updateSubscription({ isOnTrialPeriod: false }),
          updateNavigationSettings({ improvePhraseActive: false })
        ]);
      });

      it('should return false and disable premium features when trial is one day past limit (16 days boundary)', () => {
        // Arrange (CE2: 16 days elapsed, DAYS_TO_TRY + 1)
        const sixteenDaysAgo = new Date(
          BASE_DATE.getTime() - 16 * 24 * 60 * 60 * 1000
        ).toISOString();
        const initialState = {
          app: {
            userData: {
              createdAt: sixteenDaysAgo
            }
          },
          subscription: {
            isSubscribed: false,
            isInFreeCountry: false
          }
        };
        const store = mockStore(initialState);

        // Act
        const result = store.dispatch(updateIsOnTrialPeriod());

        // Assert
        expect(result).toBe(false);
        expect(store.getActions()).toEqual([
          updateSubscription({ isOnTrialPeriod: false }),
          updateNavigationSettings({ improvePhraseActive: false })
        ]);
      });
    });
  });
});
