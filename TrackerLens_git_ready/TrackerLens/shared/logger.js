/**
 * TrackerLens — dev logger
 * Only emits output when DEV_MODE is true.
 */
import { DEV_MODE } from './config.js';

const prefix = '[TrackerLens]';

export const log = {
  info:  (...a) => DEV_MODE && console.info(prefix,  ...a),
  warn:  (...a) => DEV_MODE && console.warn(prefix,  ...a),
  error: (...a) => console.error(prefix, ...a),  // errors always logged
  debug: (...a) => DEV_MODE && console.debug(prefix, ...a),
  group: (label, fn) => {
    if (!DEV_MODE) { fn(); return; }
    console.group(`${prefix} ${label}`);
    fn();
    console.groupEnd();
  },
};
