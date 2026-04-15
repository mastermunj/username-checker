import { DetectionMethod, type SiteConfig } from '../../src/types.js';

export const regressionSiteFixtures = {
  slides: {
    name: 'Slides',
    url: 'https://slides.com/{}',
    urlMain: 'https://slides.com/',
    errorType: DetectionMethod.STATUS_CODE,
    errorCode: 204,
  },
  platzi: {
    name: 'Platzi',
    url: 'https://platzi.com/p/{}/',
    urlMain: 'https://platzi.com/',
    errorType: DetectionMethod.STATUS_CODE,
    errorCode: 404,
    requestMethod: 'GET',
  },
  wowhead: {
    name: 'Wowhead',
    url: 'https://wowhead.com/user={}',
    urlMain: 'https://wowhead.com/',
    errorType: DetectionMethod.STATUS_CODE,
    errorCode: 404,
  },
  addonsWago: {
    name: 'addons.wago.io',
    url: 'https://addons.wago.io/user/{}',
    urlMain: 'https://addons.wago.io/',
    errorType: DetectionMethod.STATUS_CODE,
    errorCode: 404,
  },
  mixedDetection: {
    name: 'MixedDetection',
    url: 'https://example.com/{}',
    urlMain: 'https://example.com/',
    errorType: [DetectionMethod.MESSAGE, DetectionMethod.STATUS_CODE],
    errorMsg: 'User not found',
  },
  excludedForum: {
    name: 'ExcludedForum',
    url: 'https://forum.example.com/u/{}',
    urlMain: 'https://forum.example.com/',
    errorType: DetectionMethod.MESSAGE,
    errorMsg: 'User not found',
    isExcluded: true,
  },
} satisfies Record<string, SiteConfig>;

export const responseFixtures = {
  rateLimitedBody: 'Too many requests. Please try again later.',
  cloudflareChallenge: '<span id="challenge-error-text">Access denied</span>',
  awsWafChallenge: 'AwsWafIntegration.forceRefreshToken',
};
