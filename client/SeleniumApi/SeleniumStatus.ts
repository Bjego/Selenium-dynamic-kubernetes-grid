export interface SeleniumStatus {
    value: SeleniumStatusValue
}

interface SeleniumStatusValue {
    ready: boolean,
    message: string,
    nodes: Array<SeleniumNode>
}

export interface SeleniumNode {
    id: string,
    slots: Array<SeleniumNodeSlot>
}

interface SeleniumNodeSlot {
    session: SeleniumSession | null
}

interface SeleniumSession {
    sessionId: string
}