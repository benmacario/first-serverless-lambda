import { document } from '../utils/dynamodbClient';

import { APIGatewayProxyHandler } from "aws-lambda";
import { compile } from 'handlebars';
import { join } from 'path';
import { readFileSync } from 'fs';
import dayjs from 'dayjs';
import chromium from 'chrome-aws-lambda';
import { S3 } from 'aws-sdk'

interface ICreateCertificate {
    id: string;
    name: string;
    grade: string;
}

interface ITemplates {
    id: string;
    name: string;
    grade: string;
    medal: string;
    date: string;
}

const compileTemplate = async (data: ITemplates) => {
    const filePath = join(process.cwd(), 'src', 'templates', 'certificate.hbs');
    const html = readFileSync(filePath, 'utf-8');

    return compile(html)(data);
}

export const handler: APIGatewayProxyHandler = async (event) => {
    const { id, name, grade } = JSON.parse(event.body) as ICreateCertificate;

    const response = await document.query({
        TableName: 'users_certificate',
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: {
            ':id': id
        }
    }).promise();

    const userAlreadyExists = response.Items[0];

    if (!userAlreadyExists) {
        await document.put({
            TableName: 'users_certificate',
            Item: {
                id,
                name,
                grade,
                created_at: new Date().getTime()
            }
        }).promise();
    }

    const medalPath = join(process.cwd(), 'src', 'templates', 'selo.png');
    const medal = readFileSync(medalPath, 'base64');

    const data: ITemplates = {
        id,
        name,
        grade,
        date: dayjs().format('DD/MM/YYYY'),
        medal
    }

    const content = await compileTemplate(data);

    const browser = await chromium.puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
    });

    const page = await browser.newPage();

    await page.setContent(content);

    const pdf = await page.pdf({
        format: 'a4',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
        path: process.env.IS_OFFLINE ? './certificate.pdf' : null
    });
    await browser.close();

    const bucket = new S3();

    await bucket.putObject({
        Bucket: `${process.env.BUCKET_PDF}`,
        Key: `${id}.pdf`,
        ACL: 'public-read',
        Body: pdf,
        ContentType: 'application/pdf'
    }).promise();

    return {
        statusCode: 201,
        body: JSON.stringify({
            id: id,
            message: 'Certificado criado com sucesso!',
            url: `${process.env.S3_BASE_URL}/${id}.pdf`
        })
    }
};