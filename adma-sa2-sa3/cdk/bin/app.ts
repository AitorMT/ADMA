// Punto de entrada del proyecto CDK

import * as cdk from 'aws-cdk-lib';
import { DriftStack } from '../lib/drift-stack';

const app = new cdk.App();

// Stack principal donde se define el control de drift
new DriftStack(app, 'DriftStack');