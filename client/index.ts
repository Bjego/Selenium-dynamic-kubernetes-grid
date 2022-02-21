import { K8sClient } from "./k8sclient";
import SeleniumClient, { ScaleDirection } from "./seleniumClient";
import log from "./logger";

async function ScaleGridAsync() {
    log('Scaling Seleniumgrid');
    const k8sClient = new K8sClient();
    const seleniumClient = new SeleniumClient();
    k8sClient.ValidateConfig();
    const scaling = await seleniumClient.CalculateScalingAsync();
    switch (scaling.ScaleDirection) {
        case ScaleDirection.Up: {
            log('Scaling UP');
            await k8sClient.deployNodesAsync(scaling.NumberOfNewNodes);
            break;
        }
        case ScaleDirection.Down: {
            log('Scaling DOWN');
            await seleniumClient.DrainNodesAsync(scaling.DrainNodeIds);
            break;
        }
        default: {
            log("No scaling required.");
            break;
        }
    }
    log('Scaling finished');

}
ScaleGridAsync()
    .catch(err => {
        log(err, true);
    })
    .then(_ => process.exit());
