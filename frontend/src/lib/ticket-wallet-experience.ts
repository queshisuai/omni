import type { TicketTransferCreateVO, TicketWalletItemVO } from '../types/api.ts'

export interface TicketWalletStatusCopy {
  title: string
  description: string
}

export function getTicketWalletStatusCopy(
  ticket: Pick<TicketWalletItemVO, 'status' | 'checkedInAt'>,
  activeTransfer?: TicketTransferCreateVO | null,
): TicketWalletStatusCopy {
  if (ticket.status === 1 && activeTransfer) {
    return {
      title: '转赠中',
      description: '这张票已生成转赠码，好友领取前你可以撤回；领取成功后将不能再用于你的入场码。',
    }
  }

  if (ticket.status === 1) {
    return {
      title: '可入场',
      description: '这张票可生成入场码，请在现场核验前打开；如需转赠，请在入场前完成并确认好友领取。',
    }
  }

  if (ticket.status === 2) {
    return {
      title: '已完成核验',
      description: ticket.checkedInAt
        ? '这张票已完成入场核验，同一电子票不能重复入场。'
        : '这张票已完成入场核验，同一电子票不能重复入场。',
    }
  }

  if (ticket.status === 3) {
    return {
      title: '已失效',
      description: '这张票因订单取消、退款或票券状态变更已失效，不能再生成入场码。',
    }
  }

  if (ticket.status === 4) {
    return {
      title: '已转赠',
      description: '这张票已转赠给他人，不能再用于入场；如有疑问请查看订单详情或联系客服。',
    }
  }

  return {
    title: '状态同步中',
    description: '票券状态正在同步，请稍后刷新票夹；如长时间未更新，可从订单详情联系客服。',
  }
}
