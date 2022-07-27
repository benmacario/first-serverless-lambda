import { document } from "../utils/dynamodbClient";

import { APIGatewayProxyHandler } from "aws-lambda";

interface IResponseItems {
    id: string;
    name: string;
    created_at: string;
}

export const handler: APIGatewayProxyHandler = async (event) => {
    const { id } = event.pathParameters;

    const response = await document.query({
        TableName: 'users_certificate',
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: {
            ':id': id
        }
    }).promise();

    const userCertificate = response.Items[0] as IResponseItems;

    if (userCertificate) {
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Certificado válido',
                url: `${process.env.S3_BASE_URL}/${id}.pdf`,
                userName: userCertificate.name
            })
        }
    }

    return {
        statusCode: 400,
        body: JSON.stringify({
            message: 'Certificado invalido'
        })
    }
}