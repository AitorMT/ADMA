# Lambda que corrige drift en Security Groups
# En este caso elimina accesos peligrosos (ej: 0.0.0.0/0)

import boto3

ec2 = boto3.client('ec2')

def lambda_handler(event, context):
    print("Drift detected, fixing...")

    # Sustituir por tu SG real (puedes sacarlo de Terraform output)
    SECURITY_GROUP_ID = "sg-0b5545dac80825658"

    try:
        # Eliminamos acceso peligroso a Postgresql desde cualquier sitio
        ec2.revoke_security_group_ingress(
            GroupId=SECURITY_GROUP_ID,
            IpPermissions=[
                {
                    'IpProtocol': 'tcp',
                    'FromPort': 5432,
                    'ToPort': 5432,
                    'IpRanges': [{'CidrIp': '0.0.0.0/0'}]
                }
            ]
        )

        print("Drift corrected successfully")

    except Exception as e:
        print("Error:", str(e))

    return {
        'statusCode': 200,
        'body': 'Drift check completed'
    }