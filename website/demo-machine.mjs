/** Local-only simulation: no network, storage, device capability or authentication. */
export const DEMO_PIN = "1234";

export function createDemoMachine({
  onChange,
  schedule = setTimeout,
  cancel = clearTimeout,
  durations = {},
} = {}) {
  const delay = {
    presented: 650,
    processing: 1100,
    confirming: 900,
    ...durations,
  };
  let state = "waiting";
  let digits = "";
  let timer;
  let generation = 0;
  let disposed = false;
  const snapshot = () => Object.freeze({ state, digits });
  const publish = () => {
    if (!disposed) onChange?.(snapshot());
  };
  const clearPending = () => {
    generation += 1;
    if (timer !== undefined) cancel(timer);
    timer = undefined;
  };
  const transition = (next) => {
    state = next;
    publish();
  };
  const later = (milliseconds, action) => {
    const current = generation;
    timer = schedule(() => {
      timer = undefined;
      if (!disposed && current === generation) action();
    }, milliseconds);
  };
  const reset = () => {
    if (disposed) return;
    clearPending();
    digits = "";
    transition("waiting");
  };
  const present = (valid = true) => {
    if (disposed || !["waiting", "invalid"].includes(state)) return;
    clearPending();
    digits = "";
    transition("presented");
    later(delay.presented, () => {
      transition("processing");
      later(delay.processing, () => transition(valid ? "pin" : "invalid"));
    });
  };
  const editPin = (value) => {
    if (
      disposed ||
      !["pin", "pin-error"].includes(state) ||
      !/^\d{0,4}$/.test(value)
    )
      return;
    digits = value;
    transition("pin");
  };
  const digit = (value) => {
    if (/^\d$/.test(String(value)) && digits.length < 4)
      editPin(digits + value);
  };
  const erase = () => editPin(digits.slice(0, -1));
  const fillExample = () => editPin(DEMO_PIN);
  const confirm = () => {
    if (
      disposed ||
      !["pin", "pin-error"].includes(state) ||
      digits.length !== 4
    )
      return;
    const correct = digits === DEMO_PIN;
    transition("confirming");
    later(delay.confirming, () => {
      digits = "";
      transition(correct ? "success" : "pin-error");
    });
  };
  const dispose = () => {
    clearPending();
    disposed = true;
  };
  return {
    snapshot,
    reset,
    present,
    digit,
    erase,
    clear: () => editPin(""),
    fillExample,
    confirm,
    dispose,
  };
}
