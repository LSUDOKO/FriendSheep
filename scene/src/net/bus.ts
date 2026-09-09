import { MessageBus } from '@dcl/sdk/message-bus'

export const bus = new MessageBus()

export type HitMsg = {
  atk: string
  vic: string
  kind: 'flank' | 'front' | 'duel'
  stolen: number
  knock: number
  sx: number
  sz: number
  nonce: number
}

export type PopMsg = {
  who: string
  sheep: number
}

export const MSG_HIT = 'fs-hit'
export const MSG_POP = 'fs-pop'
