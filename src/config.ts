export enum UsernameCheckerRuleNameEnum {
  STATUS_404 = 'STATUS_404',
  STATUS_403 = 'STATUS_403',
  REGEX = 'AVAILABLE',
  URL_NOT_IN_CONTENT = 'URL_NOT_IN_CONTENT',
}

type UsernameCheckerRule = {
  name: UsernameCheckerRuleNameEnum;
  matches?: string[];
  notMatches?: string[];
};

type UsernameCheckerServiceType = {
  [key: string]: {
    url: string;
    publicUrl?: string;
    rules: UsernameCheckerRule[];
  };
};

export const UsernameCheckerServices: UsernameCheckerServiceType = {
  about: {
    url: 'https://about.me/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  askfm: {
    url: 'https://ask.fm/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  bandcamp: {
    url: 'https://bandcamp.com/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  basecamphq: {
    url: 'https://{{ username }}.basecamphq.com/login',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  behance: {
    url: 'https://www.behance.net/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  bitbucket: {
    url: 'https://bitbucket.org/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  blogspot: {
    url: 'https://{{ username }}.blogspot.com/',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  buzzfeed: {
    url: 'https://www.buzzfeed.com/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  cash: {
    url: 'https://cash.me/${{ username }}/',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  codecademy: {
    url: 'https://www.codecademy.com/profiles/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  contently: {
    url: 'https://{{ username }}.contently.com/',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  dailymotion: {
    url: 'https://www.dailymotion.com/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  designspiration: {
    url: 'https://www.designspiration.net/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  deviantart: {
    url: 'https://www.deviantart.com/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  disqus: {
    url: 'https://disqus.com/by/{{ username }}/',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  dribbble: {
    url: 'https://dribbble.com/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  ebay: {
    url: 'https://www.ebay.com/usr/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  ebaystore: {
    url: 'https://www.ebay.com/str/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  etsy: {
    url: 'https://www.etsy.com/people/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  eyeem: {
    url: 'https://www.eyeem.com/u/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  facebook: {
    url: 'https://facebook.com/{{ username }}',
    rules: [
      { name: UsernameCheckerRuleNameEnum.STATUS_404 },
      { name: UsernameCheckerRuleNameEnum.REGEX, matches: ['log in to continue'] },
    ],
  },
  fanpop: {
    url: 'https://www.fanpop.com/fans/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  fiverr: {
    url: 'https://www.fiverr.com/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  flickr: {
    url: 'https://www.flickr.com/photos/{{ username }}/',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  flipboard: {
    url: 'https://flipboard.com/@{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  github: {
    url: 'https://github.com/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  gitlab: {
    url: 'https://gitlab.com/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_403 }],
  },
  gravatar: {
    url: 'https://en.gravatar.com/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  houzz: {
    url: 'https://www.houzz.com/user/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  hubpages: {
    url: 'https://hubpages.com/@{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  ifttt: {
    url: 'https://ifttt.com/p/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  instructables: {
    url: 'https://www.instructables.com/member/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  kanoworld: {
    url: 'https://beta.world.kano.me/explore/user/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  keybase: {
    url: 'https://keybase.io/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  kik: {
    url: 'https://kik.me/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  kongregate: {
    url: 'https://www.kongregate.com/accounts/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  last: {
    url: 'https://www.last.fm/user/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  livejournal: {
    url: 'https://{{ username }}.livejournal.com',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  medium: {
    url: 'https://medium.com/@{{ username }}/',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  mix: {
    url: 'https://mix.com/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  myshopify: {
    url: 'https://{{ username }}.myshopify.com',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  myspace: {
    url: 'https://myspace.com/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  newgrounds: {
    url: 'https://{{ username }}.newgrounds.com/',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  pandora: {
    url: 'https://www.pandora.com/profile/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  pastebin: {
    url: 'https://pastebin.com/u/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  patreon: {
    url: 'https://www.patreon.com/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  paypal: {
    url: 'https://www.paypal.me/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  photobucket: {
    url: 'https://photobucket.com/user/{{ username }}/library',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  pinterest: {
    url: 'https://www.pinterest.com/{{ username }}/',
    rules: [
      { name: UsernameCheckerRuleNameEnum.STATUS_404 },
      { name: UsernameCheckerRuleNameEnum.REGEX, notMatches: ['@USERNAME'] },
    ],
  },
  producthunt: {
    url: 'https://www.producthunt.com/@{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  reddit: {
    url: 'https://www.reddit.com/user/{{ username }}/',
    rules: [
      { name: UsernameCheckerRuleNameEnum.STATUS_404 },
      { name: UsernameCheckerRuleNameEnum.REGEX, notMatches: [`u/USERNAME`] },
    ],
  },
  reverbnation: {
    url: 'https://www.reverbnation.com/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  roblox: {
    url: 'https://auth.roblox.com/v1/usernames/validate?birthday=2015-03-04T00:00:00.000Z&context=Signup&username={{ username }}',
    rules: [
      { name: UsernameCheckerRuleNameEnum.STATUS_404 },
      { name: UsernameCheckerRuleNameEnum.REGEX, matches: ['is valid'] },
    ],
  },
  slack: {
    url: 'https://{{ username }}.slack.com/',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  slideshare: {
    url: 'https://www.slideshare.net/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  soundcloud: {
    url: 'https://soundcloud.com/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  spotify: {
    url: 'https://open.spotify.com/user/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  steamcommunity: {
    url: 'https://steamcommunity.com/id/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  telegram: {
    url: 'https://telegram.me/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  tiktok: {
    url: 'https://www.tiktok.com/@{{ username }}?lang=en',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  tradingview: {
    url: 'https://www.tradingview.com/u/{{ username }}/',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  trakt: {
    url: 'https://trakt.tv/users/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  tripit: {
    url: 'https://www.tripit.com/people/{{ username }}#/profile/basic-info',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  tumblr: {
    url: 'https://{{ username }}.tumblr.com/',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  twitch: {
    url: 'https://www.twitch.tv/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.URL_NOT_IN_CONTENT }],
  },
  twitter: {
    publicUrl: 'https://twitter.com/{{ username }}',
    url: 'https://api.twitter.com/i/users/username_available.json?username={{ username }}',
    rules: [
      { name: UsernameCheckerRuleNameEnum.STATUS_404 },
      { name: UsernameCheckerRuleNameEnum.REGEX, matches: ['Available'] },
    ],
  },
  venmo: {
    url: 'https://venmo.com/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  vimeo: {
    url: 'https://vimeo.com/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  vk: {
    url: 'https://vk.com/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  wattpad: {
    url: 'https://www.wattpad.com/user/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  wikia: {
    url: 'https://fandom.wikia.com/u/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  wikipedia: {
    url: 'https://en.wikipedia.org/wiki/User:{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  wordpress: {
    url: 'https://{{ username }}.wordpress.com/',
    rules: [
      { name: UsernameCheckerRuleNameEnum.STATUS_404 },
      { name: UsernameCheckerRuleNameEnum.REGEX, matches: ['doesn&apos;t&nbsp;exist'] },
    ],
  },
  ycombinator: {
    url: 'https://news.ycombinator.com/user?id={{ username }}',
    rules: [
      { name: UsernameCheckerRuleNameEnum.STATUS_404 },
      { name: UsernameCheckerRuleNameEnum.REGEX, matches: ['No such user'] },
    ],
  },
  yelp: {
    url: 'https://{{ username }}.yelp.com',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  younow: {
    url: 'https://www.younow.com/{{ username }}/channel',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
  youtube: {
    url: 'https://www.youtube.com/{{ username }}',
    rules: [{ name: UsernameCheckerRuleNameEnum.STATUS_404 }],
  },
};
