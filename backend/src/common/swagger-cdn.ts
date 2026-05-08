import { INestApplication } from '@nestjs/common';
import { OpenAPIObject } from '@nestjs/swagger';

const SWAGGER_UI_VERSION = '5.17.14';
const CDN = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}`;

interface SetupSwaggerCdnOptions {
  openApiPath?: string;
  uiPath?: string;
  siteTitle?: string;
}

export function setupSwaggerCdn(
  app: INestApplication,
  document: OpenAPIObject,
  options: SetupSwaggerCdnOptions = {},
): void {
  const openApiPath = options.openApiPath ?? '/api-json';
  const uiPath = options.uiPath ?? '/';
  const siteTitle = options.siteTitle ?? 'Backend API Documentation';

  const httpAdapter = app.getHttpAdapter();

  httpAdapter.get(openApiPath, (_req: unknown, res: any) => {
    res.type('application/json').send(document);
  });

  const html = renderSwaggerHtml(openApiPath, siteTitle);
  httpAdapter.get(uiPath, (_req: unknown, res: any) => {
    res.type('text/html').send(html);
  });
}

function renderSwaggerHtml(openApiUrl: string, siteTitle: string): string {
  const safeUrl = JSON.stringify(openApiUrl);
  const safeTitle = escapeHtml(siteTitle);
  const cssHref = JSON.stringify(`${CDN}/swagger-ui.css`);
  const bundleSrc = JSON.stringify(`${CDN}/swagger-ui-bundle.js`);
  const presetSrc = JSON.stringify(`${CDN}/swagger-ui-standalone-preset.js`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <link rel="stylesheet" href=${cssHref} />
  <link rel="icon" href="https://nestjs.com/favicon.ico" />
  <style>body { margin: 0; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src=${bundleSrc}></script>
  <script src=${presetSrc}></script>
  <script>
    window.addEventListener('load', function () {
      window.ui = SwaggerUIBundle({
        url: ${safeUrl},
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout',
      });
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
