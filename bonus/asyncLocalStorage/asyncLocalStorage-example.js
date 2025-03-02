// Import the AsyncLocalStorage class
import { AsyncLocalStorage } from "async_hooks";

// Create a new instance of AsyncLocalStorage that will be unique per application
const appAsyncLocalStorage = new AsyncLocalStorage();

// Here we simulate an incoming request every 2 seconds
setInterval(() => {
  // Generate a random request ID that will be unique per request
  const requestId = Math.random().toString(36).substring(7);

  // We run the `reqHandler` function in the AsyncLocalStorage context
  // that creates the context and bounds the `store` object to it
  const store = { requestId };
  appAsyncLocalStorage.run(store, function reqHandler () {
    logWithRequestId("Processing request...");
    setTimeout(() => logWithRequestId("Finished processing."), 3_000);
  });
}, 2_000);

// This is the main business logic function
// Through the `appAsyncLocalStorage.getStore()` method, we can access the `store` object
// that was bound to the AsyncLocalStorage context in the `reqHandler` function
function logWithRequestId (message) {
  const store = appAsyncLocalStorage.getStore();
  const requestId = store.requestId || "unknown";
  console.log(`[Request ${requestId}]: ${message}`);
}