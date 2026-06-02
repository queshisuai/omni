import { WaitlistMqConsumer } from './waitlist-mq.consumer';

function message(content: unknown, headers: Record<string, unknown> = {}) {
  return {
    content: Buffer.from(typeof content === 'string' ? content : JSON.stringify(content)),
    properties: { headers },
  } as any;
}

describe('WaitlistMqConsumer', () => {
  it('rejects a transient waitlist release failure into the retry topology', async () => {
    const allocator = { allocate: jest.fn().mockRejectedValue(new Error('temporary database outage')) };
    const consumer = new WaitlistMqConsumer(allocator as any);
    const channel = { ack: jest.fn(), reject: jest.fn(), publish: jest.fn() };
    const msg = message({ eventKey: 'release-1', source: 'ORDER_TIMEOUT', sessionId: 101, ticketTypeId: 202, quantity: 1 });

    await (consumer as any).handleReleasedMessage(channel, msg);

    expect(channel.reject).toHaveBeenCalledWith(msg, false);
    expect(channel.publish).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('moves a waitlist release message to dlq after retry limit is reached', async () => {
    const allocator = { allocate: jest.fn().mockRejectedValue(new Error('still failing')) };
    const consumer = new WaitlistMqConsumer(allocator as any);
    const channel = { ack: jest.fn(), reject: jest.fn(), publish: jest.fn() };
    const msg = message(
      { eventKey: 'release-1', source: 'ORDER_TIMEOUT', sessionId: 101, ticketTypeId: 202, quantity: 1 },
      { 'x-death': [{ queue: 'waitlist.released.retry.queue', count: 3 }] },
    );

    await (consumer as any).handleReleasedMessage(channel, msg);

    expect(channel.publish).toHaveBeenCalledWith(
      'omni.waitlist.dlx',
      'waitlist.released.dlq',
      msg.content,
      expect.objectContaining({ persistent: true }),
    );
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.reject).not.toHaveBeenCalled();
  });

  it('moves invalid order-paid payloads to dlq without retrying', async () => {
    const allocator = { markPaidByOrder: jest.fn() };
    const consumer = new WaitlistMqConsumer(allocator as any);
    const channel = { ack: jest.fn(), reject: jest.fn(), publish: jest.fn() };
    const msg = message('{bad json');

    await (consumer as any).handleOrderPaidMessage(channel, msg);

    expect(channel.publish).toHaveBeenCalledWith(
      'omni.waitlist.dlx',
      'waitlist.order-paid.dlq',
      msg.content,
      expect.objectContaining({ persistent: true }),
    );
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.reject).not.toHaveBeenCalled();
  });

  it('moves incomplete order-paid payloads to dlq without retrying', async () => {
    const allocator = { markPaidByOrder: jest.fn() };
    const consumer = new WaitlistMqConsumer(allocator as any);
    const channel = { ack: jest.fn(), reject: jest.fn(), publish: jest.fn() };
    const msg = message({});

    await (consumer as any).handleOrderPaidMessage(channel, msg);

    expect(allocator.markPaidByOrder).not.toHaveBeenCalled();
    expect(channel.publish).toHaveBeenCalledWith(
      'omni.waitlist.dlx',
      'waitlist.order-paid.dlq',
      msg.content,
      expect.objectContaining({ persistent: true }),
    );
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.reject).not.toHaveBeenCalled();
  });

  it('moves incomplete waitlist release payloads to dlq without retrying', async () => {
    const allocator = { allocate: jest.fn() };
    const consumer = new WaitlistMqConsumer(allocator as any);
    const channel = { ack: jest.fn(), reject: jest.fn(), publish: jest.fn() };
    const msg = message({ eventKey: 'release-1', source: 'ORDER_TIMEOUT', sessionId: 101, quantity: 1 });

    await (consumer as any).handleReleasedMessage(channel, msg);

    expect(allocator.allocate).not.toHaveBeenCalled();
    expect(channel.publish).toHaveBeenCalledWith(
      'omni.waitlist.dlx',
      'waitlist.released.dlq',
      msg.content,
      expect.objectContaining({ persistent: true }),
    );
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.reject).not.toHaveBeenCalled();
  });
});
