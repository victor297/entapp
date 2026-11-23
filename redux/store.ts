import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { api } from "./services/authApi";
import { eventsApi } from "./services/eventsApi";
import { cateringApi } from "./services/cateringApi";
import { timeslotApi } from "./services/timeslot";
import { bookingApi } from "./services/book";
import { quoteApi } from "./services/quoteApi";
import { adminApi } from "./services/adminApi";
import { subscriptionApi } from "./services/subscriptionApi";
import { operationsApi } from "./services/operationsApi";

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    [eventsApi.reducerPath]: eventsApi.reducer,
    [cateringApi.reducerPath]: cateringApi.reducer,
    [timeslotApi.reducerPath]: timeslotApi.reducer,
    [bookingApi.reducerPath]: bookingApi.reducer,
    [quoteApi.reducerPath]: quoteApi.reducer,
    [adminApi.reducerPath]: adminApi.reducer,
    [subscriptionApi.reducerPath]: subscriptionApi.reducer,
    [operationsApi.reducerPath]: operationsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      api.middleware,
      eventsApi.middleware,
      cateringApi.middleware,
      timeslotApi.middleware,
      bookingApi.middleware,
      quoteApi.middleware,
      adminApi.middleware,
      subscriptionApi.middleware,
      operationsApi.middleware
    ),
});

setupListeners(store.dispatch);

export function resetSessionQueries() {
  for (const slice of [api, eventsApi, cateringApi, timeslotApi, bookingApi, quoteApi, adminApi, subscriptionApi, operationsApi]) store.dispatch(slice.util.resetApiState());
}

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
