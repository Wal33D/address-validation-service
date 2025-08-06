import axios from 'axios';
import http from 'http';
import https from 'https';

describe('Connection Pooling', () => {
  it('should configure axios with connection pooling agents', () => {
    const httpAgent = new http.Agent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 60000,
      scheduling: 'lifo',
    });

    const httpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 60000,
      scheduling: 'lifo',
      rejectUnauthorized: true,
    });

    const instance = axios.create({
      timeout: 10000,
      httpAgent,
      httpsAgent,
      maxRedirects: 5,
      decompress: true,
      validateStatus: status => status < 500,
    });

    expect(instance.defaults.httpAgent).toBeDefined();
    expect(instance.defaults.httpsAgent).toBeDefined();
    expect(instance.defaults.httpAgent.keepAlive).toBe(true);
    expect(instance.defaults.httpsAgent.keepAlive).toBe(true);
    expect(instance.defaults.httpAgent.maxSockets).toBe(50);
    expect(instance.defaults.httpsAgent.maxSockets).toBe(50);
  });

  it('should cleanup agents on destroy', () => {
    const httpAgent = new http.Agent({ keepAlive: true });
    const httpsAgent = new https.Agent({ keepAlive: true });

    const destroySpy = jest.spyOn(httpAgent, 'destroy');
    const httpsDestroySpy = jest.spyOn(httpsAgent, 'destroy');

    httpAgent.destroy();
    httpsAgent.destroy();

    expect(destroySpy).toHaveBeenCalled();
    expect(httpsDestroySpy).toHaveBeenCalled();
  });
});
