export const GRAB_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  ORDER_CREATING: 'ORDER_CREATING',
  ORDER_CREATED: 'ORDER_CREATED',
  SOLD_OUT: 'SOLD_OUT',
  LIMITED: 'LIMITED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
} as const;

export type GrabStatus = (typeof GRAB_STATUS)[keyof typeof GRAB_STATUS];

const TERMINAL_STATUSES = new Set<GrabStatus>([
  GRAB_STATUS.ORDER_CREATED,
  GRAB_STATUS.SOLD_OUT,
  GRAB_STATUS.LIMITED,
  GRAB_STATUS.FAILED,
  GRAB_STATUS.EXPIRED,
]);

export function isTerminalGrabStatus(status: GrabStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
