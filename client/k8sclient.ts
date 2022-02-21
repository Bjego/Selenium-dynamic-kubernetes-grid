import { CoreV1Api, KubeConfig, V1Pod } from '@kubernetes/client-node'
import log from './logger';
import { promises as fs } from 'fs';
export class K8sClient {
    Server: string;
    Namespace: string;
    Token: string;
    constructor() {
        this.Server = process.env.K8S_SERVER_API;
        this.Namespace = process.env.K8S_NAMESPACE;
        this.Token = process.env.K8S_TOKEN;
    }
    private BuildClient(): CoreV1Api {
        log('Building k8s client')
        const config = this.BuildConfig();
        return config.makeApiClient(CoreV1Api);
    }

    private BuildConfig(): KubeConfig {
        const config = new KubeConfig();
        config.addCluster({
            server: this.Server,
            name: 'kubernetes',
            skipTLSVerify: true
        });
        config.addUser({
            name: 'sa',
            token: this.Token
        });
        config.addContext({
            cluster: 'kubernetes',
            user: 'sa',
            namespace: this.Namespace,
            name: 'default'
        });
        config.setCurrentContext('default');
        return config;
    }

    ValidateConfig() {
        log('Validating K8S config');
        if (!this.Server) {
            log('Environment variable missing: K8S_SERVER_API', true);
            throw new Error("K8S_SERVER_API missing");
        }
        if (!this.Namespace) {
            log('Environment variable missing: K8S_NAMESPACE', true);
            throw new Error("K8S_NAMESPACE missing");
        }
        if (!this.Token) {
            log('Environment variable missing: K8S_TOKEN', true);
            throw new Error("K8S_TOKEN missing");
        }
        log('K8S config is okay');
    }

    async deployNodesAsync(numberOfNodes: number) {
        log('Using k8s api to deploy new pods');
        if (numberOfNodes > 0) {
            const podContent = await fs.readFile('./pod.json');
            const pod = JSON.parse(podContent.toString()) as V1Pod;
            const podName = pod.metadata.name;
            const uuid = Date.now();
            const client = this.BuildClient();
            for (let i = 0; i < numberOfNodes; i++) {
                const name = `${podName}-scaled-${i}-${uuid}`;
                log(`Creating pod: ${name}`);
                pod.metadata.name = name;
                pod.metadata.namespace = this.Namespace;
                await client.createNamespacedPod(this.Namespace, pod);
            }
        }

    }
}