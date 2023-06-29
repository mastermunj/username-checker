import { UsernameChecker } from '../src';
import { faker } from '@faker-js/faker';
import { UsernameCheckerServices } from '../src/config';

describe('Username Checker', () => {
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

  describe('Twitch', () => {
    test('Username exist', async () => {
      const usernameChecker = new UsernameChecker();
      const serviceDetail = await usernameChecker.isAvailable('twitch', 'mirardes');
      expect(serviceDetail).toMatchObject({ available: false });
    });

    test('Username not exist', async () => {
      const usernameChecker = new UsernameChecker();
      const serviceDetail = await usernameChecker.isAvailable('twitch', faker.string.alphanumeric(14));
      expect(serviceDetail).toMatchObject({ available: true });
    });
  });

  describe('Twitter', () => {
    test('Username not exist', async () => {
      const usernameChecker = new UsernameChecker();
      const serviceDetail = await usernameChecker.isAvailable('twitter', faker.string.alphanumeric(14));
      expect(serviceDetail).toMatchObject({ available: true });
    });

    test('Username exist', async () => {
      const usernameChecker = new UsernameChecker();
      const serviceDetail = await usernameChecker.isAvailable('twitter', 'qlaffont');
      expect(serviceDetail).toMatchObject({ available: false });
    });

    test('Username too long', async () => {
      const usernameChecker = new UsernameChecker();
      const serviceDetail = await usernameChecker.isAvailable('twitter', 'qlaffontqweqweqweqweqweqwe');
      expect(serviceDetail).toMatchObject({ available: false });
    });

    test('If public url is return', async () => {
      const usernameChecker = new UsernameChecker();
      const username = 'qlaffont';
      const serviceDetail = await usernameChecker.isAvailable('twitter', username);
      expect(serviceDetail.url).toEqual(
        UsernameCheckerServices['twitter'].publicUrl?.replace('{{ username }}', encodeURIComponent(username)),
      );
    });
  });

  describe('Pinterest', () => {
    test('Username not exist', async () => {
      const usernameChecker = new UsernameChecker();
      const serviceDetail = await usernameChecker.isAvailable('pinterest', faker.string.alphanumeric(14));
      expect(serviceDetail).toMatchObject({ available: true });
    });

    test('Username exist', async () => {
      const usernameChecker = new UsernameChecker();
      const serviceDetail = await usernameChecker.isAvailable('pinterest', 'avaerage');
      expect(serviceDetail).toMatchObject({ available: false });
    });
  });

  describe('Reddit', () => {
    test('Username not exist', async () => {
      const usernameChecker = new UsernameChecker();
      const serviceDetail = await usernameChecker.isAvailable('reddit', faker.string.alphanumeric(14));
      expect(serviceDetail).toMatchObject({ available: true });
    });

    test('Username exist', async () => {
      const usernameChecker = new UsernameChecker();
      const serviceDetail = await usernameChecker.isAvailable('reddit', 'Judgement_Bot_AITA');
      expect(serviceDetail).toMatchObject({ available: false });
    });
  });

  describe('Wordpress', () => {
    test('Username not exist', async () => {
      const usernameChecker = new UsernameChecker();
      const serviceDetail = await usernameChecker.isAvailable('wordpress', faker.string.alphanumeric(14));
      expect(serviceDetail).toMatchObject({ available: true });
    });

    test('Username exist', async () => {
      const usernameChecker = new UsernameChecker();
      const serviceDetail = await usernameChecker.isAvailable('wordpress', 'facebook');
      expect(serviceDetail).toMatchObject({ available: false });
    });
  });

  describe('Paypal', () => {
    test('Username not exist', async () => {
      const usernameChecker = new UsernameChecker();
      const serviceDetail = await usernameChecker.isAvailable('paypal', faker.string.alphanumeric(27));
      expect(serviceDetail).toMatchObject({ available: true });
    });

    test('Username exist', async () => {
      const usernameChecker = new UsernameChecker();
      const serviceDetail = await usernameChecker.isAvailable('paypal', 'qlaffont');
      expect(serviceDetail).toMatchObject({ available: false });
    });
  });

  describe('Y Combinator', () => {
    test('Username not exist', async () => {
      const usernameChecker = new UsernameChecker();
      const serviceDetail = await usernameChecker.isAvailable('ycombinator', faker.string.alphanumeric(27));
      expect(serviceDetail).toMatchObject({ available: true });
    });

    test('Username exist', async () => {
      const usernameChecker = new UsernameChecker();
      const serviceDetail = await usernameChecker.isAvailable('ycombinator', 'slack');
      expect(serviceDetail).toMatchObject({ available: false });
    });
  });

  describe('Gitlab', () => {
    test('Username not exist', async () => {
      const usernameChecker = new UsernameChecker();
      const serviceDetail = await usernameChecker.isAvailable('gitlab', faker.string.alphanumeric(27));
      expect(serviceDetail).toMatchObject({ available: true });
    });

    test('Username exist', async () => {
      const usernameChecker = new UsernameChecker();
      const serviceDetail = await usernameChecker.isAvailable('gitlab', 'slack');
      expect(serviceDetail).toMatchObject({ available: false });
    });
  });
});
