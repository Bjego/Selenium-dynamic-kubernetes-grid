# Dynamic scaling Selenium grid in kubernetes
Hey guys, today (21st February 2022) I'm sharing my code and thoughts of a dynamic scaling selenium 4 grids in kubernetes. When you run your selenium grid in docker on your local machine, you can easily setup a dynamic grid with docker compose [More here](https://github.com/SeleniumHQ/docker-selenium#dynamic-grid). This feature isn't yet supported in a kubernetes environment.

# What's the problem with dynamic grids in kubernetes?
For a dynamic scaling grid you need to call the kubernetes api - through a client which could be kubectl or any other client library. These clients need to match the version of your kubernetes cluster, as kubernetes is updated frequently - these clients aren't part of the selenium project. And I don't think that they will ever be part of it.

# How do we archive a dynamic grid in kubernetes then?
We need a manager tool which polls the selenium grid apis:
- [Grid status](https://www.selenium.dev/documentation/grid/advanced_features/endpoints/#grid-status)
    - The grid status gives us information about the browser nodes connected to selenium and also if they are running a session
- [Session queue](https://www.selenium.dev/documentation/grid/advanced_features/endpoints/#get-new-session-queue-requests)
    - The session queue gives us information about the queued sessions and their needed capabilities. We need this information to deploy pods later
- [Drain node](https://www.selenium.dev/documentation/grid/advanced_features/endpoints/#drain-node)
    - The drain API will be used to shut down no longer needed browser nodes

And the manager must be able to talk to kubernetes as well:
- [Create pod](https://kubernetes.io/docs/reference/kubectl/cheatsheet/#creating-objects)
    - The manager must deploy pods to kubernetes.

We don't need to delete existing objects in kubernetes. When we use the drain api from selenium the drained nodes will shutdown and the pods will change their status to completed

# Configure your pods correctly
In kubernetes the default behaviour of pods is: restartPolicy: always. We don't want this behaviour here, because a drained browser node shouldn't be restartet. It's gone and that's fine - we do want to archive this. So the pods we deploy look like this: restartPolicy: never. See the example code below.
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: chrome-node-1
spec:
  volumes:
    - name: dshm
      emptyDir:
        medium: Memory
  restartPolicy: Never
  containers:
    - name: selenium-node-chrome
      image: selenium/node-chrome:4

      ports:
        - containerPort: 5555
      volumeMounts:
        - mountPath: /dev/shm
          name: dshm
      env:
        - name: SE_EVENT_BUS_HOST
          value: "selenium-hub"
        - name: SE_EVENT_BUS_SUBSCRIBE_PORT
          value: "4443"
        - name: SE_EVENT_BUS_PUBLISH_PORT
          value: "4442"
      resources:
        limits:
          memory: "550Mi"
          cpu: "500m"
```

# So let's talk about the code - how does the code work in general
This code is querying the selenium apis "Grid status" and "Session queue" at the beginning. The session queue gives us important inforation about the number of requests and also the requested capablilites. 

**This code isn't respecting the requested capabilities as we only test on chrome nodes!**
An example queue information looks like this:
Request: GET https://selenium.yourorg.com/se/grid/newsessionqueue/queue
Response:
```json
{
    "value": [
        {
            "capabilities": [
                {
                    "acceptInsecureCerts": true,
                    "browserName": "chrome",
                    "goog:chromeOptions": {
                        "args": [],
                        "extensions": []
                    }
                }
            ],
            "requestId": "38570b15-6cf6-40bf-96f8-df507ec4256d"
        },
        ...
    ]
}
```

And then we need to query the status of the grid to see how many nodes we have and what they are doing right now. The most interesting values are the id of the node and the session it's null if the node is idle, or filled with a detailed sessioninformation, if it's running tests. Another helpful information is the stereotype, if you run your tests on different brower types - as I said this code is just using chrome, therefore the code is ignoring the stereotype.

Request: GET https://selenium.yourorg.com/status
Response:
```json
{
    "value": {
        "ready": true,
        "message": "Selenium Grid ready.",
        "nodes": [
            {
                "id": "fd1ab0ad-e375-41b7-aec7-f95b866e3a86",
                "uri": "http://10.233.67.161:5555",
                "maxSessions": 1,
                "osInfo": {
                    "arch": "amd64",
                    "name": "Linux",
                    "version": "5.4.0-42-generic"
                },
                "heartbeatPeriod": 60000,
                "availability": "UP",
                "version": "4.1.2 (revision 9a5a329c5a)",
                "slots": [
                    {
                        "id": {
                            "hostId": "fd1ab0ad-e375-41b7-aec7-f95b866e3a86",
                            "id": "7b09bb45-898b-4a44-bdea-18fa77901df8"
                        },
                        "lastStarted": "2022-02-21T11:44:12.072459Z",
                        "session": {
                            "capabilities": {
                                "acceptInsecureCerts": true,
                                "browserName": "chrome",
                                "browserVersion": "98.0.4758.102",
                                "chrome": {
                                    "chromedriverVersion": "98.0.4758.102 (273bf7ac8c909cde36982d27f66f3c70846a3718-refs/branch-heads/4758@{#1151})",
                                    "userDataDir": "/tmp/.com.google.Chrome.1OTIS2"
                                },
                                "goog:chromeOptions": {
                                    "debuggerAddress": "localhost:36989"
                                },
                                "networkConnectionEnabled": false,
                                "pageLoadStrategy": "normal",
                                "platformName": "linux",
                                "proxy": {},
                                "se:cdp": "ws://10.233.67.161:4444/session/afa9e52ff23fcc5499dc7e436bcf925d/se/cdp",
                                "se:cdpVersion": "98.0.4758.102",
                                "se:vnc": "ws://10.233.67.161:4444/session/afa9e52ff23fcc5499dc7e436bcf925d/se/vnc",
                                "se:vncEnabled": true,
                                "se:vncLocalAddress": "ws://10.233.67.161:7900",
                                "setWindowRect": true,
                                "strictFileInteractability": false,
                                "timeouts": {
                                    "implicit": 0,
                                    "pageLoad": 300000,
                                    "script": 30000
                                },
                                "unhandledPromptBehavior": "dismiss and notify",
                                "webauthn:extension:credBlob": true,
                                "webauthn:extension:largeBlob": true,
                                "webauthn:virtualAuthenticators": true
                            },
                            "sessionId": "afa9e52ff23fcc5499dc7e436bcf925d",
                            "start": "2022-02-21T11:44:12.072459Z",
                            "stereotype": {
                                "browserName": "chrome",
                                "browserVersion": "98.0",
                                "platformName": "Linux",
                                "se:vncEnabled": true
                            },
                            "uri": "http://10.233.67.161:5555"
                        },
                        "stereotype": {
                            "browserName": "chrome",
                            "browserVersion": "98.0",
                            "platformName": "Linux",
                            "se:vncEnabled": true
                        }
                    }
                ]
            }
        ]
    }
}
```

Now we know how to scale our cluster!
If we have nodes which are idling around - we can drain them. If we do have a full queue - we need more nodes!

## Draining non used nodes
Draining is as simple as the other requests to the selenium grid. We just need our idle node ids and send the drain request. 
**Be carefull you have to add a special header to this request**: "X-REGISTRATION-SECRET;" with no value in kubernetes.
Request: POST https://selenium.yourorg.com//se/grid/distributor/node/NODEID/drain -> https://selenium.yourorg.com//se/grid/distributor/node/fd1ab0ad-e375-41b7-aec7-f95b866e3a86/drain
Response:
```json
{
    "value": true,
    "message": "Node status was successfully set to draining."
}
```
Selenium tells us, when the current job is done - this node will be shut down. When we've configured our pod correctly, like I showed earlier the pod will be completed and no longer consume ressources.

## Adding new nodes
Adding new nodes is done via the kubernetes api. To archive this, we need to deploy new pods. The only adjustment we need to do is an update of the pod name in the metadata. When you are using more browsers than the chrome you need to deploy the right brower for your queue entry!

# The code 
This code is designed to run in a cron job in kubernetes later on, therefore the main application isn't polling the selenium hub all the time. 
I've choosen to embed my pod.json - it's JSON a chrome-node pod which I am going to deploy. I thought the json syntax is much easier to handle in a node application, then the typical yaml syntax.

The kubernetes clientlibs documentation can be found [on npmjs](https://www.npmjs.com/package/@kubernetes/client-node). **You should select the right version for your kubernetes cluster**

The selenium client is selfwritten and only the interesting interfaces and properties have been implemented. It's using node-fetch from [npmjs](https://www.npmjs.com/package/node-fetch).

.env File for easy debugging and configuration changes VSCode is using the file to set up the environment varables picked up by this application:
## Environment variables
- K8S_TOKEN
    - SA Token of your cluster
- K8S_SERVER_API
    - URL to your kubernetes cluster api
- K8S_NAMESPACE
    - The target namespace for your deployments
- SELENIUM_HUB
    - URL (from the ingress) of the selenium hub. If you are running a distributed selenium grid, you need to adjust the code to connect to the corrent api endpoints
- SELENIUM_MAXNODES
    - Maximum amount of nodes which should run in your selenium grid. This is optional.
- SELENIUM_MINNODES
    - Minimum amount of idle nodes which should be kept. This is optional
- LOGMODE
    - Should the app log in readable text set it to "TEXT", all other values will let the app log in JSON. This is optional.

Other content of this repo:

# Folder kubernetes
These are the initial deployment files I used to deploy my selenium hub and to run 2 initial nodes on it.

# Folder Postman
Postman workspace where I played around with the selenium API.

# Further ideas and scope of this repostory
This repository shares my ideas, how to run a dynamic grid in February 2022. It won't receive regular updates so feel free to fork it and extend it for your needs.

You should track the [Github issue 9845](https://github.com/SeleniumHQ/selenium/issues/9845), if there are better ways to implement a dynamic cluster manager in kubernetes today. I suggested webhooks, which could ease up the implementation of such a manager and could avoid polling or cron jobs.

See you soon.