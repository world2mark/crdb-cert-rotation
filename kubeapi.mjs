'use strict';



import HTTPS from 'https';
import WebSocket from 'ws';


function RunRequest(RequestOpts) {
//    console.log(`Issuing Request: ${RequestOpts.URL}`);
    return new Promise((resolve, reject) => {
        const URLQuery = new URL(RequestOpts.URL);
        const requestOpts = {
            hostname: URLQuery.hostname,
            path: `${URLQuery.pathname}${URLQuery.search}`,
            method: RequestOpts.Method,
            headers: RequestOpts.Headers,
            rejectUnauthorized: false,
        };

        const ReqObj = HTTPS.request(requestOpts, myResp => {
            myResp.on('error', err => {
                reject(err);
            });

            RequestOpts.ReturnedHeaders = myResp.headers;
            RequestOpts.StatusCode = myResp.statusCode;
            const dataBlocks = [];

            myResp.setEncoding('utf8');

            myResp.on('data', (chunk) => {
                dataBlocks.push(chunk);
            });
            myResp.on('end', () => {
                const finalData = dataBlocks.join('');
                const ContentType = RequestOpts.ReturnedHeaders['content-type'];
                if (ContentType && ContentType.includes('application/json')) {
                    try {
                        resolve(JSON.parse(finalData));
                    } catch (err) {
                        reject(err);
                    };
                } else if (ContentType && ContentType.includes('application/x-www-form-urlencoded')) {
                    const fields = new URLSearchParams(finalData);
                    resolve(fields);
                } else {
                    resolve(finalData);
                };
            });
        });

        ReqObj.end();
    });
};



function RunRequestWS(ReqObj) {
//    console.log(`Issuing Request (WS): ${ReqObj.URL}`);
    return new Promise((resolve, reject) => {
        // Create the WebSocket connection
        const ws = new WebSocket(ReqObj.URL, {
            headers: ReqObj.Headers,
            rejectUnauthorized: false, // Set to true if using a valid certificate
        });

        // Handle WebSocket connection open event
        ws.on('open', () => {
            //console.log('WebSocket connection opened');
        });

        // Handle WebSocket message event
        ws.on('message', (data) => {
            const dataAsString = data.toString().trim();
            if (dataAsString.length > 1) {
                console.log('Received:', dataAsString);
            };
        });

        // Handle WebSocket error event
        ws.on('error', error => {
            if (error.message.includes(' subprotocol ')) {
                //                console.log('Ignoring subprotocol error:', error.message);
                return;
            };
            console.log(error);
            reject(error);
        });

        // Handle WebSocket close event
        ws.on('close', () => {
            resolve();
        });
    });
};



async function GetSecret(ReqObj) {
    const results = await RunRequest({
        Method: 'GET',
        URL: `${ReqObj.KubeAPI}/api/v1/namespaces/${ReqObj.NS}/secrets/${ReqObj.Secret}`,
        Headers: {
            'Authorization': `Bearer ${ReqObj.Token}`,
            'Content-Type': 'application/json'
        }
    });
    return results;
};



async function GetPodsByLabels(ReqObj) {
    const selectorList = Object.entries(ReqObj.SelectorLabels);
    const stringList = selectorList.map(selectorEntry => `${selectorEntry[0]}=${selectorEntry[1]}`);
    const results = await RunRequest({
        Method: 'GET',
        URL: `${ReqObj.KubeAPI}/api/v1/namespaces/${ReqObj.NS}/pods?labelSelector=${stringList.join(',')}`,
        Headers: {
            'Authorization': `Bearer ${ReqObj.Token}`,
            'Content-Type': 'application/json'
        }
    });
    return results;
};



async function ExecOnPod(ReqObj) {
    // const results = await RunRequestWS({
    //     URL: `${ReqObj.KubeAPI}/api/v1/namespaces/${ReqObj.NS}/pods/${ReqObj.PodName}/exec?command=${ReqObj.Command.join('&command=')}&container=db&stdin=true&stdout=true&stderr=true&tty=false`,
    //     Headers: {
    //         'Authorization': `Bearer ${ReqObj.Token}`
    //     }
    // });
    const results = await RunRequestWS({
        URL: `${ReqObj.KubeAPI}/api/v1/namespaces/${ReqObj.NS}/pods/${ReqObj.PodName}/exec?command=${ReqObj.Command.join('&command=')}&container=${ReqObj.ContainerName}&stdin=true&stdout=true&stderr=true&tty=false`,
        Headers: {
            'Authorization': `Bearer ${ReqObj.Token}`
        }
    });
    return results;
};



export default {
    GetSecret,
    GetPodsByLabels,
    ExecOnPod
};
