import { GRAB_STATUS, isTerminalGrabStatus, isQueueProgressStatus } from './grab-status';

describe('grab status', () => {
  it('marks only final progress states as terminal', () => {
    expect(isTerminalGrabStatus(GRAB_STATUS.ORDER_CREATED)).toBe(true);
    expect(isTerminalGrabStatus(GRAB_STATUS.SOLD_OUT)).toBe(true);
    expect(isTerminalGrabStatus(GRAB_STATUS.LIMITED)).toBe(true);
    expect(isTerminalGrabStatus(GRAB_STATUS.FAILED)).toBe(true);
    expect(isTerminalGrabStatus(GRAB_STATUS.PENDING_RECOVERY)).toBe(true);
    expect(isTerminalGrabStatus(GRAB_STATUS.EXPIRED)).toBe(true);
    expect(isTerminalGrabStatus(GRAB_STATUS.QUEUED)).toBe(false);
    expect(isTerminalGrabStatus(GRAB_STATUS.WAITING)).toBe(false);
    expect(isTerminalGrabStatus(GRAB_STATUS.TRYING_TICKET_TYPE)).toBe(false);
    expect(isTerminalGrabStatus(GRAB_STATUS.LOCKING)).toBe(false);
    expect(isTerminalGrabStatus(GRAB_STATUS.ORDER_CREATING)).toBe(false);
    expect(isTerminalGrabStatus(GRAB_STATUS.DOWNGRADING)).toBe(false);
  });

  it('recognizes queue progress statuses used by the transparency layer', () => {
    expect(isQueueProgressStatus(GRAB_STATUS.QUEUED)).toBe(true);
    expect(isQueueProgressStatus(GRAB_STATUS.WAITING)).toBe(true);
    expect(isQueueProgressStatus(GRAB_STATUS.PENDING_RECOVERY)).toBe(true);
    expect(isQueueProgressStatus(GRAB_STATUS.ORDER_CREATED)).toBe(true);
    expect(isQueueProgressStatus('PENDING' as any)).toBe(false);
  });
});
