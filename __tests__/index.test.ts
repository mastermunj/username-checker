import axios from 'axios';
import { UsernameChecker } from '../src';
import MockAdapter from 'axios-mock-adapter';

const mock = new MockAdapter(axios);

describe('Username Checker', () => {
  const random = Math.random().toString().replace('.', '').substring(0, 8);

  test('Twitter 200', async () => {
    const service = 'twitter';
    const username = `r1a2n3d${random}`;
    const url = `https://api.twitter.com/i/users/username_available.json?username=${username}`;

    mock
      .onGet(url)
      .reply(
        200,
        { valid: true, reason: 'available', msg: 'Available!', desc: 'Available!' },
        { 'content-type': 'application/json;charset=utf-8' },
      );
    const usernameChecker = new UsernameChecker();

    const result = await usernameChecker.isAvailable(service, username);
    expect(result).toMatchObject({ service, url, available: true });
  });

  test('Twitter ContentType', async () => {
    const service = 'twitter';
    const username = `r1a2n3d${random}`;
    const url = `https://api.twitter.com/i/users/username_available.json?username=${username}`;

    mock.onGet(url).reply(200, { valid: true, reason: 'available', msg: 'Available!', desc: 'Available!' });
    const usernameChecker = new UsernameChecker();

    const result = await usernameChecker.isAvailable(service, username);
    expect(result).toMatchObject({ service, url, available: false });
  });

  test('Venmo 404', async () => {
    const service = 'venmo';
    const username = `r1a2n3d${random}`;
    const url = `https://venmo.com/${username}`;

    mock.onGet(url).reply(404);
    const usernameChecker = new UsernameChecker();

    const result = await usernameChecker.isAvailable(service, username);
    expect(result).toMatchObject({ service, url, available: true });
  });

  test('Vimeo 500', async () => {
    const service = 'vimeo';
    const username = `r1a2n3d${random}`;
    const url = `https://vimeo.com/${username}`;

    mock.onGet(url).reply(500);
    const usernameChecker = new UsernameChecker();

    const result = await usernameChecker.isAvailable(service, username);
    expect(result).toMatchObject({
      service,
      url,
      available: undefined,
      reason: `${service} faced internal server error.`,
    });
  });

  test('Github 400', async () => {
    const service = 'github';
    const username = `r1a2n3d${random}`;
    const url = `https://github.com/${username}`;

    mock.onGet(url).reply(400);
    const usernameChecker = new UsernameChecker();

    const result = await usernameChecker.isAvailable(service, username);
    expect(result).toMatchObject({
      service,
      url,
      available: undefined,
      reason: `Unknown error occured with ${service}`,
    });
  });

  test('Pandora Timeout', async () => {
    const service = 'pandora';
    const username = `r1a2n3d${random}`;
    const url = `https://www.pandora.com/profile/${username}`;

    mock.onGet(url).timeout();
    const usernameChecker = new UsernameChecker();

    const result = await usernameChecker.isAvailable(service, username);
    expect(result).toMatchObject({
      service,
      url,
      available: undefined,
      reason: `Unable to connect to ${service}`,
    });
  });

  test('getServices', () => {
    const usernameChecker = new UsernameChecker();
    const services = usernameChecker.getServices();
    expect(services).toEqual(expect.any(Array));
  });

  test('getServiceDetail', () => {
    const usernameChecker = new UsernameChecker();
    const serviceDetail = usernameChecker.getServiceDetail('yelp');
    expect(serviceDetail).toEqual(expect.any(Object));
  });
});
