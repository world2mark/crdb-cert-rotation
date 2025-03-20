'use strict';



import KubeAPI from './kubeapi.mjs';
import FS from 'fs';


async function Workflow() {
  console.log('Refreshing CRDB certs from SECRETS');

  let AdminToken = process.env.MZ_TOKEN;

  if (AdminToken) {
    console.log('Using token from environment variable');
  } else {
    console.log('Attempting to use mounted token...');

    AdminToken = FS.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token');
    console.log('Using Admin token.');
  };

  let KubeAPIURL = process.env.MZ_KUBE_API;
  if (!KubeAPIURL) {
    console.log('Defaulting to standard Kube API private endpoints...');
    KubeAPIURL = `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`;
  }

  console.log(`Kube API: ${KubeAPIURL}`);

  let SecretTuplesList = [];
  try {
    const secretTuples = process.env.MZ_SECRETS.split(',');
    for (const theTuple of secretTuples) {
      const tupleNameMount = theTuple.split(':');
      SecretTuplesList.push({
        Name: tupleNameMount[0],
        Mount: tupleNameMount[1]
      });
    };
  } catch (err) {
    console.log('Error: environment variable MZ_SECRETS must be a comma-separated list of secrets: name:mount-path,name:mount-path,...');
    return;
  };

  for (const secretTuple of SecretTuplesList) {
    const theSecretData = await KubeAPI.GetSecret({
      KubeAPI: KubeAPIURL,
      NS: process.env.MZ_NAMESPACE,
      Token: AdminToken,
      Secret: secretTuple.Name
    });
    secretTuple.Certs = theSecretData.data
  };

  const CRDB_POD_LABEL = process.env.MZ_CRDB_POD_LABEL_KV.split(':');

  const CRDBPods = await KubeAPI.GetPodsByLabels({
    KubeAPI: KubeAPIURL,
    NS: process.env.MZ_NAMESPACE,
    Token: AdminToken,
    SelectorLabels: {
      [CRDB_POD_LABEL[0]]: CRDB_POD_LABEL[1]
    }
  });

  for (const myPod of CRDBPods.items) {

    console.log(`Replacing old certs on pod: ${myPod.metadata.name}`);

    for (const secretObj of SecretTuplesList) {
      for (const CertTuple of Object.entries(secretObj.Certs)) {
        const delCertsResult = await KubeAPI.ExecOnPod({
          KubeAPI: KubeAPIURL,
          NS: process.env.MZ_NAMESPACE,
          Token: AdminToken,
          PodName: myPod.metadata.name,
          ContainerName: process.env.MZ_CONTAINER_NAME,
          Command: [
            `sh`,
            `-c`,
            `rm ${secretObj.Mount}/${CertTuple[0]}`
          ]
        });

        const CreateNodeCrtResult = await KubeAPI.ExecOnPod({
          KubeAPI: KubeAPIURL,
          NS: process.env.MZ_NAMESPACE,
          Token: AdminToken,
          PodName: myPod.metadata.name,
          ContainerName: process.env.MZ_CONTAINER_NAME,
          Command: [
            `sh`,
            `-c`,
            `echo \'${CertTuple[1]}\' | base64 -d > ${secretObj.Mount}/${CertTuple[0]}`]
        });
      };
    };

    const FixPermissionsOnKey = await KubeAPI.ExecOnPod({
      KubeAPI: KubeAPIURL,
      NS: process.env.MZ_NAMESPACE,
      Token: AdminToken,
      PodName: myPod.metadata.name,
      ContainerName: process.env.MZ_CONTAINER_NAME,
      Command: [
        `sh`,
        `-c`,
        `chmod 700 /cockroach/cockroach-certs/*.key`]
    });

    const HUPResult = await KubeAPI.ExecOnPod({
      KubeAPI: KubeAPIURL,
      NS: process.env.MZ_NAMESPACE,
      Token: AdminToken,
      PodName: myPod.metadata.name,
      ContainerName: process.env.MZ_CONTAINER_NAME,
      Command: [
        `sh`,
        `-c`,
        `kill -s HUP 1`]
    });

    console.log(`Rotated CA cert on pod: ${myPod.metadata.name}`);
  };

  console.log('Workflow completed');

};


async function Workflow22() {
  /*
 
Service Account
---------------
apiVersion: v1
kind: ServiceAccount
metadata:
  name: crdb-cert-refresher-sa
  namespace: crdb-cert-refresher
 
Cluster Role
------------
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: crdb-secret-pod-access
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch", "attach", "exec"]
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "list", "watch", "create", "update", "patch"]
  - apiGroups: [""]
    resources: ["pods/exec"]
    verbs: ["create", "get"]
 
Cluster Role Binding
--------------------
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: crdb-cert-refresher-binding
subjects:
  - kind: ServiceAccount
    name: crdb-cert-refresher-sa
    namespace: crdb-cert-refresher
roleRef:
  kind: ClusterRole
  name: crdb-secret-pod-access
  apiGroup: rbac.authorization.k8s.io

 
*/
};

Workflow().catch(err => {
  console.error(err);
});
