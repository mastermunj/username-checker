# Username Check
The Username Checker allows you to check the availability of a username across multiple websites.

## Installation

```js
npm install username-checker --save
```


## Usage

To use the Username Checker, you first need to import the package and create an instance of the `UsernameChecker` class:

```js
import UsernameChecker from 'username-checker';
const usernameChecker = new UsernameChecker();
```

You can then use the `isAvailable` method to check the availability of a username on a specific website:

```js
const result = usernameChecker.isAvailable('twitter', 'my-desired-username');
console.log(result); // { service: 'twitter', url: 'https://github.com/my-desired-username', available: true }
```

The `isAvailable` method takes two arguments - the website name (as a string) and the username to check (also a string). The method returns a `Promise` that resolves to an object containing information about the availability of the username on the specified website. The object has the following properties:

* `service` - the name of the website checked.
* `url` - the URL used to check the username.
* `available` - a boolean value indicating whether the username is available on the website. This could also be `undefined` in case there was no deterministic way to deduce the availability.
* `reason` - A potential reason of what could have gone wrong that resulted in `available` = `undefined`.


The `getServices` method returns an array of supported website names:
```js
const services = usernameChecker.getServices();
console.log(services); // ['github', 'twitter', 'instagram', ... ]
```


## Supported Websites
| Website                           | Name Used in `isAvailable` Method |
| --------------------------------- | --------------------------------- |
| About                             | `about`                           |
| Ask.fm                            | `askfm`                           |
| Bandcamp                          | `bandcamp`                        |
| BasecampHQ                        | `basecamphq`                      |
| Behance                           | `behance`                         |
| Bitbucket                         | `bitbucket`                       |
| Blogspot                          | `blogspot`                        |
| BuzzFeed                          | `buzzfeed`                        |
| Cash                              | `cash`                            |
| Codecademy                        | `codecademy`                      |
| Contently                         | `contently`                       |
| Dailymotion                       | `dailymotion`                     |
| Designspiration                   | `designspiration`                 |
| DeviantArt                        | `deviantart`                      |
| Disqus                            | `disqus`                          |
| Dribbble                          | `dribbble`                        |
| eBay                              | `ebay`                            |
| Etsy                              | `etsy`                            |
| EyeEm                             | `eyeem`                           |
| Facebook                          | `facebook`                        |
| Fanpop                            | `fanpop`                          |
| Fiverr                            | `fiverr`                          |
| Flickr                            | `flickr`                          |
| Flipboard                         | `flipboard`                       |
| GitHub                            | `github`                          |
| Gravatar                          | `gravatar`                        |
| Houzz                             | `houzz`                           |
| Hubpages                          | `hubpages`                        |
| IFTTT                             | `ifttt`                           |
| Instructables                     | `instructables`                   |
| Kano World                        | `kanoworld`                       |
| Keybase                           | `keybase`                         |
| Kik                               | `kik`                             |
| Kongregate                        | `kongregate`                      |
| Last.fm                           | `last`                            |
| LiveJournal                      | `livejournal`                     |
| Medium                            | `medium`                          |
| Mix                               | `mix`                             |
| Shopify                           | `myshopify`                       |
| Myspace                           | `myspace`                         |
| Newgrounds                        | `newgrounds`                      |
| Pandora                           | `pandora`                         |
| Pastebin                          | `pastebin`                        |
| Patreon                           | `patreon`                         |
| PayPal                            | `paypal`                          |
| Photobucket                       | `photobucket`                     |
| Pinterest                         | `pinterest`                       |
| Product Hunt                      | `producthunt`                     |
| Reddit                            | `reddit`                          |
| ReverbNation                      | `reverbnation`                    |
| Roblox                            | `roblox`                          |
| Slack                             | `slack`                           |
| Slideshare                        | `slideshare`                      |
| Soundcloud                        | `soundcloud`                      |
| Spotify                           | `spotify`                         |
| Steam Community                   | `steamcommunity`                  |
| Telegram                          | `telegram`                        |
| TikTok                            | `tiktok`                          |
| Trakt.tv                          | `trakt`                           |
| TripIt                            | `tripit`                          |
| Tumblr                            | `tumblr`                          |
| Twitch                            | `twitch`                          |
| Twitter                           | `twitter`                         |
| Venmo                             | `venmo`                           |
| Vimeo                             | `vimeo`                           |
| VK                                | `vk`                              |
| Wattpad                           | `wattpad`                         |
| Wikia                             | `wikia`                           |
| WordPress                         | `wordpress`                       |
| Y Combinator                      | `ycombinator`                     |
| Yelp                              | `yelp`                            |
| YouNow                            | `younow`                          |
| YouTube                           | `youtube`                         |
