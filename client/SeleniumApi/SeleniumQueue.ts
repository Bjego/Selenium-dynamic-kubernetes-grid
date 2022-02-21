export interface SeleniumQueue {
    value: Array<SeleniumQueueEntry>
}

interface SeleniumQueueEntry {
    requestId: string
}