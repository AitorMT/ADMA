// Stack donde defino la Lambda y la regla de EventBridge

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';

export class DriftStack extends cdk.Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // ================================
    // Lambda que corrige drift
    // ================================
    const driftLambda = new lambda.Function(this, 'DriftFixer', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'drift_fixer.lambda_handler',
      code: lambda.Code.fromAsset('lambda'),

      // Comentario tipo estudiante
      // Esta lambda se ejecuta cuando se detecta un cambio no permitido
    });

    // ================================
    // Permisos para modificar Security Groups
    // ================================
    driftLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        "ec2:RevokeSecurityGroupIngress",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:DescribeSecurityGroups"
      ],
      resources: ["*"]
    }));

    // ================================
    // Regla EventBridge (simulación drift)
    // ================================
    new events.Rule(this, 'DriftRule', {
      // En un caso real esto vendría de AWS Config
      eventPattern: {
        source: ["aws.ec2"],
        detailType: ["AWS API Call via CloudTrail"],
        detail: {
          eventName: ["AuthorizeSecurityGroupIngress"]
        }
      },
      targets: [new targets.LambdaFunction(driftLambda)]
    });

    // Comentario:
    // Esta regla detecta cuando alguien abre un puerto manualmente
  }
}