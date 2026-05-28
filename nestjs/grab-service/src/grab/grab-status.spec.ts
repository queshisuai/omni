import { isTerminalGrabStatus, GRAB_STATUS } from './grab-status';

describe('grab status', () => {
  it('marks only completed request statuses as terminal', () => {
    expect(isTerminalGrabStatus(GRAB_STATUS.ORDER_CREATED)).toBe(true);
    expect(isTerminalGrabStatus(GRAB_STATUS.SOLD_OUT)).toBe(true);
    expect(isTerminalGrabStatus(GRAB_STATUS.LIMITED)).toBe(true);
    expect(isTerminalGrabStatus(GRAB_STATUS.FAILED)).toBe(true);
    expect(isTerminalGrabStatus(GRAB_STATUS.EXPIRED)).toBe(true);
    expect(isTerminalGrabStatus(GRAB_STATUS.PENDING)).toBe(false);
    expect(isTerminalGrabStatus(GRAB_STATUS.ACCEPTED)).toBe(false);
    expect(isTerminalGrabStatus(GRAB_STATUS.ORDER_CREATING)).toBe(false);
  });
});
