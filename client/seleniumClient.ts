import log from './logger';
import fetch from 'node-fetch';
import { SeleniumQueue } from './SeleniumApi/SeleniumQueue';
import { SeleniumNode, SeleniumStatus } from './SeleniumApi/SeleniumStatus';

export enum ScaleDirection {
    None,
    Up,
    Down
}

interface ScaleInformation {
    ScaleDirection: ScaleDirection,
    NumberOfNewNodes: number | null,
    DrainNodeIds: Array<string> | null
}

interface ShutDownInfo {
    value: boolean,
    message: string
}

export default class SeleniumClient {
    MaxNodes: number;
    MinNodes: number;
    Hub: string;
    QueueUrl: URL;
    StatusUrl: URL;


    constructor() {
        this.MaxNodes = process.env.SELENIUM_MAXNODES ? parseInt(process.env.SELENIUM_MAXNODES, 10) : 500;
        this.MinNodes = process.env.SELENIUM_MINNODES ? parseInt(process.env.SELENIUM_MINNODES, 10) : 0;
        this.Hub = process.env.SELENIUM_HUB;
        this.Validate();
        this.QueueUrl = new URL('/se/grid/newsessionqueue/queue', this.Hub);
        this.StatusUrl = new URL('/status', this.Hub);
    }

    private Validate() {
        log('Validating Selenium config');
        if (!this.Hub) {
            log('Environment variable missing: SELENIUM_MAXNODES', true);
            throw new Error("SELENIUM_MAXNODES missing");
        }
        log('Selenium Config is okay');
    }

    async DrainNodesAsync(nodeIds: string[]): Promise<void> {
        log('Using selenium api to drain nodes');
        for (let nodeid of nodeIds) {
            log(`Draining node: ${nodeid}`);
            const url = new URL(`/se/grid/distributor/node/${nodeid}/drain`, this.Hub);
            const response = await fetch(url.toString(), {
                method: 'POST',
                headers: {
                    'X-REGISTRATION-SECRET': ''
                }
            });
            const shutDownInfo = await response.json() as ShutDownInfo;
            log(`Drainig node: ${nodeid} Message:${shutDownInfo.message}`, !shutDownInfo.value);
        }
    }

    async CalculateScalingAsync(): Promise<ScaleInformation> {
        log('Calculating scaling')
        const [queueLength, nodes] = await Promise.all([this.GetSeleniumQueueAsync(), this.GetSeleniumNodesAsync()]);

        if ((queueLength > 0 && nodes.length < this.MaxNodes) || nodes.length < this.MinNodes) {
            log('Queue is full and we can deploy new nodes');
            const maxNodesToScale = this.MaxNodes - nodes.length;
            const nodesToScale = maxNodesToScale > queueLength ? queueLength : maxNodesToScale;
            const numberOfNewNodes = queueLength == 0 ? this.MinNodes - nodes.length : nodesToScale

            return {
                ScaleDirection: ScaleDirection.Up,
                NumberOfNewNodes: numberOfNewNodes,
                DrainNodeIds: null
            };
        } else if (queueLength == 0) {
            const nodesToDrain = nodes.filter(n => n.slots.every(slot => slot.session == null));
            //Keep the last nodes
            const nodeIds = nodesToDrain.map(n => n.id).reverse().slice(this.MinNodes);
            if (nodeIds.length > 0) {
                log('Queue is empty. Draining unused nodes,');
                return {
                    ScaleDirection: ScaleDirection.Down,
                    NumberOfNewNodes: null,
                    DrainNodeIds: nodeIds
                };
            }
        }
        log('Grid won`t be scaled.')
        return {
            ScaleDirection: ScaleDirection.None,
            NumberOfNewNodes: null,
            DrainNodeIds: null
        }
    }

    private async GetSeleniumQueueAsync(): Promise<number> {
        log('Getting the selenium queue');
        const response = await fetch(this.QueueUrl.toString());
        const queue = await response.json() as SeleniumQueue;
        log(`Current selenium queue length: ${queue.value.length}`);
        return queue.value.length;
    }

    private async GetSeleniumNodesAsync(): Promise<Array<SeleniumNode>> {
        log('Getting the selenium status and nodes')
        const response = await fetch(this.StatusUrl.toString());
        const seleniumStatus = await response.json() as SeleniumStatus;
        if (seleniumStatus.value?.nodes != null) {
            log(`Selenium is ready and has ${seleniumStatus.value.nodes.length} nodes`);
            return seleniumStatus.value.nodes;
        }
        log('Selenium is not ready', true);
        throw Error('Selenium not ready');
    }


}